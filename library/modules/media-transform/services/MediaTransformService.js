const DEFAULT_OPTIONS = {
    offscreen: typeof OffscreenCanvas !== 'undefined'
};

export class MediaTransformService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.adapters = options.adapters || this.#createDefaultAdapters();
        this.subscriptions = [];
    }

    init() {
        if (this.eventBus?.subscribe && this.subscriptions.length === 0) {
            this.subscriptions.push(
                this.eventBus.subscribe('INTENT_MEDIA_TRANSFORM', (payload) => {
                    return this.transform(payload).catch((error) => this.#handleError('transform', error));
                })
            );
        }
    }

    destroy() {
        this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
    }

    async transform({ blob, format = 'image/webp', quality = 0.85 }) {
        if (!blob) {
            throw new Error('No blob supplied for transform');
        }

        const adapter = this.adapters[format] || this.adapters.default;
        const result = await adapter(blob, { format, quality });
        const payload = {
            size: result.size,
            format,
            quality,
            mimeType: result.type,
            duration: result.duration
        };
        this.#publish('MEDIA_TRANSFORM_COMPLETED', payload);
        return { blob: result, metadata: payload };
    }

    #handleError(operation, error) {
        console.error('[MediaTransform]', operation, error);
        this.#publish('MEDIA_TRANSFORM_ERROR', {
            error: error?.message || String(error),
            operation
        });
    }

    #publish(eventName, payload) {
        this.eventBus?.publish(eventName, payload);
    }

    #createDefaultAdapters() {
        return {
            async default(blob) {
                return blob;
            }
        };
    }
}
