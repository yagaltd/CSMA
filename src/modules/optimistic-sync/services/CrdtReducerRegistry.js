const SUPPORTED_TYPES = new Set(['lww-register', 'g-counter', 'pn-counter']);

export class CrdtReducerRegistry {
    constructor(eventBus, { actionLogService = null, actorId = 'local', maxTrackedEntries = 5000 } = {}) {
        this.eventBus = eventBus;
        this.actionLog = actionLogService;
        this.actorId = actorId;
        this.maxTrackedEntries = maxTrackedEntries;
        this.intentConfigs = new Map();
        this.reducerUsage = new Map();
        this.reducerState = new Map();
        this.entryVersions = new Map();
        this.entryOrder = [];
        this.disposers = [];
        this.trackedReducers = new Set();
        this._bindEvents();
    }

    setActorId(actorId) {
        if (actorId) {
            this.actorId = actorId;
        }
    }

    registerIntent(intentName, config = {}) {
        if (!intentName) return;
        const normalized = this._normalizeConfig(intentName, config);
        this.intentConfigs.set(intentName, normalized);
        this._incrementReducerUsage(normalized.reducerId);
        this._primeFromHistory(intentName);
    }

    unregisterIntent(intentName) {
        const config = this.intentConfigs.get(intentName);
        if (config) {
            this._decrementReducerUsage(config.reducerId);
        }
        this.intentConfigs.delete(intentName);
    }

    buildMeta(intentName, payload, { actorId, clock } = {}) {
        const config = this.intentConfigs.get(intentName);
        if (!config) return null;
        const meta = {};
        if (config.actionCreator) {
            meta.actionCreator = config.actionCreator;
        }
        if (config.reducerId) {
            meta.reducer = config.reducerId;
        }
        if (actorId || this.actorId) {
            meta.actor = actorId || this.actorId;
        }
        if (config.crdt) {
            const descriptor = this._createDescriptor(config, payload, { actorId: meta.actor, clock });
            if (descriptor) {
                meta.crdt = descriptor;
            }
        }
        return meta;
    }

    applyEntry(entry, options = {}) {
        if (!entry || !entry.id) return;
        const descriptor = this._resolveDescriptor(entry, options);
        if (!descriptor) return;
        const reducerId = descriptor.reducer || entry.meta?.reducer;
        if (!reducerId || !this._isReducerTracked(reducerId)) return;
        if (this._shouldSkipEntry(entry, options)) return;
        switch (descriptor.type) {
            case 'lww-register':
                this._applyLww(reducerId, descriptor, entry, options);
                break;
            case 'g-counter':
                this._applyGCounter(reducerId, descriptor, entry, options);
                break;
            case 'pn-counter':
                this._applyPnCounter(reducerId, descriptor, entry, options);
                break;
            default:
                break;
        }
    }

    applyEntries(list, options = {}) {
        if (!Array.isArray(list)) return;
        for (const entry of list) {
            this.applyEntry(entry, options);
        }
    }

    getState(reducerId, key) {
        const bucket = this.reducerState.get(reducerId);
        if (!bucket) return null;
        const record = bucket.get(key);
        return record ? record.value : null;
    }

    getSnapshot(reducerId) {
        const bucket = this.reducerState.get(reducerId);
        if (!bucket) return {};
        const snapshot = {};
        for (const [key, record] of bucket.entries()) {
            snapshot[key] = record.value;
        }
        return snapshot;
    }

    dispose() {
        for (const dispose of this.disposers) {
            dispose?.();
        }
        this.disposers = [];
        this.intentConfigs.clear();
        this.reducerUsage.clear();
        this.reducerState.clear();
        this.entryVersions.clear();
        this.entryOrder = [];
        this.trackedReducers.clear();
    }

    _bindEvents() {
        if (!this.eventBus?.subscribe) {
            return;
        }
        this.disposers.push(
            this.eventBus.subscribe('OPTIMISTIC_ACTION_RECORDED', ({ entry }) => this.applyEntry(entry, { source: 'local-record' })),
            this.eventBus.subscribe('OPTIMISTIC_ACTION_INGESTED', ({ entry }) => this.applyEntry(entry, { source: 'log-ingest' })),
            this.eventBus.subscribe('OPTIMISTIC_TRANSPORT_REPLAY', (message) => this.applyEntries(message?.intents, { source: 'transport-replay' })),
            this.eventBus.subscribe('CHANNEL_SERVER_SNAPSHOT', (message) => this.applyEntries(message?.intents, { source: 'channel-snapshot' })),
            this.eventBus.subscribe('CHANNEL_SERVER_INVALIDATE', (message) => this.applyEntries(message?.intents, { source: message?.reason || 'channel-invalidate' })),
            this.eventBus.subscribe('CHANNEL_SERVER_REPLAY', (message) => this.applyEntries(message?.intents, { source: 'channel-replay' }))
        );
    }

