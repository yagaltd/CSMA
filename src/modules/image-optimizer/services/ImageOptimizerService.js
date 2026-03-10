const DEFAULT_TARGETS = ['image/webp', 'image/avif'];

export class ImageOptimizerService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.mediaTransform = options.mediaTransform || null;
        this.targets = options.targets || DEFAULT_TARGETS;
        this.fileSystem = options.fileSystem || null;
        this.subscriptions = [];
    }

    init({ mediaTransformService, fileSystemService } = {}) {
        if (mediaTransformService) {
            this.mediaTransform = mediaTransformService;
        }
        if (fileSystemService) {
            this.fileSystem = fileSystemService;
        }

        if (this.eventBus?.subscribe && this.subscriptions.length === 0) {
            this.subscriptions.push(
                this.eventBus.subscribe('INTENT_IMAGE_OPTIMIZE', (payload) => this.optimize(payload).catch((error) => this.#handleError('optimize', error)))
            );
        }
    }

    destroy() {
        this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
    }

    async optimize({ blob, targets = this.targets, metadata = {} }) {
        if (!blob) {
            throw new Error('Image blob required');
        }
        if (!this.mediaTransform) {
            throw new Error('MediaTransform service required');
        }

        const outputs = [];
        for (const format of targets) {
            const { blob: optimized, metadata: transformMeta } = await this.mediaTransform.transform({ blob, format });
            let fileRecord = null;
            if (this.fileSystem?.store) {
                fileRecord = await this.fileSystem.store(optimized, {
                    title: metadata.title || `image-${format}`,
                    category: 'optimized-images',
                    tags: ['optimized', format],
                    extra: transformMeta
                });
            }
            outputs.push({ format, blob: optimized, metadata: transformMeta, file: fileRecord });
        }

        const payload = {
            originalSize: blob.size,
            variants: outputs.map((output) => ({
                format: output.format,
                size: output.metadata.size,
                mimeType: output.metadata.mimeType,
                fileId: output.file?.id
            }))
        };

        this.#publish('IMAGE_OPTIMIZE_COMPLETED', payload);
        return { outputs, summary: payload };
    }

    #handleError(operation, error) {
        console.error('[ImageOptimizer]', operation, error);
        this.#publish('IMAGE_OPTIMIZE_ERROR', {
            error: error?.message || String(error),
            operation
        });
    }

    #publish(eventName, payload) {
        this.eventBus?.publish(eventName, payload);
    }
}
