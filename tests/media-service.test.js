/**
 * Media Service — unit tests
 * Tests codec registry, contract publishing, persistence opt-in/out,
 * tier detection, and service lifecycle with mocked dependencies.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaService } from '../src/modules/media/services/MediaService.js';

// Mock canvas APIs for jsdom
beforeEach(() => {
    if (!globalThis.OffscreenCanvas) {
        globalThis.OffscreenCanvas = class OffscreenCanvas {
            constructor(w, h) { this.width = w; this.height = h; }
            getContext() {
                return {
                    drawImage: vi.fn(),
                    fillRect: vi.fn(),
                    fillStyle: '',
                    save: vi.fn(),
                    restore: vi.fn(),
                    translate: vi.fn(),
                    scale: vi.fn(),
                    rotate: vi.fn()
                };
            }
            convertToBlob() {
                return Promise.resolve(new Blob([new Uint8Array(10)], { type: 'image/webp' }));
            }
        };
    }
    if (!globalThis.URL.createObjectURL) {
        globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
        globalThis.URL.revokeObjectURL = vi.fn();
    }
    if (!globalThis.createImageBitmap) {
        globalThis.createImageBitmap = vi.fn(async (blob) => ({
            width: 1, height: 1, close: vi.fn()
        }));
    }
});

// Mock EventBus
function createMockEventBus() {
    const handlers = {};
    return {
        subscribe: vi.fn((event, handler) => {
            handlers[event] = handler;
            return () => { delete handlers[event]; };
        }),
        publish: vi.fn(),
        _handlers: handlers
    };
}

// Mock file system
function createMockFileSystem() {
    return {
        store: vi.fn(async (blob, meta) => ({ id: meta.id, title: meta.title, size: blob.size }))
    };
}

describe('MediaService', () => {
    let service;
    let eventBus;
    let fileSystem;

    beforeEach(() => {
        eventBus = createMockEventBus();
        fileSystem = createMockFileSystem();
        service = new MediaService(eventBus, { fileSystem });
    });

    afterEach(() => {
        service.destroy();
    });

    describe('initialization', () => {
        it('registers built-in codecs', () => {
            service.init();
            expect(service.getCodec('image/webp')).toBeTruthy();
            expect(service.getCodec('image/jpeg')).toBeTruthy();
            expect(service.getCodec('image/png')).toBeTruthy();
        });

        it('detects tier', () => {
            service.init();
            expect(['tier1', 'tier2', 'tier3', 'none']).toContain(service.tier);
        });

        it('subscribes to EventBus intents', () => {
            service.init();
            const calls = eventBus.subscribe.mock.calls.map(c => c[0]);
            expect(calls).toContain('INTENT_MEDIA_CAPTURE_PHOTO');
            expect(calls).toContain('INTENT_MEDIA_CAPTURE_VIDEO_START');
            expect(calls).toContain('INTENT_MEDIA_CAPTURE_AUDIO_START');
            expect(calls).toContain('INTENT_MEDIA_TRANSFORM');
            expect(calls).toContain('INTENT_MEDIA_OPTIMIZE');
            expect(calls).toContain('INTENT_MEDIA_RESIZE');
        });

        it('subscribes to deprecated aliases', () => {
            service.init();
            const calls = eventBus.subscribe.mock.calls.map(c => c[0]);
            expect(calls).toContain('INTENT_CAMERA_CAPTURE_PHOTO');
            expect(calls).toContain('INTENT_MEDIA_CAPTURE_START');
            expect(calls).toContain('INTENT_IMAGE_OPTIMIZE');
        });

        it('works without fileSystem', () => {
            const noFsService = new MediaService(eventBus);
            noFsService.init();
            expect(noFsService.fileSystem).toBeNull();
            noFsService.destroy();
        });
    });

    describe('codec registry', () => {
        it('registers and retrieves codecs', () => {
            service.init();
            const codec = service.getCodec('image/webp');
            expect(codec).toBeTruthy();
            expect(codec.mimeType).toBe('image/webp');
        });

        it('returns null for unknown format', () => {
            service.init();
            expect(service.getCodec('image/avif')).toBeNull();
        });

        it('allows custom codec registration', () => {
            service.init();
            const customCodec = { mimeType: 'image/avif', encode: vi.fn(), decode: vi.fn() };
            service.registerCodec('image/avif', customCodec);
            expect(service.getCodec('image/avif')).toBe(customCodec);
        });
    });

    describe('transform', () => {
        it('throws if blob missing', async () => {
            service.init();
            await expect(service.transform({ format: 'image/webp' }))
                .rejects.toThrow('blob is required');
        });

        it('throws if format missing', async () => {
            service.init();
            await expect(service.transform({ blob: new Blob() }))
                .rejects.toThrow('format is required');
        });

        it('throws for unsupported format', async () => {
            service.init();
            await expect(service.transform({ blob: new Blob(), format: 'image/bmp' }))
                .rejects.toThrow('No codec registered');
        });

        it('publishes MEDIA_TRANSFORM_COMPLETED on success', async () => {
            service.init();
            // Mock blob that behaves like an image
            const blob = new Blob([new Uint8Array(10)], { type: 'image/png' });
            const result = await service.transform({
                blob,
                format: 'image/webp'
            });
            expect(result.blob).toBeTruthy();
            expect(result.metadata).toBeTruthy();
            expect(result.metadata.mimeType).toBe('image/webp');
            expect(eventBus.publish).toHaveBeenCalledWith('MEDIA_TRANSFORM_COMPLETED', expect.any(Object));
        });
    });

    describe('resize', () => {
        it('throws if blob missing', async () => {
            service.init();
            await expect(service.resize({}))
                .rejects.toThrow('blob is required');
        });

        it('publishes MEDIA_RESIZE_COMPLETED', async () => {
            service.init();
            const blob = new Blob([new Uint8Array(10)], { type: 'image/png' });
            const result = await service.resize({ blob, maxWidth: 50, maxHeight: 50 });
            expect(result.blob).toBeTruthy();
            expect(eventBus.publish).toHaveBeenCalledWith('MEDIA_RESIZE_COMPLETED', expect.any(Object));
        });
    });

    describe('optimize', () => {
        it('throws if blob missing', async () => {
            service.init();
            await expect(service.optimize({ targets: ['image/webp'] }))
                .rejects.toThrow('blob is required');
        });

        it('throws if targets empty', async () => {
            service.init();
            await expect(service.optimize({ blob: new Blob(), targets: [] }))
                .rejects.toThrow('targets must be non-empty');
        });

        it('produces multiple variants', async () => {
            service.init();
            const blob = new Blob([new Uint8Array(10)], { type: 'image/png' });
            const result = await service.optimize({
                blob,
                targets: ['image/webp', 'image/png']
            });
            expect(result.outputs).toHaveLength(2);
            expect(result.outputs[0].metadata.mimeType).toBe('image/webp');
            expect(result.outputs[1].metadata.mimeType).toBe('image/png');
            expect(result.summary.variants).toHaveLength(2);
            expect(eventBus.publish).toHaveBeenCalledWith('MEDIA_OPTIMIZE_COMPLETED', expect.any(Object));
        });

        it('persists variants when fileSystem provided', async () => {
            service.init();
            const blob = new Blob([new Uint8Array(10)], { type: 'image/png' });
            const result = await service.optimize({
                blob,
                targets: ['image/webp']
            });
            expect(fileSystem.store).toHaveBeenCalled();
            expect(result.outputs[0].file).toBeTruthy();
        });

        it('skips persistence when no fileSystem', async () => {
            const noFsService = new MediaService(eventBus);
            noFsService.init();
            const blob = new Blob([new Uint8Array(10)], { type: 'image/png' });
            const result = await noFsService.optimize({
                blob,
                targets: ['image/webp']
            });
            expect(result.outputs[0].file).toBeNull();
            noFsService.destroy();
        });
    });

    describe('recording state', () => {
        it('cancel with no active recording does not throw', () => {
            service.init();
            expect(() => service.cancel()).not.toThrow();
        });

        it('stopVideoCapture throws when no recording', async () => {
            service.init();
            await expect(service.stopVideoCapture())
                .rejects.toThrow('No video recording in progress');
        });

        it('stopAudioCapture throws when no recording', async () => {
            service.init();
            await expect(service.stopAudioCapture())
                .rejects.toThrow('No audio recording in progress');
        });

        it('stopScreenCapture throws when no recording', async () => {
            service.init();
            await expect(service.stopScreenCapture())
                .rejects.toThrow('No screen recording in progress');
        });
    });

    describe('destroy', () => {
        it('clears codecs and subscriptions', () => {
            service.init();
            service.destroy();
            expect(service.getCodec('image/webp')).toBeNull();
            expect(service.subscriptions).toHaveLength(0);
        });
    });
});

/**
 * Create a minimal valid 1×1 PNG blob for testing.
 * This is the smallest possible PNG: 1x1 white pixel.
 */
