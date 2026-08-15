/**
 * MediaService — unified capture + transform + persist.
 *
 * Capture:  photo, video, audio, screen
 * Transform: single format encode, multi-variant optimize, resize
 * Persist:   optional, via file-system (only when provided)
 */

import { WebpCodec } from '../codecs/WebpCodec.js';
import { uid } from '../../../utils/id.js';
import { JpegCodec } from '../codecs/JpegCodec.js';
import { PngCodec } from '../codecs/PngCodec.js';
import { CanvasCodec } from '../codecs/CanvasCodec.js';
import { blobToImageSource, canvasToBlob } from '../codecs/utils/BlobUtils.js';
import { acquireCanvas, releaseCanvas } from '../codecs/utils/CanvasPool.js';
import { calculateDimensions } from '../codecs/resize/CanvasResize.js';

const DEFAULT_OPTIONS = {
    photoMimeType: 'image/webp',
    videoMimeType: 'video/webm;codecs=vp9,opus',
    audioMimeType: 'audio/webm;codecs=opus',
    persistCaptures: true,
    workerTimeout: 60000
};

export class MediaService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.fileSystem = options.fileSystem || null;

        // Codec registry
        this.codecs = new Map();

        // Recording state
        this.recordingState = null;

        // Worker (lazy)
        this.worker = null;
        this.workerBusy = false;

        // Tier detection
        this.tier = null;

        // EventBus subscriptions
        this.subscriptions = [];
    }

    init({ fileSystemService } = {}) {
        if (fileSystemService) {
            this.fileSystem = fileSystemService;
        }

        this.tier = this.detectTier();

        // Register built-in browser codecs
        this.registerCodec('image/webp', new WebpCodec());
        this.registerCodec('image/jpeg', new JpegCodec());
        this.registerCodec('image/png', new PngCodec());

        // Subscribe to EventBus intents
        if (this.eventBus) {
            this.subscriptions.push(
                // Capture
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_PHOTO', (p = {}) =>
                    this.capturePhoto(p).catch((e) => this.#handleError('photo', e))),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_VIDEO_START', (p = {}) =>
                    this.startVideoCapture(p).catch((e) => this.#handleError('video-start', e))),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_VIDEO_STOP', () =>
                    this.stopVideoCapture().catch((e) => this.#handleError('video-stop', e))),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_AUDIO_START', (p = {}) =>
                    this.startAudioCapture(p).catch((e) => this.#handleError('audio-start', e))),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_AUDIO_STOP', () =>
                    this.stopAudioCapture().catch((e) => this.#handleError('audio-stop', e))),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_SCREEN_START', (p = {}) =>
                    this.startScreenCapture(p).catch((e) => this.#handleError('screen-start', e))),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_SCREEN_STOP', () =>
                    this.stopScreenCapture().catch((e) => this.#handleError('screen-stop', e))),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_CANCEL', () => this.cancel()),
                // Transform
                this.eventBus.subscribe('INTENT_MEDIA_TRANSFORM', (p = {}) =>
                    this.transform(p).catch((e) => this.#handleError('transform', e))),
                this.eventBus.subscribe('INTENT_MEDIA_OPTIMIZE', (p = {}) =>
                    this.optimize(p).catch((e) => this.#handleError('optimize', e))),
                this.eventBus.subscribe('INTENT_MEDIA_RESIZE', (p = {}) =>
                    this.resize(p).catch((e) => this.#handleError('resize', e))),
                // Deprecated aliases
                this.eventBus.subscribe('INTENT_CAMERA_CAPTURE_PHOTO', (p = {}) =>
                    this.capturePhoto(p).catch((e) => this.#handleError('photo', e))),
                this.eventBus.subscribe('INTENT_CAMERA_CAPTURE_VIDEO_START', (p = {}) =>
                    this.startVideoCapture(p).catch((e) => this.#handleError('video-start', e))),
                this.eventBus.subscribe('INTENT_CAMERA_CAPTURE_VIDEO_STOP', () =>
                    this.stopVideoCapture().catch((e) => this.#handleError('video-stop', e))),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_START', (p = {}) =>
                    this.startAudioCapture(p).catch((e) => this.#handleError('audio-start', e))),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_STOP', () =>
                    this.stopAudioCapture().catch((e) => this.#handleError('audio-stop', e))),
                this.eventBus.subscribe('INTENT_MEDIA_CAPTURE_CANCEL', () => this.cancel()),
                this.eventBus.subscribe('INTENT_IMAGE_OPTIMIZE', (p = {}) =>
                    this.optimize(p).catch((e) => this.#handleError('optimize', e)))
            );
        }
    }

    // ─── Tier Detection ────────────────────────────────────

    detectTier() {
        // Tier 1: Worker + OffscreenCanvas + convertToBlob
        if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
            try {
                const c = new OffscreenCanvas(1, 1);
                if (typeof c.convertToBlob === 'function') return 'tier1';
            } catch (_) { /* fall through */ }
        }
        // Tier 2: Main thread + OffscreenCanvas + convertToBlob
        if (typeof OffscreenCanvas !== 'undefined') {
            try {
                const c = new OffscreenCanvas(1, 1);
                if (typeof c.convertToBlob === 'function') return 'tier2';
            } catch (_) { /* fall through */ }
        }
        // Tier 3: Main thread + HTMLCanvasElement + toDataURL
        if (typeof document !== 'undefined') return 'tier3';
        return 'none';
    }

    // ─── Codec Registry ────────────────────────────────────

    registerCodec(mimeType, codec) {
        this.codecs.set(mimeType, codec);
    }

    getCodec(mimeType) {
        return this.codecs.get(mimeType) || null;
    }

    // ─── Capture ───────────────────────────────────────────

    async capturePhoto(metadata = {}) {
        const captureId = metadata.id || this.#generateId('photo');

        const blob = await this.#capturePhotoAdapter({ mimeType: this.options.photoMimeType });
        if (!blob) throw new Error('Camera did not return photo data');

        const fileRecord = await this.#persist(blob, {
            id: captureId,
            title: metadata.title || `Photo ${new Date().toISOString()}`,
            description: metadata.description || '',
            tags: metadata.tags || ['photo'],
            category: 'photos'
        });

        const payload = {
            id: captureId,
            type: 'photo',
            size: blob.size,
            mimeType: blob.type,
            metadata,
            file: fileRecord
        };

        this.#publish('MEDIA_CAPTURE_COMPLETED', payload);
        return { ...payload, blob };
    }

    async startVideoCapture(metadata = {}) {
        return this.#startRecording('video', metadata, {
            mediaConstraints: { video: true, audio: true },
            mimeType: this.options.videoMimeType
        });
    }

    async stopVideoCapture(additionalMetadata = {}) {
        return this.#stopRecording('video', additionalMetadata);
    }

    async startAudioCapture(metadata = {}) {
        return this.#startRecording('audio', metadata, {
            mediaConstraints: { audio: true },
            mimeType: this.options.audioMimeType
        });
    }

    async stopAudioCapture(additionalMetadata = {}) {
        return this.#stopRecording('audio', additionalMetadata);
    }

    async startScreenCapture(metadata = {}) {
        const audio = metadata.audio !== false;
        return this.#startRecording('screen', metadata, {
            displayMedia: true,
            mediaConstraints: { audio },
            mimeType: this.options.videoMimeType
        });
    }

    async stopScreenCapture(additionalMetadata = {}) {
        return this.#stopRecording('screen', additionalMetadata);
    }

    cancel() {
        if (this.recordingState) {
            try {
                if (this.recordingState.recorder?.state === 'recording') {
                    this.recordingState.recorder.stop();
                }
            } catch (_) { /* ignore */ }
            this.#cleanupStream(this.recordingState.stream);
            this.recordingState = null;
            this.#publish('MEDIA_CAPTURE_ERROR', { error: 'Recording cancelled', operation: 'cancel' });
        }
    }

    async requestPermission(type = 'photo') {
        switch (type) {
            case 'photo':
                return true; // file picker doesn't need permission
            case 'video':
                await navigator.mediaDevices.getUserMedia({ video: true });
                return true;
            case 'audio':
                await navigator.mediaDevices.getUserMedia({ audio: true });
                return true;
            case 'screen':
                await navigator.mediaDevices.getDisplayMedia({ video: true });
                return true;
            default:
                throw new Error(`Unknown permission type: ${type}`);
        }
    }

    // ─── Transform ─────────────────────────────────────────

    async transform({ blob, format, quality, resize } = {}) {
        if (!blob) throw new Error('blob is required');
        if (!format) throw new Error('format is required');

        const codec = this.getCodec(format);
        if (!codec) throw new Error(`No codec registered for ${format}`);

        let result;

        // Tier 1: Worker path
        if (this.tier === 'tier1' && !this.workerBusy) {
            try {
                result = await this.#transformViaWorker(blob, format, quality, resize);
            } catch (_) {
                // Worker failed — fall back to main thread
                result = await codec.encode(blob, { quality, resize });
            }
        } else {
            // Tier 2/3: Main thread
            result = await codec.encode(blob, { quality, resize });
        }

        this.#publish('MEDIA_TRANSFORM_COMPLETED', {
            mimeType: result.metadata.mimeType,
            size: result.metadata.size,
            width: result.metadata.width,
            height: result.metadata.height,
            originalWidth: result.metadata.originalWidth,
            originalHeight: result.metadata.originalHeight
        });

        return result;
    }

    async optimize({ blob, targets = [], quality, resize, metadata = {} } = {}) {
        if (!blob) throw new Error('blob is required');
        if (!targets.length) throw new Error('targets must be non-empty');

        const outputs = [];
        for (const format of targets) {
            const result = await this.transform({ blob, format, quality, resize });
            const fileRecord = await this.#persist(result.blob, {
                title: metadata.title || `Optimized ${format}`,
                tags: metadata.tags || ['optimized'],
                category: 'optimized',
                extra: result.metadata
            });
            outputs.push({ ...result, file: fileRecord });
        }

        const summary = {
            originalSize: blob.size,
            variants: outputs.map((o) => ({
                mimeType: o.metadata.mimeType,
                size: o.metadata.size,
                width: o.metadata.width,
                height: o.metadata.height
            }))
        };

        this.#publish('MEDIA_OPTIMIZE_COMPLETED', summary);
        return { outputs, summary };
    }

    async resize({ blob, width, height, maxWidth, maxHeight, maintainAspect = true } = {}) {
        if (!blob) throw new Error('blob is required');

        const source = await blobToImageSource(blob);
        const sourceW = source.width;
        const sourceH = source.height;

        const dims = calculateDimensions(sourceW, sourceH, {
            width, height, maxWidth, maxHeight, maintainAspect
        });

        const { canvas, ctx } = acquireCanvas(dims.width, dims.height);
        ctx.drawImage(source, 0, 0, dims.width, dims.height);

        // Use original type or default to webp
        const mimeType = blob.type || 'image/webp';
        const encoded = await canvasToBlob(canvas, mimeType, 0.85);

        releaseCanvas(canvas);
        if (source.close) source.close();

        const result = {
            blob: encoded,
            metadata: {
                width: dims.width,
                height: dims.height,
                originalWidth: sourceW,
                originalHeight: sourceH,
                mimeType: encoded.type,
                size: encoded.size
            }
        };

        this.#publish('MEDIA_RESIZE_COMPLETED', result.metadata);
        return result;
    }

    // ─── Worker Management ─────────────────────────────────

    async #getWorker() {
        if (this.worker) return this.worker;

        this.worker = new Worker(
            new URL('../workers/transform-worker.js', import.meta.url),
            { type: 'module' }
        );

        return this.worker;
    }

    async #transformViaWorker(blob, format, quality, resize) {
        const worker = await this.#getWorker();
        this.workerBusy = true;

        const ab = await blob.arrayBuffer();

        return new Promise((resolve, reject) => {
            worker.onmessage = (event) => {
                this.workerBusy = false;
                if (event.data.error) {
                    reject(new Error(event.data.error));
                    return;
                }
                const { ab: resultAb, type, metadata } = event.data;
                resolve({
                    blob: new Blob([resultAb], { type }),
                    metadata
                });
            };

            worker.onerror = (event) => {
                this.workerBusy = false;
                reject(new Error(event.message || 'Worker error'));
            };

            worker.postMessage(
                { ab, type: blob.type, format, quality, resize },
                [ab]
            );
        });
    }

    // ─── Recording Internals ───────────────────────────────

    async #startRecording(type, metadata = {}, config = {}) {
        if (this.recordingState) {
            throw new Error(`Recording already in progress (${this.recordingState.type})`);
        }

        const captureId = metadata.id || this.#generateId(type);
        let stream;

        if (config.displayMedia) {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                throw new Error('Screen capture not supported');
            }
            stream = await navigator.mediaDevices.getDisplayMedia(config.mediaConstraints);
        } else {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('MediaDevices API unavailable');
            }
            stream = await navigator.mediaDevices.getUserMedia(config.mediaConstraints);
        }

        if (typeof MediaRecorder === 'undefined') {
            this.#cleanupStream(stream);
            throw new Error('MediaRecorder not supported');
        }

        // Pick best supported MIME type
        const mimeType = this.#pickMimeType(config.mimeType);
        const recorder = new MediaRecorder(stream, { mimeType });

        const chunks = [];
        recorder.ondataavailable = (event) => {
            if (event?.data?.size) chunks.push(event.data);
        };
        recorder.onerror = (event) => {
            this.#handleError(type, event.error || new Error('Recorder error'));
        };

        recorder.start(1000); // timeslice 1s for progress
        this.recordingState = {
            id: captureId,
            type,
            metadata,
            recorder,
            stream,
            chunks,
            mimeType,
            startedAt: Date.now()
        };

        this.#publish('MEDIA_CAPTURE_STARTED', {
            id: captureId,
            type,
            metadata,
            mimeType,
            startedAt: this.recordingState.startedAt
        });

        return { id: captureId };
    }

    async #stopRecording(type, additionalMetadata = {}) {
        if (!this.recordingState || this.recordingState.type !== type) {
            throw new Error(`No ${type} recording in progress`);
        }

        const current = this.recordingState;
        this.recordingState = null;
        Object.assign(current.metadata, additionalMetadata);

        return new Promise((resolve, reject) => {
            current.recorder.onstop = async () => {
                try {
                    const blob = new Blob(current.chunks, { type: current.mimeType });
                    const duration = Date.now() - current.startedAt;

                    const fileRecord = await this.#persist(blob, {
                        id: current.id,
                        title: current.metadata.title || `${type} ${new Date().toISOString()}`,
                        description: current.metadata.description || '',
                        tags: current.metadata.tags || [type],
                        category: `${type}s`,
                        extra: { duration }
                    });

                    const payload = {
                        id: current.id,
                        type,
                        size: blob.size,
                        duration,
                        mimeType: blob.type,
                        metadata: current.metadata,
                        file: fileRecord
                    };

                    this.#publish('MEDIA_CAPTURE_COMPLETED', payload);
                    this.#cleanupStream(current.stream);
                    resolve({ ...payload, blob });
                } catch (error) {
                    this.#cleanupStream(current.stream);
                    this.#handleError(`${type}-stop`, error);
                    reject(error);
                }
            };

            current.recorder.stop();
        });
    }

    #pickMimeType(preferred) {
        if (typeof MediaRecorder === 'undefined') return preferred;
        if (MediaRecorder.isTypeSupported(preferred)) return preferred;

        // Fallback chain for video
        const fallbacks = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'audio/webm;codecs=opus',
            'audio/webm'
        ];

        for (const mime of fallbacks) {
            if (MediaRecorder.isTypeSupported(mime)) return mime;
        }

        return preferred;
    }

    // ─── Photo Adapter ─────────────────────────────────────

    async #capturePhotoAdapter({ mimeType }) {
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
    }

    // ─── Persistence (optional) ────────────────────────────

    async #persist(blob, metadata) {
        if (!this.options.persistCaptures || !this.fileSystem?.store) {
            return null;
        }
        return this.fileSystem.store(blob, metadata);
    }

    // ─── Utilities ─────────────────────────────────────────

    #cleanupStream(stream) {
        const tracks = stream?.getTracks?.() || [];
        tracks.forEach((track) => track.stop());
    }

    #handleError(operation, error) {
        console.error('[Media]', operation, error);
        const transformOps = ['transform', 'optimize', 'resize'];
        const eventName = transformOps.includes(operation)
            ? 'MEDIA_TRANSFORM_ERROR'
            : 'MEDIA_CAPTURE_ERROR';
        this.#publish(eventName, {
            error: error.message || String(error),
            operation
        });
    }

    #publish(eventName, payload) {
        this.eventBus?.publish(eventName, payload);
    }

    #generateId(prefix) {
        return uid(prefix);
    }

    destroy() {
        this.cancel();

        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        this.subscriptions.forEach((unsub) => unsub && unsub());
        this.subscriptions = [];
        this.codecs.clear();
    }
}
