import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { auditPage } from '../library/runtime/seoAudit.js';

function assignGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
}

describe('seoAudit', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    beforeEach(() => {
        const dom = new JSDOM(`<!doctype html><html><head>
            <title>Test</title>
            <meta name="description" content="A test page">
            <meta property="og:image" content="https://example.com/og.png">
            <link rel="canonical" href="https://example.com/test">
            <script type="application/ld+json">{"@type":"Article"}</script>
        </head><body><h1>Heading</h1></body></html>`, {
            url: 'https://example.com/test'
        });
        assignGlobal('window', dom.window);
        assignGlobal('document', dom.window.document);
    });

    afterEach(() => {
        assignGlobal('window', originalWindow);
        assignGlobal('document', originalDocument);
    });

    it('extracts current page seo metadata', () => {
        const result = auditPage();
        expect(result.titleLength).toBe(4);
        expect(result.hasDescription).toBe(true);
        expect(result.hasOgImage).toBe(true);
        expect(result.canonicalUrl).toBe('https://example.com/test');
        expect(result.h1Count).toBe(1);
        expect(result.structuredDataTypes).toContain('Article');
    });

    it('handles missing metadata and invalid json-ld', () => {
        document.querySelector('meta[property="og:image"]').remove();
        document.querySelector('meta[name="description"]').remove();
        document.querySelector('script[type="application/ld+json"]').textContent = '{bad json';
        document.body.insertAdjacentHTML('beforeend', '<h1>Extra</h1>');

        const result = auditPage();
        expect(result.hasDescription).toBe(false);
        expect(result.hasOgImage).toBe(false);
        expect(result.h1Count).toBe(2);
        expect(result.structuredDataTypes).toEqual([]);
    });
});