    _normalizeConfig(intentName, config = {}) {
        const reducerId = config.reducerId || config.reducer || intentName;
        const normalized = {
            intent: intentName,
            reducerId,
            actionCreator: config.actionCreator || null,
            crdt: config.crdt ? { ...config.crdt } : null
        };
        return normalized;
    }

    _createDescriptor(config, payload, { actorId, clock } = {}) {
        if (!config?.crdt) return null;
        const raw = { ...config.crdt };
        const type = this._normalizeType(raw.type);
        if (!type) return null;
        const resolvedKey = this._resolveMaybeFunction(raw.key, payload);
        if (!resolvedKey) return null;
        const descriptor = {
            type,
            key: String(resolvedKey),
            reducer: config.reducerId,
            actor: this._resolveMaybeFunction(raw.actor, payload) || actorId || this.actorId,
            timestamp: this._resolveMaybeFunction(raw.timestamp, payload) || clock || Date.now()
        };
        if (type === 'lww-register') {
            const value = this._resolveMaybeFunction(raw.value, payload);
            descriptor.value = value !== undefined ? this._cloneValue(value) : this._cloneValue(payload);
            if (raw.field) {
                descriptor.field = String(raw.field);
            }
        } else {
            const delta = this._resolveMaybeFunction(raw.delta, payload);
            descriptor.delta = Number.isFinite(delta) ? Number(delta) : Number(payload?.delta ?? 0);
        }
        return descriptor;
    }

    _resolveDescriptor(entry, options) {
        const intentConfig = this.intentConfigs.get(entry.intent);
        const incoming = entry.meta?.crdt;
        if (incoming) {
            return this._sanitizeDescriptor(incoming, intentConfig?.reducerId || entry.meta?.reducer);
        }
        if (!intentConfig) return null;
        return this._createDescriptor(intentConfig, entry.payload, {
            actorId: entry.meta?.actor || this.actorId,
            clock: entry.meta?.clock
        });
    }

    _sanitizeDescriptor(raw = {}, fallbackReducer) {
        if (typeof raw !== 'object' || raw === null) return null;
        const type = this._normalizeType(raw.type);
        if (!type) return null;
        const key = raw.key ? String(raw.key) : null;
        if (!key) return null;
        const descriptor = {
            type,
            key,
            reducer: raw.reducer || fallbackReducer || null,
            actor: raw.actor || null,
            timestamp: Number.isFinite(raw.timestamp) ? Number(raw.timestamp) : undefined
        };
        if (type === 'lww-register') {
            descriptor.value = raw.value !== undefined ? this._cloneValue(raw.value) : undefined;
            if (raw.field) descriptor.field = String(raw.field);
        } else if (raw.delta !== undefined) {
            descriptor.delta = Number(raw.delta);
        }
        return descriptor;
    }

    _applyLww(reducerId, descriptor, entry, options) {
        const bucket = this._getReducerBucket(reducerId);
        const current = bucket.get(descriptor.key);
        const incomingTs = Number.isFinite(descriptor.timestamp)
            ? Number(descriptor.timestamp)
            : Number(entry.meta?.clock || entry.updatedAt || Date.now());
        const actor = descriptor.actor || entry.meta?.actor || this.actorId;
        const shouldReplace =
            !current ||
            incomingTs > current.timestamp ||
            (incomingTs === current.timestamp && String(actor) > String(current.actor));
        if (!shouldReplace) return;
        const value = descriptor.value !== undefined ? descriptor.value : this._cloneValue(entry.payload);
        bucket.set(descriptor.key, {
            value,
            timestamp: incomingTs,
            actor,
            strategy: 'lww-register'
        });
        this._emitUpdate(reducerId, descriptor.key, value, 'lww-register', options.source);
    }

    _applyGCounter(reducerId, descriptor, entry, options) {
        const delta = Number(descriptor.delta ?? entry.payload?.delta ?? 0);
        if (!Number.isFinite(delta) || delta <= 0) {
            return;
        }
        const actor = descriptor.actor || entry.meta?.actor || this.actorId;
        const bucket = this._getReducerBucket(reducerId);
        const state = bucket.get(descriptor.key) || { value: 0, actors: new Map(), strategy: 'g-counter' };
        const currentActorValue = state.actors.get(actor) || 0;
        state.actors.set(actor, currentActorValue + delta);
        state.value = Array.from(state.actors.values()).reduce((sum, value) => sum + value, 0);
        state.updatedAt = Date.now();
        bucket.set(descriptor.key, state);
        this._emitUpdate(reducerId, descriptor.key, state.value, 'g-counter', options.source);
    }

