const DEFAULT_OPTIONS = {
    mimeType: 'audio/webm;codecs=opus',
    timeslice: 1000,
    persistRecordings: true
};

export class MediaCaptureService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.recorderFactory = options.recorderFactory || this.#defaultRecorderFactory;
        this.streamGetter = options.streamGetter || this.#defaultStreamGetter;
        this.fileSystem = options.fileSystem || null;
        this.current = null;
        this.subscriptions = [];
    }

    init({ fileSystemService } = {}) {
        if (fileSystemService) {
            this.fileSystem = fileSystemService;
        }

        if (this.eventBus) {
            this.subscriptions.push(
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_START', (payload = {}) => this.start(payload).catch((error) => {
                    this.#handleError('start', error);
                })),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_STOP', () => {
                    this.stop().catch((error) => this.#handleError('stop', error));
                }),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_CANCEL', () => {
                    this.cancel();
                })
            );
        }
    }

    async requestPermission() {
        await this.streamGetter();
        return true;
    }

    async start(metadata = {}) {
        if (this.current && this.current.recorder && this.current.recorder.state === 'recording') {
            throw new Error('A recording is already in progress');
        }

        const stream = await this.streamGetter();
        if (!stream) {
            throw new Error('Unable to obtain microphone stream');
        }

        const recorder = this.recorderFactory(stream, { mimeType: this.options.mimeType });
        if (!recorder) {
            throw new Error('MediaRecorder is not supported in this environment');
        }

        const chunks = [];
        let resolveStop;
        let rejectStop;
        const stopPromise = new Promise((resolve, reject) => {
            resolveStop = resolve;
            rejectStop = reject;
        });

        recorder.ondataavailable = (event) => {
            if (event?.data && event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        recorder.onerror = (event) => {
            const error = event?.error || new Error('Unknown recorder error');
            this.#handleError('recording', error);
            rejectStop?.(error);
        };

        const recordingId = metadata.id || this.#generateId();

        recorder.onstop = async () => {
            try {
                const blob = new Blob(chunks, { type: this.options.mimeType });
                const duration = Date.now() - startedAt;
                let fileRecord = null;

                if (this.options.persistRecordings !== false && this.fileSystem?.store) {
                    fileRecord = await this.fileSystem.store(blob, {
                        id: recordingId,
                        title: metadata.title || `Recording ${new Date().toISOString()}`,
                        description: metadata.description || '',
                        tags: metadata.tags || ['audio'],
                        category: 'audio',
                        extra: { duration }
                    });
                }

                const payload = {
                    id: recordingId,
                    duration,
                    size: blob.size,
                    mimeType: blob.type,
                    metadata,
                    file: fileRecord
                };

                this.#publish('MEDIA_CAPTURE_STOPPED', payload);
                resolveStop?.({ ...payload, blob });
            } catch (error) {
                this.#handleError('stop', error);
                rejectStop?.(error);
            } finally {
                this.#cleanupStream();
            }
        };

        const startedAt = Date.now();
        this.current = {
            recorder,
            stream,
            chunks,
            metadata,
            recordingId,
            startedAt,
            stopPromise,
            resolveStop,
            rejectStop
        };

        recorder.start(this.options.timeslice);
        this.#publish('MEDIA_CAPTURE_STARTED', {
            id: recordingId,
            metadata,
            mimeType: this.options.mimeType,
            startedAt
        });

        return { id: recordingId, startedAt };
    }

    async stop(additionalMetadata = {}) {
        if (!this.current || !this.current.recorder) {
            throw new Error('No recording in progress');
        }

        Object.assign(this.current.metadata, additionalMetadata);
        this.current.recorder.stop();
        return this.current.stopPromise;
    }

    cancel() {
        if (!this.current) return;

        try {
            if (this.current.recorder?.state === 'recording') {
                this.current.recorder.stop();
            }
        } catch (error) {
            this.#handleError('cancel', error);
        } finally {
            this.#cleanupStream();
            this.#publish('MEDIA_CAPTURE_ERROR', {
                error: 'Recording cancelled',
                operation: 'cancel'
            });
        }
    }

    destroy() {
        this.cancel();
        this.subscriptions.forEach((unsubscribe) => unsubscribe && unsubscribe());
        this.subscriptions = [];
    }

    #cleanupStream() {
        if (this.current?.stream) {
            const tracks = this.current.stream.getTracks?.() || [];
            tracks.forEach((track) => track.stop());
        }
        this.current = null;
    }

    #defaultStreamGetter() {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            throw new Error('Media capture is not supported in this environment');
        }
        return navigator.mediaDevices.getUserMedia({ audio: true });
    }

    #defaultRecorderFactory(stream, options) {
        if (typeof MediaRecorder === 'undefined') {
            return null;
        }
        return new MediaRecorder(stream, options);
    }

    #publish(eventName, payload) {
        this.eventBus?.publish(eventName, payload);
    }

    #handleError(operation, error) {
        console.error('[MediaCapture]', operation, error);
        this.#publish('MEDIA_CAPTURE_ERROR', {
            error: error.message || String(error),
            operation
        });
    }

    #generateId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `recording-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
}
