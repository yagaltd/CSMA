import './helpers/storage-polyfill.js';
import { describe, it, expect, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { MediaTransformService } from '../src/modules/media-transform/services/MediaTransformService.js';

describe('MediaTransformService', () => {
    it('returns transformed blob metadata via custom adapter', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        const adapter = vi.fn(async (blob) => new Blob([blob], { type: 'image/webp' }));
        const service = new MediaTransformService(eventBus, {
            adapters: { default: adapter }
        });
        const { metadata } = await service.transform({ blob: new Blob(['a'], { type: 'image/png' }), format: 'image/webp' });
        expect(metadata.mimeType).toBe('image/webp');
        expect(adapter).toHaveBeenCalledOnce();
    });
});