    _applyPnCounter(reducerId, descriptor, entry, options) {
        const delta = Number(descriptor.delta ?? entry.payload?.delta ?? 0);
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        const actor = descriptor.actor || entry.meta?.actor || this.actorId;
        const bucket = this._getReducerBucket(reducerId);
        const state = bucket.get(descriptor.key) || {
            value: 0,
            increments: new Map(),
            decrements: new Map(),
            strategy: 'pn-counter'
        };
        const target = delta > 0 ? state.increments : state.decrements;
        const current = target.get(actor) || 0;
        target.set(actor, current + Math.abs(delta));
        const incTotal = Array.from(state.increments.values()).reduce((sum, value) => sum + value, 0);
        const decTotal = Array.from(state.decrements.values()).reduce((sum, value) => sum + value, 0);
        state.value = incTotal - decTotal;
        state.updatedAt = Date.now();
        bucket.set(descriptor.key, state);
        this._emitUpdate(reducerId, descriptor.key, state.value, 'pn-counter', options.source);
    }

    _emitUpdate(reducerId, key, value, strategy, source) {
        if (!reducerId) return;
        if (!this.reducerState.has(reducerId)) {
            this.reducerState.set(reducerId, new Map());
        }
        const bucket = this.reducerState.get(reducerId);
        bucket.set(key, { value, strategy, updatedAt: Date.now() });
        this.eventBus?.publish?.('OPTIMISTIC_CRDT_STATE_CHANGED', {
            reducerId,
            key,
            value,
            strategy,
            source,
            updatedAt: bucket.get(key).updatedAt
        });
    }

    _getReducerBucket(reducerId) {
        if (!this.reducerState.has(reducerId)) {
            this.reducerState.set(reducerId, new Map());
        }
        return this.reducerState.get(reducerId);
    }

    _shouldSkipEntry(entry, { force } = {}) {
        const version = Number(entry.meta?.clock || entry.updatedAt || entry.insertedAt || 0);
        if (force) {
            this._trackEntry(entry.id, version);
            return false;
        }
        const previous = this.entryVersions.get(entry.id);
        if (previous !== undefined && previous >= version) {
            return true;
        }
        this._trackEntry(entry.id, version);
        return false;
    }

    _trackEntry(id, version) {
        this.entryVersions.set(id, version);
        this.entryOrder.push(id);
        if (this.entryOrder.length > this.maxTrackedEntries) {
            const oldest = this.entryOrder.shift();
            if (oldest !== undefined) {
                this.entryVersions.delete(oldest);
            }
        }
    }

    _incrementReducerUsage(reducerId) {
        if (!reducerId) return;
        const count = this.reducerUsage.get(reducerId) || 0;
        this.reducerUsage.set(reducerId, count + 1);
        this.trackedReducers.add(reducerId);
    }

    _decrementReducerUsage(reducerId) {
        if (!reducerId || !this.reducerUsage.has(reducerId)) return;
        const current = this.reducerUsage.get(reducerId);
        if (current <= 1) {
            this.reducerUsage.delete(reducerId);
            this.trackedReducers.delete(reducerId);
            this.reducerState.delete(reducerId);
        } else {
            this.reducerUsage.set(reducerId, current - 1);
        }
    }

    _isReducerTracked(reducerId) {
        return this.trackedReducers.has(reducerId);
    }

    _primeFromHistory(intentName) {
        if (!this.actionLog?.getAll) return;
        const entries = this.actionLog.getAll().filter((entry) => entry.intent === intentName);
        for (const entry of entries) {
            this.applyEntry(entry, { source: 'log-prime', force: true });
        }
    }

    _resolveMaybeFunction(resolver, payload) {
        if (typeof resolver === 'function') {
            try {
                return resolver(payload);
            } catch (error) {
                console.warn('[CrdtReducerRegistry] resolver failed:', error);
                return null;
            }
        }
        return resolver ?? null;
    }

    _normalizeType(type) {
        if (!type) return null;
        const normalized = String(type).toLowerCase();
        return SUPPORTED_TYPES.has(normalized) ? normalized : null;
    }

    _cloneValue(value) {
        if (value === undefined) return value;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (error) {
                // fall-through
            }
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }
}
