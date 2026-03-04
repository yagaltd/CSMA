const DEFAULT_OPTIONS = {
    pingUrl: '/ping.json',
    sampleInterval: 15000
};

export class NetworkStatusService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        const defaultOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
            ? navigator.onLine
            : true;
        this.online = defaultOnline;
        this.timer = null;
    }

    init() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.#handleOnline);
            window.addEventListener('offline', this.#handleOffline);
        }
        this.eventBus?.subscribe('INTENT_NETWORK_STATUS_REFRESH', () => this.refresh().catch((error) => this.#handleError('refresh', error)));
        this.#publishStatus('init', this.online);
        this.#schedulePing();
    }

    destroy() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.#handleOnline);
            window.removeEventListener('offline', this.#handleOffline);
        }
        clearTimeout(this.timer);
    }

    refresh() {
        return this.#ping();
    }

    setStatus(online, reason = 'manual', latency) {
        this.online = online;
        this.#publishStatus(reason, online, latency);
    }

    #handleOnline = () => {
        this.setStatus(true, 'online-event');
    };

    #handleOffline = () => {
        this.setStatus(false, 'offline-event');
    };

    async #ping() {
        if (!this.options.pingUrl || typeof fetch === 'undefined') {
            return;
        }
        const start = Date.now();
        try {
            const response = await fetch(this.options.pingUrl, { cache: 'no-store' });
            const latency = Date.now() - start;
            const online = response.ok;
            this.setStatus(online, 'ping', latency);
        } catch (error) {
            this.setStatus(false, 'ping');
            this.#handleError('ping', error);
        } finally {
            this.#schedulePing();
        }
    }

    #schedulePing() {
        clearTimeout(this.timer);
        if (this.options.sampleInterval > 0) {
            this.timer = setTimeout(() => this.#ping(), this.options.sampleInterval);
        }
    }

    #publishStatus(reason, online, latency) {
        this.eventBus?.publish('NETWORK_STATUS_CHANGED', {
            online: Boolean(online),
            reason,
            latency: typeof latency === 'number' ? latency : undefined,
            timestamp: Date.now()
        });
    }

    #handleError(operation, error) {
        this.eventBus?.publish('NETWORK_STATUS_ERROR', {
            error: error?.message || String(error),
            operation
        });
    }
}
