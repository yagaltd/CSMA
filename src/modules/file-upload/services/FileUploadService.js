import { uid } from '../../../utils/id.js';
import { snapshot, snapshotFromCheckpoint, startedPayload, progressPayload, completedPayload, failedPayload, pausedPayload, resumedPayload, cancelledPayload } from './uploadPayloads.js';
import { CheckpointPersistence } from './adapters/CheckpointPersistence.js';

const DEFAULT_OPTIONS = {
    chunkSize: 64 * 1024,
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: [],
    resumable: true,
    persistKey: 'csma.file-upload.checkpoints',
    checkpointStore: 'file-upload-checkpoints'
};

function isFileLike(value) {
    return !!value && typeof value === 'object' && typeof value.name === 'string' && typeof value.size === 'number';
}

function isBlobLike(value) {
    return !!value && typeof value === 'object' && typeof value.slice === 'function' && typeof value.size === 'number';
}

function isAbortError(error) {
    return error?.name === 'AbortError' || error?.code === 'ABORT_ERR' || error?.message === 'AbortError';
}



export class FileUploadService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.storage = options.storage || null;
        this.fileSystem = options.fileSystem || null;
        this.transport = options.transport || options.uploadTransport || options.uploader || null;
        this.captchaService = options.captchaService || options.captcha || null;
        this.grantProvider = options.grantProvider || options.uploadGrantProvider || null;
        this.networkStatus = options.networkStatus || null;
        this.syncQueue = options.syncQueue || null;
        this.initialized = false;
        this.ready = null;
        this.uploads = new Map();
        this.subscriptions = [];
        this._syncQueueRegistered = false;
        this._persistReady = null;
        this.persistence = new CheckpointPersistence(this);
    }

    async init(options = {}) {
        if (this.initialized) {
            return this;
        }

        this.options = { ...this.options, ...options };
        this.storage = options.storage || this.storage;
        this.fileSystem = options.fileSystem || this.fileSystem;
        this.transport = options.transport || options.uploadTransport || options.uploader || this.transport;
        this.captchaService = options.captchaService || options.captcha || this.captchaService;
        this.grantProvider = options.grantProvider || options.uploadGrantProvider || this.grantProvider;
        this.networkStatus = options.networkStatus || this.networkStatus;
        this.syncQueue = options.syncQueue || this.syncQueue;

        await this._preparePersistence();
        this._bindIntentHandlers();
        this.initialized = true;
        return this;
    }

    async upload(fileOrPayload, options = {}) {
        return this.uploadFile(fileOrPayload, options);
    }

    async uploadFile(fileOrPayload, options = {}) {
        await this._ensureReady();

        const { file, options: mergedOptions } = this._normalizeInput(fileOrPayload, options);
        const validation = this.validateFile(file, mergedOptions);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const fileId = mergedOptions.fileId || this._generateId();
        const existing = this.uploads.get(fileId);
        const session = existing || this._createSession(fileId, file, mergedOptions);
        session.file = file;
        session.fileName = file.name;
        session.fileSize = file.size;
        session.fileType = file.type || 'application/octet-stream';
        session.options = { ...session.options, ...mergedOptions };
        session.chunkSize = this._resolveChunkSize(session.options.chunkSize);
        session.resumable = this._supportsResumable(session);
        session.status = session.status === 'completed' ? 'queued' : 'uploading';
        session.error = null;
        session.updatedAt = Date.now();
        session.attempts = (session.attempts || 0) + 1;
        session.controller = this._createController();
        this.uploads.set(fileId, session);

        const shouldQueue = this._shouldDeferToSyncQueue(session);
        if (shouldQueue) {
            await this._prepareCheckpointArtifacts(session);
            this._publish('FILE_UPLOAD_STARTED', this._startedPayload(session));
            this._queueUpload(session);
            session.status = 'queued';
            await this._persistCheckpoint(session);
            return this.getState(fileId);
        }

        await this._prepareCheckpointArtifacts(session);
        await this._ensureUploadGrant(session);
        this._publish('FILE_UPLOAD_STARTED', this._startedPayload(session));

        try {
            const result = session.resumable
                ? await this._runChunkedUpload(session)
                : await this._runOneShotUpload(session);
            return result;
        } catch (error) {
            if (session.status === 'paused' || session.status === 'cancelled') {
                return this.getState(fileId);
            }

            session.status = 'failed';
            session.error = error;
            this._publish('FILE_UPLOAD_FAILED', this._failedPayload(session, error));
            throw error;
        }
    }

    async uploadFiles(files, options = {}) {
        return Promise.all(Array.from(files || []).map((file) => this.uploadFile(file, options)));
    }

    pause(fileId, reason = 'manual') {
        const session = this.uploads.get(fileId);
        if (!session || session.status === 'completed' || session.status === 'cancelled') {
            return this.getState(fileId);
        }

        session.status = 'paused';
        session.pauseReason = reason;
        session.updatedAt = Date.now();
        session.controller?.abort?.();
        this._persistCheckpoint(session).catch(() => null);
        return this.getState(fileId);
    }

    async resume(fileId, options = {}) {
        await this._ensureReady();
        let session = this.uploads.get(fileId);

        if (!session) {
            const checkpoint = await this._readCheckpoint(fileId);
            if (!checkpoint) {
                throw new Error(`Upload ${fileId} not found`);
            }

            const file = options.file || await this._restoreSource(checkpoint);
            if (!file) {
                throw new Error('Upload source unavailable');
            }

            session = this._createSession(fileId, file, {
                ...checkpoint.options,
                ...options,
                fileId
            });
            session.checkpoint = checkpoint;
            session.sourceRef = checkpoint.sourceRef || null;
            session.loaded = checkpoint.loaded || checkpoint.nextOffset || 0;
            session.progress = checkpoint.progress || this._progressFor(session.loaded, checkpoint.total || file.size);
            session.status = checkpoint.status || 'paused';
            session.resumable = true;
            this.uploads.set(fileId, session);
        } else if (options.file) {
            session.file = options.file;
        }

        if (!session.file) {
            session.file = await this._restoreSource(session.checkpoint || session);
        }

        if (!session.file) {
            throw new Error('Upload source unavailable');
        }

        session.status = 'uploading';
        session.error = null;
        session.pauseReason = null;
        session.cancelReason = null;
        session.updatedAt = Date.now();
        session.attempts = (session.attempts || 0) + 1;
        session.controller = this._createController();
        this._publish('FILE_UPLOAD_RESUMED', this._resumedPayload(session, options.reason));
        await this._ensureUploadGrant(session);
        return session.resumable ? this._runChunkedUpload(session) : this._runOneShotUpload(session);
    }

    async retry(fileId, options = {}) {
        const session = this.uploads.get(fileId);
        const attempt = (session?.attempts || 0) + 1;
        this._publish('FILE_UPLOAD_RETRIED', {
            fileId,
            timestamp: Date.now(),
            attempt,
            reason: options.reason
        });
        return this.resume(fileId, options);
    }

    cancel(fileId, reason = 'manual') {
        const session = this.uploads.get(fileId);
        if (!session || session.status === 'completed' || session.status === 'cancelled') {
            return this.getState(fileId);
        }

        session.status = 'cancelled';
        session.cancelReason = reason;
        session.cancelNotified = true;
        session.updatedAt = Date.now();
        session.controller?.abort?.();
        this._clearCheckpoint(fileId).catch(() => null);
        this._publish('FILE_UPLOAD_CANCELLED', this._cancelledPayload(session, reason));
        return this.getState(fileId);
    }

    async remove(fileId) {
        const session = this.uploads.get(fileId);
        if (session) {
            session.status = 'removed';
            session.updatedAt = Date.now();
            session.controller?.abort?.();
        }

        await this._clearCheckpoint(fileId);
        this.uploads.delete(fileId);
        this._publish('FILE_REMOVED', {
            fileId,
            timestamp: Date.now()
        });
        return true;
    }

    removeFile(fileId) {
        return this.remove(fileId);
    }

    getState(fileId) {
        if (fileId) {
            const session = this.uploads.get(fileId);
            if (session) {
                return this._snapshot(session);
            }
            const checkpoint = this._checkpointFromMemory(fileId);
            return checkpoint ? this._snapshotFromCheckpoint(checkpoint) : null;
        }

        return {
            initialized: this.initialized,
            resumable: this._hasCheckpointBackend(),
            uploads: Array.from(this.uploads.values()).map((session) => this._snapshot(session))
        };
    }

    validateFile(file, constraints = {}) {
        if (!isFileLike(file) && !isBlobLike(file)) {
            return {
                valid: false,
                error: 'A file-like object is required'
            };
        }

        const maxFileSize = constraints.maxFileSize ?? this.options.maxFileSize;
        const allowedTypes = constraints.allowedTypes ?? this.options.allowedTypes;

        if (maxFileSize && file.size > maxFileSize) {
            return {
                valid: false,
                error: `File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`
            };
        }

        if (allowedTypes && allowedTypes.length > 0) {
            const fileExtension = (file.name || '').split('.').pop().toLowerCase();
            const isAllowed = allowedTypes.some((type) => {
                if (type.startsWith('.')) {
                    return fileExtension === type.slice(1);
                }

                if (type.includes('/')) {
                    return (file.type || '') === type;
                }

                return (file.type || '').startsWith(`${type}/`);
            });

            if (!isAllowed) {
                return {
                    valid: false,
                    error: `File type not allowed. Allowed: ${allowedTypes.join(', ')}`
                };
            }
        }

        return { valid: true };
    }

    destroy() {
        this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
        for (const session of this.uploads.values()) {
            session.controller?.abort?.();
        }
        this.uploads.clear();
        this.initialized = false;
        this._syncQueueRegistered = false;
    }

    async _ensureReady() {
        if (!this.initialized) {
            if (!this.ready) {
                this.ready = this.init();
            }
            await this.ready;
        }
    }

