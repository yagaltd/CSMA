// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/runtime/EventBus.js';
import { createFileUploadService } from '../src/modules/file-upload/services/FileUploadService.js';
import { createFileUploadService as createLegacyFileUploadService } from '../src/modules/file-upload/services/FileUploadService.js';
import { FileUploadContracts } from '../src/modules/file-upload/contracts/file-upload-contracts.js';

function createMemoryStorage() {
    const data = new Map();

    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
        clear() {
            data.clear();
        },
        has(key) {
            return data.has(key);
        },
        get(key) {
            return data.get(key);
        }
    };
}

function createEventCapture(eventBus, names) {
    const events = [];
    const cleanups = names.map((name) => eventBus.subscribe(name, (payload) => {
        events.push({ name, payload });
    }));

    return {
        events,
        stop() {
            cleanups.forEach((cleanup) => cleanup?.());
        }
    };
}

function abortError() {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
}

async function waitFor(predicate, timeoutMs = 1000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (predicate()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error('Timed out waiting for condition');
}

describe('file upload contracts', () => {
    it('accepts the canonical upload intent and rejects incomplete pause payloads', () => {
        const [intentError] = FileUploadContracts.INTENT_FILE_UPLOAD.schema.validate({
            file: { name: 'demo.txt', size: 12, type: 'text/plain' },
            timestamp: Date.now()
        });
        expect(intentError).toBeUndefined();

        const [pauseError] = FileUploadContracts.INTENT_FILE_UPLOAD_PAUSE.schema.validate({
            timestamp: Date.now()
        });
        expect(pauseError).toBeDefined();
    });
});

describe('FileUploadService', () => {
    let eventBus;

    beforeEach(() => {
        eventBus = new EventBus();
        eventBus.contracts = FileUploadContracts;
    });

    afterEach(() => {
        eventBus?.clear?.();
    });

    it('validates files and falls back to the one-shot transport when chunking is unavailable', async () => {
        const storage = createMemoryStorage();
        const transport = {
            uploadFile: vi.fn(async () => ({ uploaded: true, mode: 'one-shot' }))
        };
        const service = createFileUploadService(eventBus, { storage, transport });
        await service.ready;

        const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
        expect(service.validateFile(file, { maxFileSize: 1024, allowedTypes: ['text'] }).valid).toBe(true);

        const capture = createEventCapture(eventBus, [
            'FILE_UPLOAD_STARTED',
            'FILE_UPLOAD_PROGRESS',
            'FILE_UPLOAD_COMPLETED'
        ]);

        const result = await service.uploadFile(file, { fileId: 'one-shot-file' });

        expect(transport.uploadFile).toHaveBeenCalledTimes(1);
        expect(result.status).toBe('completed');
        expect(result.result.mode).toBe('one-shot');
        expect(capture.events.some((entry) => entry.name === 'FILE_UPLOAD_PROGRESS')).toBe(true);
        expect(capture.events.at(0).name).toBe('FILE_UPLOAD_STARTED');
        expect(capture.events.at(-1).name).toBe('FILE_UPLOAD_COMPLETED');
        capture.stop();
    });

    it('uploads sequential chunks and publishes progress after each acknowledged chunk', async () => {
        const storage = createMemoryStorage();
        const transport = {
            uploadChunk: vi.fn(async ({ chunkIndex }) => ({
                acknowledged: true,
                chunkIndex,
                transport: 'chunked'
            }))
        };
        const service = createFileUploadService(eventBus, {
            storage,
            transport,
            chunkSize: 3
        });
        await service.ready;

        const file = new File(['abcdefghi'], 'chunked.txt', { type: 'text/plain' });
        const capture = createEventCapture(eventBus, [
            'FILE_UPLOAD_STARTED',
            'FILE_UPLOAD_PROGRESS',
            'FILE_UPLOAD_COMPLETED'
        ]);

        const result = await service.uploadFile(file, { fileId: 'chunked-upload' });

        expect(result.status).toBe('completed');
        expect(result.result.transport).toBe('chunked');
        expect(transport.uploadChunk).toHaveBeenCalledTimes(3);
        expect(capture.events.filter((entry) => entry.name === 'FILE_UPLOAD_PROGRESS').map((entry) => entry.payload.progress)).toEqual([33, 67, 100]);
        capture.stop();
    });

    it('requests an upload grant once and passes it to chunk transports', async () => {
        const storage = createMemoryStorage();
        const transport = {
            uploadChunk: vi.fn(async ({ uploadGrantId, chunkIndex }) => ({
                acknowledged: true,
                chunkIndex,
                uploadGrantId
            }))
        };
        const captchaService = {
            getToken: vi.fn(() => ''),
            execute: vi.fn(() => 'captcha-token')
        };
        const grantFetch = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                grant: {
                    grantId: 'grant-123',
                    expiresAt: 123456
                }
            })
        }));
        const originalFetch = global.fetch;
        global.fetch = grantFetch;
        const service = createFileUploadService(eventBus, {
            storage,
            transport,
            captchaService,
            chunkSize: 3,
            uploadGrant: {
                required: true,
                endpoint: '/media/upload-grants',
                captcha: { formId: 'upload-captcha', action: 'upload' }
            }
        });
        await service.ready;

        try {
            const file = new File(['abcdef'], 'grant.txt', { type: 'text/plain' });
            const result = await service.uploadFile(file, { fileId: 'grant-upload' });

            expect(result.status).toBe('completed');
            expect(captchaService.execute).toHaveBeenCalledWith({
                formId: 'upload-captcha',
                action: 'upload'
            });
            expect(grantFetch).toHaveBeenCalledTimes(1);
            expect(JSON.parse(grantFetch.mock.calls[0][1].body)).toEqual(expect.objectContaining({
                fileId: 'grant-upload',
                fileName: 'grant.txt',
                fileSize: 6,
                fileType: 'text/plain',
                captchaToken: 'captcha-token'
            }));
            expect(transport.uploadChunk).toHaveBeenCalledTimes(2);
            expect(transport.uploadChunk.mock.calls.map(([payload]) => payload.uploadGrantId)).toEqual(['grant-123', 'grant-123']);
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('persists checkpoints after acknowledged chunks and resumes from the saved offset', async () => {
        const storage = createMemoryStorage();
        let callCount = 0;
        const transport = {
            uploadChunk: vi.fn(({ signal, chunkIndex }) => {
                callCount += 1;
                if (callCount === 1) {
                    return Promise.resolve({
                        acknowledged: true,
                        chunkIndex,
                        transport: 'chunked'
                    });
                }

                if (callCount === 2) {
                    return new Promise((resolve, reject) => {
                        signal?.addEventListener('abort', () => reject(abortError()), { once: true });
                    });
                }

                return Promise.resolve({
                    acknowledged: true,
                    chunkIndex,
                    transport: 'chunked'
                });
            })
        };
        const service = createFileUploadService(eventBus, {
            storage,
            transport,
            chunkSize: 3
        });
        await service.ready;

        const fileId = 'resumable-upload';
        const file = new File(['abcdefghi'], 'resume.txt', { type: 'text/plain' });
        const uploadPromise = service.uploadFile(file, { fileId });

        await waitFor(() => transport.uploadChunk.mock.calls.length >= 2);
        const pausedState = service.pause(fileId, 'manual');
        expect(pausedState.status).toBe('paused');

        const pausedResult = await uploadPromise;
        expect(pausedResult.status).toBe('paused');

        const checkpoint = JSON.parse(storage.getItem(`csma.file-upload.checkpoints:${fileId}`));
        expect(checkpoint.nextOffset).toBe(3);

        const resumedResult = await service.resume(fileId);
        expect(resumedResult.status).toBe('completed');
        expect(transport.uploadChunk).toHaveBeenCalledTimes(4);
        expect(service.getState(fileId).status).toBe('completed');
    });

    it('cancels an in-flight upload and clears persisted checkpoint state', async () => {
        const storage = createMemoryStorage();
        const transport = {
            uploadChunk: vi.fn(({ signal, chunkIndex }) => {
                if (chunkIndex === 0) {
                    return Promise.resolve({
                        acknowledged: true,
                        chunkIndex,
                        transport: 'chunked'
                    });
                }

                return new Promise((resolve, reject) => {
                    signal?.addEventListener('abort', () => reject(abortError()), { once: true });
                });
            })
        };
        const service = createFileUploadService(eventBus, {
            storage,
            transport,
            chunkSize: 3
        });
        await service.ready;

        const fileId = 'cancelled-upload';
        const file = new File(['abcdefghi'], 'cancel.txt', { type: 'text/plain' });
        const uploadPromise = service.uploadFile(file, { fileId });

        await waitFor(() => transport.uploadChunk.mock.calls.length >= 2);
        const cancelledState = service.cancel(fileId, 'manual');
        expect(cancelledState.status).toBe('cancelled');

        const finalState = await uploadPromise;
        expect(finalState.status).toBe('cancelled');
        expect(storage.getItem(`csma.file-upload.checkpoints:${fileId}`)).toBeNull();
        expect(service.getState(fileId).status).toBe('cancelled');
    });

    it('keeps the legacy shim delegated to the module service', async () => {
        const storage = createMemoryStorage();
        const transport = {
            uploadFile: vi.fn(async () => ({ uploaded: true, mode: 'one-shot' }))
        };
        const legacyService = createLegacyFileUploadService(eventBus, { storage, transport });
        await legacyService.ready;

        const file = new File(['legacy'], 'legacy.txt', { type: 'text/plain' });
        const result = await legacyService.uploadFile(file, { fileId: 'legacy-upload' });

        expect(result.status).toBe('completed');
        expect(result.result.mode).toBe('one-shot');
        expect(typeof legacyService.pause).toBe('function');
        expect(typeof legacyService.resume).toBe('function');
        expect(typeof legacyService.cancel).toBe('function');
    });
});
