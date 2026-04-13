// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { EventBus } from '../library/runtime/EventBus.js';
import { MetaManager } from '../library/runtime/MetaManager.js';
import { Contracts } from '../library/runtime/Contracts.js';

function assignGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
}

describe('MetaManager v2', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html lang="en"><head><meta name="description" content="seed"></head><body></body></html>', {
            url: 'https://example.com/docs'
        });
        assignGlobal('window', dom.window);
        assignGlobal('document', dom.window.document);
    });

    afterEach(() => {
        assignGlobal('window', originalWindow);
        assignGlobal('document', originalDocument);
    });

    it('supports push, patch, dispose, and owner cleanup', () => {
        const manager = new MetaManager(new EventBus());
        const entry = manager.push({
            title: 'Docs',
            meta: [{ name: 'description', content: 'Initial description' }],
            link: [{ rel: 'canonical', href: 'https://example.com/docs' }],
            htmlAttrs: { lang: 'en', class: 'docs-page' },
            bodyAttrs: { 'data-view': 'docs' }
        }, {
            owner: 'docs-module'
        });

        expect(document.title).toBe('Docs');
        expect(document.documentElement.getAttribute('lang')).toBe('en');
        expect(document.documentElement.classList.contains('docs-page')).toBe(true);
        expect(document.body.dataset.view).toBe('docs');
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/docs');

        entry.patch({
            title: 'Docs Updated',
            meta: [{ name: 'description', content: 'Updated description' }],
            htmlAttrs: { lang: 'fr' }
        });

        expect(document.title).toBe('Docs Updated');
        expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Updated description');
        expect(document.documentElement.getAttribute('lang')).toBe('fr');
        expect(document.documentElement.classList.contains('docs-page')).toBe(false);
        expect(document.body.hasAttribute('data-view')).toBe(false);
        expect(document.querySelector('link[rel="canonical"]')).toBeNull();

        entry.dispose();
        expect(document.querySelector('meta[name="description"]')).toBeNull();

        manager.push({
            meta: [{ property: 'og:title', content: 'Owned tag' }]
        }, { owner: 'owned-module' });

        expect(document.querySelector('meta[property="og:title"]')).not.toBeNull();
        manager.clearOwner('owned-module');
        expect(document.querySelector('meta[property="og:title"]')).toBeNull();
    });

    it('keeps PAGE_CHANGED compatibility but removes stale optional tags', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = Contracts;
        const manager = new MetaManager(eventBus);

        await eventBus.publish('PAGE_CHANGED', {
            title: 'Landing',
            description: 'Welcome',
            image: 'https://example.com/og.png',
            locale: 'en'
        });

        expect(document.title).toBe('Landing');
        expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://example.com/og.png');
        expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary_large_image');

        await eventBus.publish('PAGE_CHANGED', {
            title: 'Docs',
            description: 'Read docs',
            locale: 'fr'
        });

        expect(document.title).toBe('Docs');
        expect(document.querySelector('meta[property="og:image"]')).toBeNull();
        expect(document.querySelector('meta[name="twitter:image"]')).toBeNull();
        expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary');
        expect(document.documentElement.getAttribute('lang')).toBe('fr');
        expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://example.com/docs');

        manager.destroy();
    });

    it('only accepts safe JSON-LD scripts and exposes snapshot data', () => {
        const manager = new MetaManager(new EventBus());
        manager.push({
            script: [
                {
                    type: 'application/ld+json',
                    json: {
                        '@type': 'WebSite',
                        name: 'CSMA Docs',
                        dangerous: '</script><script>alert(1)</script>'
                    },
                    key: 'schema'
                },
                {
                    type: 'text/javascript',
                    json: { ignored: true },
                    key: 'unsafe'
                }
            ]
        }, {
            owner: 'schema-module',
            safe: true
        });

        const schemaScript = document.querySelector('script[type="application/ld+json"]');
        expect(schemaScript).not.toBeNull();
        expect(schemaScript.textContent).toContain('\\u003C/script>');
        expect(document.querySelector('script[data-csma-meta-key="script:key:unsafe"]')).toBeNull();

        const snapshot = manager.snapshot();
        expect(snapshot.tags).toHaveLength(1);
        expect(snapshot.tags[0].tag).toBe('script');
        expect(snapshot.tags[0].json['@type']).toBe('WebSite');
    });
});
