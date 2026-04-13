import { extractBasicMetadata } from '../utils/ExifParser.js';

const DEFAULT_OPTIONS = {
    photoMimeType: 'image/webp',
    videoMimeType: 'video/webm;codecs=vp9,opus',
    persistCaptures: true
};

export class CameraService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.fileSystem = options.fileSystem || null;
        this.platformAdapter = options.platformAdapter || this.#createDefaultAdapter();
        this.videoRecorder = null;
        this.subscriptions = [];
        this.recordingState = null;
    }

    init({ fileSystemService } = {}) {
        if (fileSystemService) {
            this.fileSystem = fileSystemService;
        }

        if (this.eventBus) {
            this.subscriptions.push(
                this.eventBus.subscribe('INTENT_CAMERA_CAPTURE_PHOTO', (payload = {}) => {
                    return this.capturePhoto(payload).catch((error) => this.#handleError('photo', error));
                }),
                this.eventBus.subscribe('INTENT_CAMERA_CAPTURE_VIDEO_START', (payload = {}) => {
                    return this.startVideoCapture(payload).catch((error) => this.#handleError('video-start', error));
                }),
                this.eventBus.subscribe('INTENT_CAMERA_CAPTURE_VIDEO_STOP', () => {
                    return this.stopVideoCapture().catch((error) => this.#handleError('video-stop', error));
                })
            );
        }
    }

    async capturePhoto(metadata = {}) {
        const captureId = metadata.id || this.#generateId('photo');

        try {
            const blob = await this.platformAdapter.capturePhoto({ mimeType: this.options.photoMimeType });
            if (!blob) {
                throw new Error('Camera did not return photo data');
            }

            const fileRecord = await this.#persistCapture(blob, {
                id: captureId,
                title: metadata.title || `Photo ${new Date().toISOString()}`,
                description: metadata.description || '',
                tags: metadata.tags || ['photo'],
                category: 'photos',
                extra: extractBasicMetadata(blob)
            });

            const payload = {
                id: captureId,
                type: 'photo',
                size: blob.size,
                mimeType: blob.type,
                metadata,
                file: fileRecord
            };

            this.#publish('CAMERA_CAPTURE_COMPLETED', payload);
            return { ...payload, blob };
        } catch (error) {
            this.#handleError('photo', error);
            throw error;
        }
    }

    async startVideoCapture(metadata = {}) {
        if (this.recordingState) {
            throw new Error('Video recording already in progress');
        }

        const captureId = metadata.id || this.#generateId('video');
        const { stream, recorder } = await this.platformAdapter.startVideo({
            mimeType: this.options.videoMimeType
        });

        if (!recorder) {
            throw new Error('Video recorder unavailable');
        }

        const chunks = [];
        recorder.ondataavailable = (event) => {
            if (event?.data?.size) {
                chunks.push(event.data);
            }
        };

        recorder.onerror = (event) => {
            this.#handleError('video', event.error || new Error('Recorder error'));
        };

        recorder.start();
        this.recordingState = {
            id: captureId,
            metadata,
            recorder,
            stream,
            chunks,
            startedAt: Date.now()
        };
        return { id: captureId };
    }

    async stopVideoCapture() {
        if (!this.recordingState) {
            throw new Error('No video recording in progress');
        }

        const current = this.recordingState;
        this.recordingState = null;

        return new Promise((resolve, reject) => {
            current.recorder.onstop = async () => {
                try {
                    const blob = new Blob(current.chunks, { type: this.options.videoMimeType });
                    const duration = Date.now() - current.startedAt;
                    const fileRecord = await this.#persistCapture(blob, {
                        id: current.id,
                        title: current.metadata.title || `Video ${new Date().toISOString()}`,
                        description: current.metadata.description || '',
                        tags: current.metadata.tags || ['video'],
                        category: 'videos',
                        extra: { duration }
                    });

                    const payload = {
                        id: current.id,
                        type: 'video',
                        size: blob.size,
                        duration,
                        mimeType: blob.type,
                        metadata: current.metadata,
                        file: fileRecord
                    };

                    this.#publish('CAMERA_CAPTURE_COMPLETED', payload);
                    this.#cleanupStream(current.stream);
                    resolve({ ...payload, blob });
                } catch (error) {
                    this.#cleanupStream(current.stream);
                    this.#handleError('video-stop', error);
                    reject(error);
                }
            };

            current.recorder.stop();
        });
    }

    cancel() {
        if (this.recordingState) {
            this.recordingState.recorder.stop();
            this.#cleanupStream(this.recordingState.stream);
            this.recordingState = null;
        }
    }

    destroy() {
        this.cancel();
        this.subscriptions.forEach((unsubscribe) => unsubscribe && unsubscribe());
        this.subscriptions = [];
    }

    async #persistCapture(blob, metadata) {
        if (!this.options.persistCaptures || !this.fileSystem?.store) {
            return null;
        }
        return this.fileSystem.store(blob, metadata);
    }

    #cleanupStream(stream) {
        const tracks = stream?.getTracks?.() || [];
        tracks.forEach((track) => track.stop());
    }

    #handleError(operation, error) {
        console.error('[Camera]', operation, error);
        this.#publish('CAMERA_CAPTURE_ERROR', {
            error: error.message || String(error),
            operation
        });
    }

    #publish(eventName, payload) {
        this.eventBus?.publish(eventName, payload);
    }

    #generateId(prefix) {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    #createDefaultAdapter() {
        return {
            capturePhoto: async ({ mimeType }) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.capture = 'environment';

                return new Promise((resolve, reject) => {
                    input.onchange = () => {
                        const file = input.files?.[0];
                        if (!file) {
                            reject(new Error('No photo selected'));
                            return;
                        }
                        resolve(file);
                    };
                    input.onerror = () => reject(new Error('Camera capture failed'));
                    input.click();
                });
            },
            startVideo: async ({ mimeType }) => {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('MediaDevices API unavailable');
                }
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                const recorder = typeof MediaRecorder !== 'undefined' ? new MediaRecorder(stream, { mimeType }) : null;
                return { stream, recorder };
            }
        };
    }
}