async _preparePersistence() {
        // Delegated to CheckpointPersistence (Phase 6.5 extraction).
        return this.persistence.init();
    }

    _bindIntentHandlers() {
        if (!this.eventBus?.subscribe) {
            return;
        }

        this.subscriptions.push(
            this.eventBus.subscribe('INTENT_FILE_UPLOAD', (payload) => {
                if (!payload?.file) return;
                return this.uploadFile(payload.file, payload.options || {});
            }),
            this.eventBus.subscribe('INTENT_FILE_UPLOAD_PAUSE', (payload) => this.pause(payload.fileId, payload.reason)),
            this.eventBus.subscribe('INTENT_FILE_UPLOAD_RESUME', (payload) => this.resume(payload.fileId, { reason: payload.reason })),
            this.eventBus.subscribe('INTENT_FILE_UPLOAD_CANCEL', (payload) => this.cancel(payload.fileId, payload.reason)),
            this.eventBus.subscribe('INTENT_FILE_UPLOAD_RETRY', (payload) => this.retry(payload.fileId, { reason: payload.reason }))
        );

        if (this.syncQueue?.registerProcessor && !this._syncQueueRegistered) {
            this.syncQueue.registerProcessor('FILE_UPLOAD', async (payload = {}) => {
                const fileId = payload.fileId || payload.id;
                if (!fileId) return null;
                return this.resume(fileId, { reason: 'sync-queue' });
            });
            this._syncQueueRegistered = true;
        }
    }

    _normalizeInput(fileOrPayload, options = {}) {
        if (fileOrPayload && typeof fileOrPayload === 'object' && 'file' in fileOrPayload && !isFileLike(fileOrPayload)) {
            return {
                file: fileOrPayload.file,
                options: {
                    ...this.options,
                    ...(fileOrPayload.options || {}),
                    ...options
                }
            };
        }

        return {
            file: fileOrPayload,
            options: {
                ...this.options,
                ...options
            }
        };
    }

    _createSession(fileId, file, options) {
        return {
            fileId,
            file,
            fileName: file?.name || `file-${fileId}`,
            fileSize: file?.size || 0,
            fileType: file?.type || 'application/octet-stream',
            options: { ...options },
            attempts: 0,
            loaded: 0,
            total: file?.size || 0,
            progress: 0,
            chunkSize: this._resolveChunkSize(options.chunkSize),
            status: 'pending',
            resumable: false,
            controller: null,
            checkpoint: null,
            sourceRef: null,
            error: null,
            result: null,
            updatedAt: Date.now(),
            createdAt: Date.now()
        };
    }

    async _ensureUploadGrant(session) {
        const grantConfig = session.options.uploadGrant || this.options.uploadGrant || {};
        if (!grantConfig?.required && !session.options.requireUploadGrant) {
            return null;
        }
        if (session.uploadGrant?.grantId || session.options.uploadGrantToken) {
            session.uploadGrant = session.uploadGrant || { grantId: session.options.uploadGrantToken };
            return session.uploadGrant;
        }

        const metadata = {
            fileId: session.fileId,
            fileName: session.fileName,
            fileSize: session.fileSize,
            fileType: session.fileType
        };

        let grant = null;
        const provider = session.options.grantProvider || this.grantProvider;
        if (typeof provider === 'function') {
            grant = await provider({ file: session.file, ...metadata, options: session.options });
        } else if (provider?.requestGrant) {
            grant = await provider.requestGrant({ file: session.file, ...metadata, options: session.options });
        } else {
            grant = await this._requestUploadGrant({ grantConfig, metadata, session });
        }

        const grantId = typeof grant === 'string' ? grant : grant?.grantId || grant?.id || grant?.token;
        if (!grantId) {
            throw new Error('Upload grant is required');
        }

        session.uploadGrant = {
            ...(typeof grant === 'object' && grant ? grant : {}),
            grantId
        };
        return session.uploadGrant;
    }

    async _requestUploadGrant({ grantConfig, metadata, session }) {
        const endpoint = grantConfig.endpoint || this.options.uploadGrantEndpoint;
        if (!endpoint) {
            throw new Error('Upload grant endpoint is required');
        }

        const captcha = grantConfig.captcha || {};
        let captchaToken = grantConfig.captchaToken || session.options.captchaToken || '';
        if (!captchaToken && this.captchaService?.getToken) {
            captchaToken = await this.captchaService.getToken({ formId: captcha.formId || session.fileId });
        }
        if (!captchaToken && this.captchaService?.execute) {
            captchaToken = await this.captchaService.execute({
                formId: captcha.formId || session.fileId,
                action: captcha.action || 'upload'
            });
        }
        if (!captchaToken) {
            throw new Error('Upload CAPTCHA verification is required');
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...(grantConfig.headers || {})
            },
            credentials: grantConfig.credentials || 'same-origin',
            body: JSON.stringify({
                ...metadata,
                captchaToken,
                meta: grantConfig.meta || {}
            }),
            signal: session.controller?.signal || undefined
        });

        if (!response.ok) {
            throw new Error(`Upload grant request failed: ${response.status}`);
        }

        const body = await response.json();
        return body.grant || body.uploadGrant || body;
    }

    _resolveChunkSize(value) {
        const size = Number(value || this.options.chunkSize);
        return Number.isFinite(size) && size > 0 ? size : DEFAULT_OPTIONS.chunkSize;
    }

    _supportsChunkTransport() {
        return !!(this.transport && (
            typeof this.transport.uploadChunk === 'function' ||
            typeof this.transport.sendChunk === 'function' ||
            typeof this.transport.appendChunk === 'function'
        ));
    }

    _supportsOneShotTransport() {
        return !!(this.transport && (
            typeof this.transport.uploadFile === 'function' ||
            typeof this.transport.send === 'function' ||
            typeof this.transport.request === 'function'
        ));
    }

    _hasCheckpointBackend() {
        return !!(
            this.storage?.getItem ||
            this.storage?.get ||
            this.fileSystem?.store ||
            this.fileSystem?.retrieve
        );
    }

    _supportsResumable(session) {
        return session.options.resumable !== false && this._hasCheckpointBackend() && this._supportsChunkTransport();
    }

    _shouldDeferToSyncQueue(session) {
        return !!(this._isOffline() && this.syncQueue?.enqueue && session.options.deferOffline !== false);
    }

    _isOffline() {
        if (typeof this.networkStatus?.online === 'boolean') {
            return this.networkStatus.online === false;
        }

        if (typeof this.networkStatus?.isOnline === 'function') {
            return this.networkStatus.isOnline() === false;
        }

        return false;
    }

    _queueUpload(session) {
        this.syncQueue?.enqueue?.({
            id: session.fileId,
            type: 'FILE_UPLOAD',
            payload: {
                fileId: session.fileId,
                reason: 'offline'
            }
        });
    }

    async _prepareCheckpointArtifacts(session) {
        if (!session.resumable) {
            return;
        }

        if (!session.sourceRef) {
            await this._storeSource(session);
        }

        await this._persistCheckpoint(session);
    }

