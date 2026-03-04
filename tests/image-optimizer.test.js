import './helpers/storage-polyfill.js';
import { describe, it, expect, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { ImageOptimizerService } from '../src/modules/image-optimizer/services/ImageOptimizerService.js';

describe('ImageOptimizerService', () => {
    it('creates optimized variants via media transform', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        const transform = {
            transform: vi.fn(async ({ blob, format }) => ({
                blob: new Blob([blob], { type: format }),
                metadata: { size: blob.size, mimeType: format }
            }))
        };
        const service = new ImageOptimizerService(eventBus, {
            mediaTransform: transform,
            fileSystem: null,
            targets: ['image/webp']
        });
        const { outputs } = await service.optimize({ blob: new Blob(['img'], { type: 'image/png' }) });
        expect(outputs).toHaveLength(1);
        expect(outputs[0].metadata.mimeType).toBe('image/webp');
    });
});
