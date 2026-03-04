import { CrdtReducerRegistry } from './CrdtReducerRegistry.js';

export class OptimisticSyncService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.actionLog = null;
        this.leaderService = null;
        this.networkStatus = null;
        this.transport = null;
        this.networkOnline = true;
        this.intents = new Map();
        this.processing = false;
        this.flushScheduled = false;
        this.reworkUnsubscribe = null;
        this.proxyChannel = null;
        this.proxyStorageKey = 'csma.optimistic.proxy';
        this.proxyStorage = null;
        this.tabId = OptimisticSyncService._createTabId();
        this.isLeader = false;
        this.crdtRegistry = null;

        this.handleLeaderEvent = this.handleLeaderEvent.bind(this);
        this.handleNetworkEvent = this.handleNetworkEvent.bind(this);
        this.handleServerRework = this.handleServerRework.bind(this);
        this.handleProxyMessage = this.handleProxyMessage.bind(this);
        this.handleProxyStorageEvent = this.handleProxyStorageEvent.bind(this);
    }

    async init({ actionLogService, leaderService, networkStatusService, transportService } = {}) {
        if (!actionLogService) {
            throw new Error('[OptimisticSync] ActionLogService is required.');
        }
        this.actionLog = actionLogService;
        this.leaderService = leaderService || window?.csma?.leader || null;
        this.networkStatus = networkStatusService || null;
        this.transport = transportService || null;
        this.networkOnline = this.networkStatus?.online ?? true;
        this.tabId = this.leaderService?.getTabId?.() || this.tabId;
        this.isLeader = this.leaderService?.isLeader?.() ?? true;
        this.crdtRegistry = new CrdtReducerRegistry(this.eventBus, {
            actionLogService: this.actionLog,
            actorId: this.tabId
        });
        if (typeof BroadcastChannel !== 'undefined') {
            this.proxyChannel = new BroadcastChannel('csma-optimistic-proxy');
            this.proxyChannel.addEventListener('message', this.handleProxyMessage);
        }
        if (typeof window !== 'undefined' && window.addEventListener) {
            try {
                this.proxyStorage = window.localStorage || null;
            } catch (error) {
                this.proxyStorage = null;
            }
            if (this.proxyStorage) {
                window.addEventListener('storage', this.handleProxyStorageEvent);
            }
        }

        this.eventBus?.subscribe('LEADER_STATE_CHANGED', this.handleLeaderEvent);
        this.eventBus?.subscribe('NETWORK_STATUS_CHANGED', this.handleNetworkEvent);
        this.reworkUnsubscribe = this.eventBus?.subscribe('OPTIMISTIC_SERVER_REWORK', this.handleServerRework);

        // Attempt to flush immediately if we're already leader
        this._scheduleFlush();
    }

    registerIntent(intentName, handlers = {}) {
        if (!intentName) {
            throw new Error('[OptimisticSync] intentName is required for registerIntent');
        }

        const existing = this.intents.get(intentName);
        if (existing?.unsubscribe) {
            existing.unsubscribe();
        }

        const subscription = this.eventBus?.subscribe(intentName, (payload) => {
            const channels = this._resolveChannels(handlers.channels, payload);
            const undo = this._resolveUndo(handlers.prepareUndo, payload, intentName);
            const metaExtras = this.crdtRegistry?.buildMeta(intentName, payload, {
                actorId: this.tabId,
                clock: this.actionLog?.clock
            }) || {};
            const entry = this.actionLog.record(intentName, payload, {
                channels,
                undo,
                actor: metaExtras.actor,
                reducer: metaExtras.reducer,
                actionCreator: metaExtras.actionCreator,
                crdt: metaExtras.crdt
            });

            try {
                handlers.applyLocal?.(payload, entry);
            } catch (error) {
                console.warn(`[OptimisticSync] applyLocal failed for ${intentName}:`, error);
            }

            this._forwardToLeader(entry);
            this._scheduleFlush();
        });

        this.intents.set(intentName, {
            ...handlers,
            unsubscribe: subscription
        });

        this.crdtRegistry?.registerIntent(intentName, {
            reducerId: handlers.reducerId || handlers.reducer,
            actionCreator: handlers.actionCreator,
            crdt: handlers.crdt
        });
    }

    unregisterIntent(intentName) {
        const config = this.intents.get(intentName);
        if (!config) return;
        config.unsubscribe?.();
        this.intents.delete(intentName);
        this.crdtRegistry?.unregisterIntent(intentName);
    }

    async flushPending() {
        if (!this._canFlush() || this.processing) {
            return;
        }

        this.processing = true;
        try {
            const pending = this.actionLog.getPending();
            for (const entry of pending) {
                const handlers = this.intents.get(entry.intent) || {};
                const flushFn = handlers.flush || (this.transport ? ((_, e) => this._transportFlush(e)) : null);
                if (!flushFn) {
                    continue;
                }

                let shouldRetry = true;
                while (shouldRetry) {
                    shouldRetry = false;
                    try {
                        const result = await flushFn(entry.payload, entry);
                        if (result && typeof result === 'object') {
                            entry.meta = { ...entry.meta, serverVersion: result.version ?? entry.meta.serverVersion };
                        }
                        this.actionLog.markAcked(entry.id);
                        handlers.onAck?.(result ?? entry.payload, entry);
                    } catch (error) {
                        const resolution = await this._handleConflict(error, entry, handlers);
                        if (resolution === 'retry') {
                            shouldRetry = true;
                            continue;
                        }
                        if (resolution === 'drop') {
                            break;
                        }

                        handlers.onError?.(error, entry);
                        const isTerminal = handlers.terminalFailure?.(error, entry) === true;
                        this.actionLog.markFailed(entry.id, error, { terminal: isTerminal });
                        if (!isTerminal && handlers.retryDelayMs) {
                            await this._delay(handlers.retryDelayMs);
                            shouldRetry = true;
                            continue;
                        }
                        if (handlers.rollback && isTerminal) {
                            try {
                                handlers.rollback(entry.payload, entry, error);
                            } catch (rollbackError) {
                                console.warn('[OptimisticSync] rollback failed:', rollbackError);
                            }
                        }
                        break;
                    }
                }
            }
        } finally {
            this.processing = false;
        }
    }

    handleLeaderEvent(event) {
        this.isLeader = this.leaderService?.isLeader?.() ?? (event?.role === 'leader');
        if (event?.role === 'leader' || this.isLeader) {
            this._scheduleFlush();
        }
    }

    handleNetworkEvent({ online }) {
        this.networkOnline = online !== false;
        if (this.networkOnline) {
            this._scheduleFlush();
        }
    }

    async handleProxyMessage(event) {
        const data = event?.data || event;
        if (!data || data.origin === this.tabId) {
            return;
        }
        if (data.type !== 'intent-proxy' || !data.entry) {
            return;
        }
        if (this.actionLog?.hasEntry?.(data.entry.id)) {
            if (this.leaderService?.isLeader?.()) {
                this._scheduleFlush();
            }
            return;
        }
        try {
            await this.actionLog?.ingest?.(data.entry, { emit: false });
            if (this.leaderService?.isLeader?.()) {
                this._scheduleFlush();
            }
        } catch (error) {
            console.warn('[OptimisticSync] Failed to ingest proxied intent:', error);
        }
    }

    handleProxyStorageEvent(event) {
        if (!event || event.key !== this.proxyStorageKey || !event.newValue) {
            return;
        }
        try {
            const payload = JSON.parse(event.newValue);
            this.handleProxyMessage({ data: payload });
        } catch (error) {
            console.warn('[OptimisticSync] Failed to parse proxy payload:', error);
        }
    }

    handleServerRework(payload = {}) {
        if (!payload || !Array.isArray(payload.intents)) {
            return;
        }
        for (const request of payload.intents) {
            if (!request.intent) continue;
            const handlers = this.intents.get(request.intent);
            if (!handlers) continue;

            try {
                handlers.onRework?.(request.undo?.payload, request);
            } catch (error) {
                console.warn('[OptimisticSync] onRework handler failed:', error);
            }

            const undo = this._resolveUndo(
                () => request.undo,
                request.undo?.payload,
                request.undo?.intent
            );

            if (undo?.intent && undo.payload !== undefined) {
                this.eventBus?.publish(undo.intent, undo.payload);
            } else if (handlers.rollback) {
                try {
                    handlers.rollback(request.payload, request, request.reason);
                } catch (error) {
                    console.warn('[OptimisticSync] rollback failed during rework:', error);
                }
            }
        }
    }

    _scheduleFlush() {
        if (this.flushScheduled) return;
        this.flushScheduled = true;
        const runner = async () => {
            this.flushScheduled = false;
            await this.flushPending();
        };
        if (typeof queueMicrotask === 'function') {
            queueMicrotask(runner);
        } else {
            Promise.resolve().then(runner);
        }
    }

    _canFlush() {
        const leaderReady = this.leaderService ? this.leaderService.isLeader() : true;
        return leaderReady && this.networkOnline;
    }

    _forwardToLeader(entry) {
        if (!entry || this.leaderService?.isLeader?.() || (!this.proxyChannel && !this.proxyStorage)) {
            return;
        }
        const payload = {
            type: 'intent-proxy',
            entry,
            origin: this.tabId,
            timestamp: Date.now()
        };
        try {
            this.proxyChannel?.postMessage(payload);
        } catch (error) {
            console.warn('[OptimisticSync] Failed to post proxy message:', error);
        }
        if (this.proxyStorage) {
            try {
                this.proxyStorage.setItem(this.proxyStorageKey, JSON.stringify(payload));
                // Remove immediately to keep storage tidy and still trigger event
                this.proxyStorage.removeItem(this.proxyStorageKey);
            } catch (error) {
                console.warn('[OptimisticSync] Failed to write proxy payload to storage:', error);
            }
        }
    }

    _delay(ms = 0) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async _transportFlush(entry) {
        if (!this.transport) {
            throw new Error('TRANSPORT_UNAVAILABLE');
        }
        return this.transport.sendIntent(entry);
    }

    _resolveChannels(channels, payload) {
        if (typeof channels === 'function') {
            try {
                const resolved = channels(payload);
                return Array.isArray(resolved) ? resolved : ['global'];
            } catch (error) {
                console.warn('[OptimisticSync] channels resolver failed:', error);
                return ['global'];
            }
        }
        if (Array.isArray(channels) && channels.length) {
            return channels;
        }
        return ['global'];
    }

    _resolveUndo(prepareUndo, payload, intentName) {
        if (typeof prepareUndo !== 'function') {
            return null;
        }
        try {
            const result = prepareUndo(payload) || null;
            if (!result) return null;
            if (typeof result === 'string') {
                return { intent: result, payload };
            }
            if (typeof result.intent !== 'string') {
                console.warn(`[OptimisticSync] prepareUndo must return an object with intent for ${intentName}`);
                return null;
            }
            return {
                intent: result.intent,
                payload: result.payload
            };
        } catch (error) {
            console.warn('[OptimisticSync] prepareUndo failed:', error);
            return null;
        }
    }

    async _handleConflict(error, entry, handlers) {
        const resolver = handlers.resolveConflict;
        if (!resolver) {
            return null;
        }
        try {
            const resolution = await resolver({ error, entry, payload: entry.payload });
            if (!resolution) {
                return null;
            }
            if (resolution.drop === true) {
                this.actionLog.markAcked(entry.id);
                this.eventBus?.publish('OPTIMISTIC_ACTION_DROPPED', { entry, reason: 'conflict-drop' });
                return 'drop';
            }
            if (resolution.retryPayload) {
                this.actionLog.updatePayload(entry.id, resolution.retryPayload);
                entry.meta.conflicts = (entry.meta.conflicts || 0) + 1;
                if (resolution.delayMs) {
                    await this._delay(resolution.delayMs);
                }
                this.eventBus?.publish('OPTIMISTIC_ACTION_UPDATED', { entryId: entry.id, reason: 'conflict-resolution' });
                return 'retry';
            }
        } catch (resolverError) {
            console.warn('[OptimisticSync] resolveConflict handler failed:', resolverError);
        }
        return null;
    }

    getReducerState(reducerId, key) {
        return this.crdtRegistry?.getState(reducerId, key) ?? null;
    }

    getReducerSnapshot(reducerId) {
        return this.crdtRegistry?.getSnapshot(reducerId) ?? {};
    }

    static _createTabId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `proxy-${Math.random().toString(16).slice(2)}`;
    }
}