async _storeSource(session) {
        // Delegated to CheckpointPersistence (Phase 6.5 extraction).
        return this.persistence.storeSource(session);
    }

async _restoreSource(checkpoint) {
        // Delegated to CheckpointPersistence (Phase 6.5 extraction).
        return this.persistence.restoreSource(checkpoint);
    }

async _persistCheckpoint(session) {
        // Delegated to CheckpointPersistence (Phase 6.5 extraction).
        return this.persistence.persistCheckpoint(session);
    }

async _readCheckpoint(fileId) {
        // Delegated to CheckpointPersistence (Phase 6.5 extraction).
        return this.persistence.readCheckpoint(fileId);
    }

async _clearCheckpoint(fileId) {
        // Delegated to CheckpointPersistence (Phase 6.5 extraction).
        return this.persistence.clearCheckpoint(fileId);
    }

    _checkpointFromMemory(fileId) {
        const session = this.uploads.get(fileId);
        return session?.checkpoint || null;
    }

    _checkpointPayload(session) {
        const total = session.total || session.fileSize || 0;
        return {
            fileId: session.fileId,
            fileName: session.fileName,
            fileSize: session.fileSize,
            fileType: session.fileType,
            chunkSize: session.chunkSize,
            loaded: session.loaded || 0,
            nextOffset: session.loaded || 0,
            total,
            totalChunks: Math.max(1, Math.ceil(total / session.chunkSize)),
            progress: this._progressFor(session.loaded || 0, total),
            status: session.status,
            attempts: session.attempts || 0,
            sourceRef: session.sourceRef || null,
            options: this._checkpointOptions(session.options),
            updatedAt: Date.now()
        };
    }

    _checkpointOptions(options = {}) {
        return {
            fileId: options.fileId || undefined,
            chunkSize: this._resolveChunkSize(options.chunkSize),
            resumable: options.resumable !== false,
            deferOffline: options.deferOffline !== false
        };
    }

    _snapshot(session) {
        return snapshot(session);
    }

    _snapshotFromCheckpoint(checkpoint) {
        return snapshotFromCheckpoint(checkpoint);
    }

    _startedPayload(session) {
        return startedPayload(session);
    }

    _progressPayload(session) {
        return progressPayload(session);
    }

    _completedPayload(session, result) {
        return completedPayload(session, result);
    }

    _failedPayload(session, error) {
        return failedPayload(session, error);
    }

    _pausedPayload(session, reason) {
        return pausedPayload(session, reason);
    }

    _resumedPayload(session, reason) {
        return resumedPayload(session, reason);
    }

    _cancelledPayload(session, reason) {
        return cancelledPayload(session, reason);
    }

    _publish(eventName, payload) {
        if (typeof this.eventBus?.publishSync === 'function') {
            this.eventBus.publishSync(eventName, payload);
            return;
        }

        this.eventBus?.publish?.(eventName, payload);
    }

    async _runChunkedUpload(session) {
        if (!session.resumable) {
            return this._runOneShotUpload(session);
        }

        let offset = session.checkpoint?.nextOffset || session.loaded || 0;
        const total = session.fileSize || session.file?.size || 0;
        const totalChunks = Math.max(1, Math.ceil(total / session.chunkSize));
        let lastResult = session.result || null;

        while (offset < total) {
            if (session.status === 'cancelled') {
                await this._clearCheckpoint(session.fileId);
                if (!session.cancelNotified) {
                    this._publish('FILE_UPLOAD_CANCELLED', this._cancelledPayload(session));
                    session.cancelNotified = true;
                }
                return this.getState(session.fileId);
            }

            if (session.status === 'paused') {
                session.loaded = offset;
                session.total = total;
                session.progress = this._progressFor(offset, total);
                session.checkpoint = {
                    ...this._checkpointPayload(session),
                    nextOffset: offset
                };
                await this._persistCheckpoint(session);
                this._publish('FILE_UPLOAD_PAUSED', this._pausedPayload(session));
                return this.getState(session.fileId);
            }

            if (this._isOffline()) {
                if (this.syncQueue?.enqueue) {
                    session.status = 'queued';
                    session.loaded = offset;
                    session.total = total;
                    session.progress = this._progressFor(offset, total);
                    await this._persistCheckpoint(session);
                    this._queueUpload(session);
                    return this.getState(session.fileId);
                }

                throw new Error('Network offline');
            }

            const chunk = session.file.slice(offset, Math.min(offset + session.chunkSize, total));
            const chunkIndex = Math.floor(offset / session.chunkSize);
            session.loaded = offset;
            session.total = total;
            session.progress = this._progressFor(offset, total);

            try {
                lastResult = await this._sendChunk(session, {
                    chunk,
                    chunkIndex,
                    totalChunks,
                    offset,
                    total
                });
            } catch (error) {
                if (session.status === 'cancelled') {
                    await this._clearCheckpoint(session.fileId);
                    if (!session.cancelNotified) {
                        this._publish('FILE_UPLOAD_CANCELLED', this._cancelledPayload(session));
                        session.cancelNotified = true;
                    }
                    return this.getState(session.fileId);
                }

                if (session.status === 'paused' || isAbortError(error)) {
                    session.status = 'paused';
                    session.loaded = offset;
                    session.total = total;
                    session.progress = this._progressFor(offset, total);
                    session.checkpoint = {
                        ...this._checkpointPayload(session),
                        nextOffset: offset
                    };
                    await this._persistCheckpoint(session);
                    this._publish('FILE_UPLOAD_PAUSED', this._pausedPayload(session));
                    return this.getState(session.fileId);
                }

                throw error;
            }

            offset = Math.min(total, offset + Math.max(chunk.size || 0, 0));
            session.loaded = offset;
            session.total = total;
            session.progress = this._progressFor(offset, total);
            session.checkpoint = {
                ...this._checkpointPayload(session),
                nextOffset: offset
            };
            await this._persistCheckpoint(session);
            this._publish('FILE_UPLOAD_PROGRESS', this._progressPayload(session));
        }

        session.status = 'completed';
        session.result = this._normalizeResult(lastResult, { mode: 'chunked', fileId: session.fileId });
        session.loaded = total;
        session.total = total;
        session.progress = 100;
        session.updatedAt = Date.now();
        await this._clearCheckpoint(session.fileId);
        session.checkpoint = null;
        session.sourceRef = null;
        session.resumable = false;
        this._publish('FILE_UPLOAD_COMPLETED', this._completedPayload(session, session.result));
        return {
            fileId: session.fileId,
            result: session.result,
            previewUrl: null,
            status: session.status
        };
    }

    async _runOneShotUpload(session) {
        let result = null;

        if (this._supportsOneShotTransport()) {
            const payload = {
                fileId: session.fileId,
                file: session.file,
                fileName: session.fileName,
                fileSize: session.fileSize,
                fileType: session.fileType,
                uploadGrant: session.uploadGrant || null,
                uploadGrantId: session.uploadGrant?.grantId || session.options.uploadGrantToken || undefined,
                signal: session.controller?.signal || undefined
            };

            if (typeof this.transport.uploadFile === 'function') {
                result = await this.transport.uploadFile(payload);
            } else if (typeof this.transport.send === 'function') {
                result = await this.transport.send(payload);
            } else if (typeof this.transport.request === 'function') {
                result = await this.transport.request(payload);
            }
        } else {
            result = {
                uploaded: true,
                mode: 'local',
                fileId: session.fileId
            };
        }

        session.status = 'completed';
        session.loaded = session.total;
        session.progress = 100;
        session.result = this._normalizeResult(result, { mode: 'one-shot', fileId: session.fileId });
        session.updatedAt = Date.now();
        await this._clearCheckpoint(session.fileId);
        session.checkpoint = null;
        session.sourceRef = null;
        session.resumable = false;
        this._publish('FILE_UPLOAD_PROGRESS', this._progressPayload(session));
        this._publish('FILE_UPLOAD_COMPLETED', this._completedPayload(session, session.result));
        return {
            fileId: session.fileId,
            result: session.result,
            previewUrl: null,
            status: session.status
        };
    }

    async _sendChunk(session, details) {
        const payload = {
            fileId: session.fileId,
            fileName: session.fileName,
            fileSize: session.fileSize,
            fileType: session.fileType,
            uploadGrant: session.uploadGrant || null,
            uploadGrantId: session.uploadGrant?.grantId || session.options.uploadGrantToken || undefined,
            chunk: details.chunk,
            chunkIndex: details.chunkIndex,
            totalChunks: details.totalChunks,
            offset: details.offset,
            total: details.total,
            signal: session.controller?.signal || undefined
        };

        if (typeof this.transport?.uploadChunk === 'function') {
            return this.transport.uploadChunk(payload);
        }

        if (typeof this.transport?.sendChunk === 'function') {
            return this.transport.sendChunk(payload);
        }

        if (typeof this.transport?.appendChunk === 'function') {
            return this.transport.appendChunk(payload);
        }

        return {
            acknowledged: true,
            fileId: session.fileId,
            chunkIndex: details.chunkIndex
        };
    }

    _normalizeResult(result, fallback = {}) {
        if (result && typeof result === 'object') {
            return { ...fallback, ...result };
        }

        return { ...fallback, uploaded: true };
    }

    _progressFor(loaded, total) {
        if (!total) return 100;
        return Math.min(100, Math.round((loaded / total) * 100));
    }

    _storageKey(fileId) {
        return `${this.options.persistKey}:${fileId}`;
    }

    _checkpointRef(fileId) {
        return `${this.options.persistKey}:${fileId}`;
    }

    _sourceRef(fileId) {
        return `${this.options.persistKey}:${fileId}:source`;
    }

    _generateId() {
        return uid('file');
    }

    _createController() {
        if (typeof AbortController !== 'undefined') {
            return new AbortController();
        }

        return {
            signal: { aborted: false, addEventListener() {} },
            abort() {
                this.signal.aborted = true;
            }
        };
    }

    async _readText(value) {
        if (!value) return '';
        if (typeof value.text === 'function') {
            return value.text();
        }
        if (typeof value === 'string') {
            return value;
        }
        if (value.file && typeof value.file.text === 'function') {
            return value.file.text();
        }
        return '';
    }
}

export function createFileUploadService(eventBus, options = {}) {
    const service = new FileUploadService(eventBus, options);
    service.ready = service.init(options);
    return service;
}
