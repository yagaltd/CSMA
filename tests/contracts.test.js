/**
 * Contract Tests
 * Validate all event schemas
 */
import { describe, it, expect } from 'vitest';
import { Contracts } from '../src/runtime/Contracts.js';

const moduleLoaders = [
    ['auth', () => import('../src/modules/auth/index.js')],
    ['auth-ui', () => import('../src/modules/auth-ui/index.js')],
    ['analytics', () => import('../src/modules/analytics/index.js')],
    ['consent', () => import('../src/modules/consent/index.js')],
    ['notifications', () => import('../src/modules/notifications/index.js')],
    ['media', () => import('../src/modules/media/index.js')],
    ['location', () => import('../src/modules/location/index.js')],
    ['network-status', () => import('../src/modules/network-status/index.js')],
    ['sync-queue', () => import('../src/modules/sync-queue/index.js')],
    ['form-management', () => import('../src/modules/form-management/index.js')],
    ['modal-system', () => import('../src/modules/modal-system/index.js')],
    ['data-table', () => import('../src/modules/data-table/index.js')],
    ['checkout', () => import('../src/modules/checkout/index.js')],
    ['search', () => import('../src/modules/search/index.js')],
    ['ai', () => import('../src/modules/ai/index.js')],
    ['file-system', () => import('../src/modules/file-system/index.js')],
    ['file-upload', () => import('../src/modules/file-upload/index.js')],
    ['share', () => import('../src/modules/share/index.js')],
    ['captcha', () => import('../src/modules/captcha/index.js')],
    ['router', () => import('../src/modules/router/index.js')]
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
                locale: 'en-US',
                alternates: [
                    { locale: 'en-US', href: 'https://example.com/en/test' },
                    { locale: 'fr-FR', href: 'https://example.com/fr/test' }
                ]
            };

            const [error, validated] = Contracts.PAGE_CHANGED.schema.validate(payload);
            expect(error).toBeUndefined();
            expect(validated.locale).toBe('en-US');
            expect(validated.alternates).toHaveLength(2);
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

    describe('Command contracts', () => {
        it('validates INTENT_COMMAND_EXECUTE with canonical payload shape', () => {
            const payload = {
                commandId: 'search.query',
                payload: { query: 'csma' },
                source: 'ai',
                timestamp: Date.now()
            };

            const [error, validated] = Contracts.INTENT_COMMAND_EXECUTE.schema.validate(payload);
            expect(error).toBeUndefined();
            expect(validated.commandId).toBe('search.query');
            expect(validated.source).toBe('ai');
        });

        it('rejects INTENT_COMMAND_EXECUTE without commandId', () => {
            const [error] = Contracts.INTENT_COMMAND_EXECUTE.schema.validate({
                payload: { query: 'csma' },
                timestamp: Date.now()
            });

            expect(error).toBeDefined();
        });

        it('validates COMMAND_RESULTS_UPDATED with registry-backed result entries', () => {
            const payload = {
                query: 'hello',
                results: [
                    {
                        id: 'example-module.say-hello',
                        title: 'Example: Say Hello',
                        group: 'examples',
                        shortcut: 'Cmd+H',
                        score: 200
                    }
                ],
                timestamp: Date.now()
            };

            const [error, validated] = Contracts.COMMAND_RESULTS_UPDATED.schema.validate(payload);
            expect(error).toBeUndefined();
            expect(validated.results[0].title).toBe('Example: Say Hello');
        });
    });

    describe('View contracts', () => {
        it('validates INTENT_VIEW_RENDER with canonical payload shape', () => {
            const payload = {
                viewId: 'example-module.status-card',
                target: '#example-output',
                props: {
                    title: 'Status',
                    message: 'Hello'
                },
                state: {
                    tone: 'info'
                },
                source: 'ai',
                timestamp: Date.now()
            };

            const [error, validated] = Contracts.INTENT_VIEW_RENDER.schema.validate(payload);
            expect(error).toBeUndefined();
            expect(validated.viewId).toBe('example-module.status-card');
        });

        it('validates VIEW_RENDERED with canonical payload shape', () => {
            const payload = {
                viewId: 'example-module.status-card',
                target: '#example-output',
                mode: 'replace',
                source: 'ai',
                timestamp: Date.now()
            };

            const [error] = Contracts.VIEW_RENDERED.schema.validate(payload);
            expect(error).toBeUndefined();
        });
    });

    describe('Router contracts', () => {
        it('validates INTENT_ROUTE_NAVIGATE', () => {
            const [error, validated] = Contracts.INTENT_ROUTE_NAVIGATE.schema.validate({
                path: '/products/demo',
                source: 'ui',
                timestamp: Date.now()
            });

            expect(error).toBeUndefined();
            expect(validated.path).toBe('/products/demo');
        });

        it('validates ROUTE_CHANGED with params', () => {
            const [error] = Contracts.ROUTE_CHANGED.schema.validate({
                path: '/products/demo',
                routeId: 'product-detail',
                pattern: '/products/:slug',
                params: { slug: 'demo' },
                source: 'ui',
                timestamp: Date.now()
            });

            expect(error).toBeUndefined();
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
