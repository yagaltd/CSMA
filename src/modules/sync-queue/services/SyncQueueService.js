const DEFAULT_OPTIONS = {
    persistKey: 'csma.sync.queue'
};

export class SyncQueueService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.storage = options.storage || null;
        this.networkStatus = options.networkStatus || null;
        this.processors = options.processors || {};
        this.queue = [];
        this.flushing = false;
        this.subscriptions = [];
        this.initialized = false;
    }

    init({ storageService, networkStatusService } = {}) {
        if (this.initialized) {
            return;
        }

        this.initialized = true;
        if (storageService) {
            this.storage = storageService;
        }
        if (networkStatusService) {
            this.networkStatus = networkStatusService;
        }
        this.#loadQueue();

        if (this.eventBus) {
            this.subscriptions.push(
                this.eventBus.subscribe('INTENT_SYNC_QUEUE_ENQUEUE', (payload) => this.enqueue(payload)),
                this.eventBus.subscribe('NETWORK_STATUS_CHANGED', ({ online }) => {
                    if (online) {
                        this.flush();
                    }
                })
            );
        }

        if (this.networkStatus?.online) {
            this.flush();
        }
    }

    enqueue({ id, type, payload }) {
        const job = {
            id: id || this.#generateId(),
            type,
            payload,
            enqueuedAt: Date.now()
        };
        this.queue.push(job);
        this.#persist();
        this.eventBus?.publish('SYNC_QUEUE_ENQUEUED', { id: job.id, type });
        if (this.networkStatus?.online) {
            this.flush();
        }
        return job.id;
    }

    async flush() {
        if (this.flushing || this.queue.length === 0) {
            return;
        }
        this.flushing = true;
        const successes = [];
        try {
            while (this.queue.length > 0 && this.networkStatus?.online !== false) {
                const job = this.queue[0];
                const processor = this.processors[job.type];
                if (!processor) {
                    throw new Error(`No processor registered for job type ${job.type}`);
                }
                await processor(job.payload);
                successes.push(job);
                this.queue.shift();
            }
            this.#persist();
            if (successes.length > 0) {
                this.eventBus?.publish('SYNC_QUEUE_FLUSHED', {
                    count: successes.length,
                    lastId: successes.at(-1).id
                });
            }
        } catch (error) {
            this.#handleError('flush', error);
        } finally {
            this.flushing = false;
        }
    }

    registerProcessor(type, handler) {
        this.processors[type] = handler;
    }

    destroy() {
        this.initialized = false;
        this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
        this.flushing = false;
    }

    #loadQueue() {
        if (!this.storage?.getItem) {
            return;
        }
        try {
            const raw = this.storage.getItem(this.options.persistKey);
            if (raw) {
                this.queue = JSON.parse(raw) || [];
            }
        } catch (error) {
            console.warn('[SyncQueue] Failed to load queue', error);
        }
    }

    #persist() {
        if (!this.storage?.setItem) {
            return;
        }
        try {
            this.storage.setItem(this.options.persistKey, JSON.stringify(this.queue));
        } catch (error) {
            console.warn('[SyncQueue] Failed to persist queue', error);
        }
    }

    #handleError(operation, error) {
        console.error('[SyncQueue]', operation, error);
        this.eventBus?.publish('SYNC_QUEUE_ERROR', {
            error: error?.message || String(error),
            operation
        });
    }

    #generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
}