function createTestPngBlob() {
    // Minimal PNG: 8-byte signature + IHDR + IDAT + IEND
    // 1x1 RGBA white pixel, deflate compressed
    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk: 1x1, 8-bit RGBA
    const ihdrData = new Uint8Array(13);
    ihdrData[0] = 0; ihdrData[1] = 0; ihdrData[2] = 0; ihdrData[3] = 1; // width=1
    ihdrData[4] = 0; ihdrData[5] = 0; ihdrData[6] = 0; ihdrData[7] = 1; // height=1
    ihdrData[8] = 8;  // bit depth
    ihdrData[9] = 2;  // color type (RGB)
    ihdrData[10] = 0; // compression
    ihdrData[11] = 0; // filter
    ihdrData[12] = 0; // interlace
    const ihdr = createPngChunk('IHDR', ihdrData);

    // IDAT chunk: filter byte (0) + RGB pixel (255,255,255), deflate wrapped
    const rawData = new Uint8Array([0, 255, 255, 255]);
    // Wrap in zlib (CMF=0x78, FLG=0x01, deflate stored block, adler32)
    const cmf = 0x78;
    const flg = 0x01;
    // Stored block: BFINAL=1, BTYPE=00 (no compression)
    const len = rawData.length;
    const nlen = ~len & 0xFFFF;
    const storedBlock = new Uint8Array([1, len & 0xFF, (len >> 8) & 0xFF, nlen & 0xFF, (nlen >> 8) & 0xFF]);
    // Adler32 of rawData
    const adler = adler32(rawData);
    const adlerBytes = new Uint8Array([
        (adler >> 24) & 0xFF, (adler >> 16) & 0xFF,
        (adler >> 8) & 0xFF, adler & 0xFF
    ]);
    const idatData = new Uint8Array(2 + storedBlock.length + rawData.length + 4);
    idatData[0] = cmf;
    idatData[1] = flg;
    idatData.set(storedBlock, 2);
    idatData.set(rawData, 2 + storedBlock.length);
    idatData.set(adlerBytes, 2 + storedBlock.length + rawData.length);
    const idat = createPngChunk('IDAT', idatData);

    // IEND chunk
    const iend = createPngChunk('IEND', new Uint8Array(0));

    // Combine
    const total = signature.length + ihdr.length + idat.length + iend.length;
    const png = new Uint8Array(total);
    let offset = 0;
    png.set(signature, offset); offset += signature.length;
    png.set(ihdr, offset); offset += ihdr.length;
    png.set(idat, offset); offset += idat.length;
    png.set(iend, offset);

    return new Blob([png], { type: 'image/png' });
}

function createPngChunk(type, data) {
    const length = new Uint8Array(4);
    const dv = new DataView(length.buffer);
    dv.setUint32(0, data.length);

    const typeBytes = new Uint8Array(Array.from(type).map(c => c.charCodeAt(0)));
    const crcInput = new Uint8Array(4 + data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(data, 4);
    const crc = crc32(crcInput);
    const crcBytes = new Uint8Array([(crc >> 24) & 0xFF, (crc >> 16) & 0xFF, (crc >> 8) & 0xFF, crc & 0xFF]);

    const chunk = new Uint8Array(4 + 4 + data.length + 4);
    chunk.set(length, 0);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    chunk.set(crcBytes, 8 + data.length);
    return chunk;
}

function adler32(data) {
    let a = 1, b = 0;
    for (let i = 0; i < data.length; i++) {
        a = (a + data[i]) % 65521;
        b = (b + a) % 65521;
    }
    return (b << 16) | a;
}

function crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
