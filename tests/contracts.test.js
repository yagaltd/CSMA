/**
 * Contract Tests
 * Validate all event schemas
 */
import { describe, it, expect } from 'vitest';
import { Contracts } from '../src/runtime/Contracts.js';

const moduleLoaders = [
    ['camera', () => import('../src/modules/camera/index.js')],
    ['media-capture', () => import('../src/modules/media-capture/index.js')],
    ['location', () => import('../src/modules/location/index.js')],
    ['media-transform', () => import('../src/modules/media-transform/index.js')],
    ['image-optimizer', () => import('../src/modules/image-optimizer/index.js')],
    ['network-status', () => import('../src/modules/network-status/index.js')],
    ['sync-queue', () => import('../src/modules/sync-queue/index.js')],
    ['form-management', () => import('../src/modules/form-management/index.js')],
    ['modal-system', () => import('../src/modules/modal-system/index.js')],
    ['auth-ui', () => import('../src/modules/auth-ui/index.js')],
    ['data-table', () => import('../src/modules/data-table/index.js')],
    ['checkout', () => import('../src/modules/checkout/index.js')],
    ['search', () => import('../src/modules/search/index.js')],
    ['analytics-consent', () => import('../src/modules/analytics-consent/index.js')],
    ['ai', () => import('../src/modules/ai/index.js')],
    ['file-system', () => import('../src/modules/file-system/index.js')],
    ['example-module', () => import('../src/modules/example-module/index.js')]
];

const loadedManifests = await Promise.all(
    moduleLoaders.map(async ([name, loader]) => {
        try {
            const mod = await loader();
            return [name, mod.manifest];
        } catch {
            return [name, null];
        }
    })
);

describe('Contract Validation', () => {
    describe('ITEM_SAVED', () => {
        it('should validate correct payload', () => {
            const payload = {
                version: 1,
                id: 'test-123',
                title: 'Test Item',
                description: 'Test description',
                status: 'pending',
                priority: 'high',
                timestamp: Date.now()
            };

            const [error, validated] = Contracts.ITEM_SAVED.schema.validate(payload);
            expect(error).toBeUndefined();
            expect(validated).toEqual(payload);
        });

        it('should reject invalid status', () => {
            const payload = {
                version: 1,
                id: 'test-123',
                title: 'Test',
                status: 'invalid-status', // Invalid!
                timestamp: Date.now()
            };

            const [error] = Contracts.ITEM_SAVED.schema.validate(payload);
            expect(error).toBeDefined();
        });

        it('should reject missing required fields', () => {
            const payload = {
                title: 'Test'
                // Missing: version, id, status, timestamp
            };

            const [error] = Contracts.ITEM_SAVED.schema.validate(payload);
            expect(error).toBeDefined();
        });
    });

    describe('THEME_CHANGED', () => {
        it('should validate correct theme', () => {
            const payload = { theme: 'dark' };
            const [error, validated] = Contracts.THEME_CHANGED.schema.validate(payload);
            expect(error).toBeUndefined();
            expect(validated.theme).toBe('dark');
        });

        it('should reject invalid theme', () => {
            const payload = { theme: 'blue' }; // Only 'light' or 'dark' allowed
            const [error] = Contracts.THEME_CHANGED.schema.validate(payload);
            expect(error).toBeDefined();
        });
    });

    describe('PAGE_CHANGED', () => {
        it('should validate correct meta', () => {
            const payload = {
                title: 'Test Page',
                description: 'Test description',
                image: 'https://example.com/image.jpg',
                locale: 'en'
            };

            const [error, validated] = Contracts.PAGE_CHANGED.schema.validate(payload);
            expect(error).toBeUndefined();
        });

        it('should enforce title length limit', () => {
            const payload = {
                title: 'a'.repeat(100), // Too long! Max 60 chars
                description: 'Test'
            };

            const [error] = Contracts.PAGE_CHANGED.schema.validate(payload);
            expect(error).toBeDefined();
        });
    });
});

describe('Module contract registration', () => {
    const modules = loadedManifests.filter(([, manifest]) => manifest?.contracts?.length);

    modules.forEach(([name, manifest]) => {
        it(`includes ${name} module contracts`, () => {
            for (const contractName of manifest.contracts) {
                expect(Contracts).toHaveProperty(contractName);
            }
        });
    });
});
