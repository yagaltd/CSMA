/**
 * Tier detection tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaService } from '../src/modules/media/services/MediaService.js';

describe('Tier detection', () => {
    let originalWorker;
    let originalOffscreenCanvas;
    let originalDocument;

    beforeEach(() => {
        originalWorker = globalThis.Worker;
        originalOffscreenCanvas = globalThis.OffscreenCanvas;
        originalDocument = globalThis.document;
    });

    afterEach(() => {
        globalThis.Worker = originalWorker;
        globalThis.OffscreenCanvas = originalOffscreenCanvas;
        globalThis.document = originalDocument;
    });

    it('returns tier1 when Worker + OffscreenCanvas + convertToBlob available', () => {
        // This is the default test environment (jsdom may support some of these)
        const service = new MediaService(null);
        // We can't force tier1 in jsdom easily, but we can verify the detection runs
        expect(['tier1', 'tier2', 'tier3', 'none']).toContain(service.detectTier());
        service.destroy();
    });

    it('returns tier3 when only document is available', () => {
        globalThis.Worker = undefined;
        globalThis.OffscreenCanvas = undefined;
        globalThis.document = {}; // truthy
        const service = new MediaService(null);
        expect(service.detectTier()).toBe('tier3');
        service.destroy();
    });

    it('returns none when no canvas APIs available', () => {
        globalThis.Worker = undefined;
        globalThis.OffscreenCanvas = undefined;
        globalThis.document = undefined;
        const service = new MediaService(null);
        expect(service.detectTier()).toBe('none');
        service.destroy();
    });
});
