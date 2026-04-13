// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { EventBus } from '../library/runtime/EventBus.js';
import { ServiceManager } from '../library/runtime/ServiceManager.js';
import { ModuleManager } from '../library/runtime/ModuleManager.js';
import { CommandRegistry } from '../library/runtime/CommandRegistry.js';
import { NavigationRegistry } from '../library/runtime/NavigationRegistry.js';
import { PanelRegistry } from '../library/runtime/PanelRegistry.js';
import { AdapterRegistry } from '../library/runtime/AdapterRegistry.js';
import { ViewRegistry } from '../library/runtime/ViewRegistry.js';
import { MetaManager } from '../library/runtime/MetaManager.js';
import { contentSchemas } from '../library/modules/meta-manager/schema/content.js';
import { ProductSchema } from '../library/modules/meta-manager/index.js';

function assignGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
}

function createModuleRuntime() {
    const eventBus = new EventBus();
    const serviceManager = new ServiceManager(eventBus);
    const metaManager = new MetaManager(eventBus);
    serviceManager.register('metaManager', metaManager, { version: '2.0.0' });

    return {
        eventBus,
        serviceManager,
        metaManager,
        moduleManager: new ModuleManager(eventBus, serviceManager, {
            commands: new CommandRegistry({ eventBus, serviceManager }),
            navigation: new NavigationRegistry({ eventBus }),
            panels: new PanelRegistry({ eventBus }),
            adapters: new AdapterRegistry({ eventBus, serviceManager }),
            views: new ViewRegistry({ eventBus, serviceManager })
        })
    };
}

describe('meta-manager module', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
            url: 'https://example.com/products/widget'
        });
        assignGlobal('window', dom.window);
        assignGlobal('document', dom.window.document);
        window.csma = {};
    });

    afterEach(() => {
        assignGlobal('window', originalWindow);
        assignGlobal('document', originalDocument);
    });

    it('loads and unloads the module cleanly', async () => {
        const runtime = createModuleRuntime();
        await runtime.moduleManager.loadModule('meta-manager');
        const service = runtime.serviceManager.get('metaManagerModule');

        expect(service).toBeTruthy();
        service.init({ metaManager: runtime.metaManager });
        service.setSchema([{ type: 'WebSite', input: { name: 'Docs', url: 'https://example.com' } }]);
        expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();

        await runtime.moduleManager.unloadModule('meta-manager');
        expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
    });

    it('registers starter schemas, optional packs, and direct imports', async () => {
        const runtime = createModuleRuntime();
        await runtime.moduleManager.loadModule('meta-manager');
        const service = runtime.serviceManager.get('metaManagerModule');
        service.init({ metaManager: runtime.metaManager, includeStarter: false });

        expect(() => {
            service.setSchema([{ type: 'Article', input: { headline: 'Missing builder' } }]);
        }).toThrow(/Unknown schema type/);

        service.registerSchemaPack(contentSchemas);
        service.registerSchema(ProductSchema);

        const productEntry = service.setSchema([{
            type: 'Product',
            input: {
                name: 'Widget',
                description: '  Useful widget  ',
                offers: {
                    priceCurrency: 'USD',
                    price: '19.99',
                    empty: ''
                }
            }
        }], {
            key: 'product-schema'
        });

        expect(productEntry).toBeTruthy();
        const json = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
        expect(json['@type']).toBe('Product');
        expect(json.offers.empty).toBeUndefined();

        await runtime.serviceManager.unregister('metaManagerModule');
    });

    it('applies SEO pages with starter schema builders', async () => {
        const runtime = createModuleRuntime();
        await runtime.moduleManager.loadModule('meta-manager');
        const service = runtime.serviceManager.get('metaManagerModule');
        service.init({ metaManager: runtime.metaManager });

        service.applySeoPage({
            title: 'Getting Started',
            description: 'How to begin',
            canonical: 'https://example.com/docs/getting-started',
            locale: 'en',
            schema: [
                {
                    type: 'WebPage',
                    input: {
                        title: 'Getting Started',
                        url: 'https://example.com/docs/getting-started',
                        description: 'How to begin'
                    }
                }
            ]
        });

        expect(document.title).toBe('Getting Started');
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/docs/getting-started');
        expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('How to begin');

        const json = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
        expect(json['@type']).toBe('WebPage');
    });
});
