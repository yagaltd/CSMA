import { PROTOCOL } from '../../../config.js';

const DEFAULT_ACK_TIMEOUT = 8000;

export class SyncTransportService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.socket = null;
        this.eventSource = null;
        this.endpoint = null;
        this.pending = new Map();
        this.queue = [];
        this.backoffMs = 1000;
        this.maxBackoff = 15000;
        this.ackTimeout = DEFAULT_ACK_TIMEOUT;
        this.connectionState = 'idle';
        this.channelManager = null;
        this.channelEventSubs = [];
        this.eventsEndpoint = null;
    }

    async init({ endpoint, eventsEndpoint, leaderService, channelManager, subprotocol } = {}) {
        this.leaderService = leaderService;
        this.endpoint = endpoint || this._defaultWsUrl();
        this.eventsEndpoint = eventsEndpoint || this._defaultHttpUrl('/optimistic/events');
        this.channelManager = channelManager || window?.csma?.channels || null;
        this.subprotocol = subprotocol || PROTOCOL.subprotocol || '1.0.0';

        const hasWebSocket = typeof WebSocket !== 'undefined' && !!this.endpoint;
        if (!hasWebSocket) {
            console.warn('[OptimisticTransport] WebSocket API unavailable or endpoint missing. Only SSE replay will be active.');
        } else {
            this._bindChannelEvents();
            this._connect();
        }
        this._initEventStream();
    }

    async destroy() {
        this.queue = [];
        this._failPending(new Error('TRANSPORT_SHUTDOWN'));
        this.socket?.close();
        this.eventSource?.close?.();
        this._unbindChannelEvents();
    }

    sendIntent(entry) {
        if (!entry) {
            return Promise.reject(new Error('ENTRY_REQUIRED'));
        }
        if (!this.socket) {
            return Promise.reject(new Error('TRANSPORT_NOT_READY'));
        }

        const payload = {
            type: 'intent.batch',
            intents: [
                {
                    id: entry.id,
                    intent: entry.intent,
                    payload: entry.payload,
                    meta: entry.meta
                }
            ]
        };

        return new Promise((resolve, reject) => {
            const message = JSON.stringify(payload);
            const timeout = setTimeout(() => {
                this.pending.delete(entry.id);
                reject(new Error('ACK_TIMEOUT'));
            }, this.ackTimeout);
            this.pending.set(entry.id, { resolve, reject, timeout });

            const send = () => {
                try {
                    this.socket.send(message);
                } catch (error) {
                    clearTimeout(timeout);
                    this.pending.delete(entry.id);
                    reject(error);
                }
            };

            if (this.socket.readyState === WebSocket.OPEN) {
                send();
            } else {
                this.queue.push(send);
                this._ensureConnection();
            }
        });
    }

    _connect() {
        this.socket?.close();
        this._setState('connecting');
        try {
            const url = new URL(this.endpoint);
            url.searchParams.set('role', 'leader');
            url.searchParams.set('site', this.leaderService?.getSite?.() || 'default');
            url.searchParams.set('subprotocol', this.subprotocol);
            this.socket = new WebSocket(url.toString());
        } catch (error) {
            console.warn('[OptimisticTransport] Failed to open socket:', error);
            this._scheduleReconnect();
            return;
        }

        this.socket.addEventListener('open', () => {
            this.backoffMs = 1000;
            this._setState('open');
            this._flushQueue();
            this._resubscribeChannels();
        });

        this.socket.addEventListener('message', (event) => this._handleMessage(event.data));

        this.socket.addEventListener('close', () => {
            this._setState('closed');
            this._scheduleReconnect();
            this._failPending(new Error('TRANSPORT_CLOSED'));
        });

        this.socket.addEventListener('error', (error) => {
            console.warn('[OptimisticTransport] socket error:', error);
        });
    }

    _handleMessage(raw) {
        let message;
        try {
            message = JSON.parse(raw);
        } catch (error) {
            console.warn('[OptimisticTransport] Failed to parse message:', error);
            return;
        }

        if (message.type === 'ack') {
            for (const intent of message.intents || []) {
                const pending = this.pending.get(intent.id);
                if (!pending) continue;
                clearTimeout(pending.timeout);
                this.pending.delete(intent.id);
                pending.resolve(intent);
                this.eventBus?.publish('OPTIMISTIC_TRANSPORT_ACK', intent);
            }
            return;
        }

        if (message.type === 'replay') {
            this.eventBus?.publish('OPTIMISTIC_TRANSPORT_REPLAY', message);
            this.channelManager?.handleReplay(message);
            return;
        }

        if (message.type === 'channel.ack') {
            this.eventBus?.publish('CHANNEL_SERVER_EVENT', message);
            if (message.status === 'error') {
                this.eventBus?.publish('CHANNEL_ACCESS_DENIED', message);
            }
            return;
        }

        if (message.type === 'channel.snapshot') {
            const payload = {
                channel: message.channel,
                params: message.params,
                intents: message.intents || [],
                cursor: message.cursor,
                reason: message.reason
            };
            this.channelManager?.handleReplay(payload);
            this.eventBus?.publish('CHANNEL_SERVER_SNAPSHOT', message);
            return;
        }

        if (message.type === 'channel.invalidate') {
            const payload = {
                channel: message.channel,
                params: message.params,
                intents: message.intents || [],
                reason: message.reason,
                cursor: message.cursor
            };
            this.channelManager?.handleInvalidate(payload);
            this.eventBus?.publish('CHANNEL_SERVER_INVALIDATE', message);
            return;
        }

        if (message.type === 'channel.replay') {
            const payload = {
                channel: message.channel,
                params: message.params,
                intents: message.intents || [],
                cursor: message.cursor,
                reason: message.reason
            };
            this.channelManager?.handleReplay(payload);
            this.eventBus?.publish('CHANNEL_SERVER_REPLAY', message);
            return;
        }

        if (message.type === 'channel.close') {
            this.channelManager?.handleClose(message);
            this.eventBus?.publish('CHANNEL_SERVER_CLOSE', message);
            return;
        }

        if (message.type === 'island.invalidate') {
            this.eventBus?.publish('ISLAND_INVALIDATED', message);
            return;
        }

        if (message.type === 'channel.command') {
            this.channelManager?.handleCommandResult(message);
            this.eventBus?.publish('CHANNEL_COMMAND_RESULT', message);
            return;
        }

        if (message.type === 'channel.unsubscribed') {
            this.eventBus?.publish('CHANNEL_SERVER_EVENT', message);
            return;
        }

        if (message.type === 'rework') {
            this.eventBus?.publish('OPTIMISTIC_SERVER_REWORK', message);
            return;
        }

        if (message.type === 'error' && message.code && message.intentId) {
            const pending = this.pending.get(message.intentId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pending.delete(message.intentId);
                pending.reject(new Error(message.code));
            }
        }
    }

    _flushQueue() {
        const queue = [...this.queue];
        this.queue = [];
        queue.forEach((send) => send());
    }

    _ensureConnection() {
        if (!this.endpoint || typeof WebSocket === 'undefined') {
            return;
        }
        if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
            this._connect();
        }
    }

    _scheduleReconnect() {
        if (typeof window === 'undefined' || !this.endpoint) return;
        setTimeout(() => {
            this.backoffMs = Math.min(this.backoffMs * 1.5, this.maxBackoff);
            this._connect();
        }, this.backoffMs);
    }

    _failPending(error) {
        for (const [id, pending] of this.pending.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(error);
            this.pending.delete(id);
        }
    }

    _setState(state) {
        if (this.connectionState === state) return;
        this.connectionState = state;
        this.eventBus?.publish('OPTIMISTIC_TRANSPORT_STATE', { state });
    }

    _bindChannelEvents() {
        this._unbindChannelEvents();
        if (!this.channelManager || !this.eventBus?.subscribe) {
            return;
        }
        const onSubscribe = this.eventBus.subscribe('CHANNEL_SUBSCRIBED', ({ id, params }) => {
            this._sendChannelCommand('channel.subscribe', { channel: id, params });
        });
        const onUnsubscribe = this.eventBus.subscribe('CHANNEL_UNSUBSCRIBED', ({ id, params, source }) => {
            if (source === 'server-close') {
                return;
            }
            this._sendChannelCommand('channel.unsubscribe', { channel: id, params });
        });
        const onCommand = this.eventBus.subscribe('CHANNEL_COMMAND_REQUEST', ({ id, params, command, args }) => {
            this._sendChannelCommand('channel.command', { channel: id, params, command, args });
        });
        this.channelEventSubs = [onSubscribe, onUnsubscribe, onCommand];
    }

    _unbindChannelEvents() {
        this.channelEventSubs.forEach((dispose) => dispose?.());
        this.channelEventSubs = [];
    }

    _resubscribeChannels() {
        if (!this.channelManager?.listSubscriptions) return;
        const subs = this.channelManager.listSubscriptions();
        subs.forEach(({ id, params }) => {
            this._sendChannelCommand('channel.subscribe', { channel: id, params });
        });
    }

    _sendChannelCommand(type, body = {}) {
        const payload = { type, ...body };
        const send = () => {
            try {
                this.socket.send(JSON.stringify(payload));
            } catch (error) {
                console.warn('[OptimisticTransport] Failed to send channel command:', error);
            }
        };

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            send();
        } else {
            this.queue.push(send);
            this._ensureConnection();
        }
    }

    _initEventStream() {
        if (typeof EventSource === 'undefined') {
            return;
        }
        const url = this.eventsEndpoint || this._defaultHttpUrl('/optimistic/events');
        if (!url) return;
        this.eventSource?.close?.();
        this.eventSource = new EventSource(url);
        this.eventSource.addEventListener('invalidate', (event) => {
            try {
                const data = JSON.parse(event.data || '{}');
                this.eventBus?.publish('OPTIMISTIC_INVALIDATION', data);
                this.channelManager?.handleInvalidate(data);
            } catch (error) {
                console.warn('[OptimisticTransport] Failed to parse SSE payload:', error);
            }
        });
        this.eventSource.addEventListener('replay', (event) => {
            try {
                const data = JSON.parse(event.data || '{}');
                this.eventBus?.publish('OPTIMISTIC_TRANSPORT_REPLAY', data);
                this.channelManager?.handleReplay(data);
            } catch (error) {
                console.warn('[OptimisticTransport] Failed to parse replay payload:', error);
            }
        });

        this.eventSource.addEventListener('island.invalidate', (event) => {
            try {
                const data = JSON.parse(event.data || '{}');
                this.eventBus?.publish('ISLAND_INVALIDATED', data);
            } catch (error) {
                console.warn('[OptimisticTransport] Failed to parse island invalidate payload:', error);
            }
        });

        this.eventSource.addEventListener('rework', (event) => {
            try {
                const data = JSON.parse(event.data || '{}');
                this.eventBus?.publish('OPTIMISTIC_SERVER_REWORK', data);
            } catch (error) {
                console.warn('[OptimisticTransport] Failed to parse rework payload:', error);
            }
        });
    }

    _defaultWsUrl() {
        if (typeof window === 'undefined') return null;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/optimistic/ws`;
    }

    _defaultHttpUrl(pathname) {
        if (typeof window === 'undefined') return null;
        const base = `${window.location.protocol}//${window.location.host}`;
        return `${base}${pathname}`;
    }
}
