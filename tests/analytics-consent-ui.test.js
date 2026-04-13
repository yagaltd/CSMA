import './helpers/storage-polyfill.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ConsentService } from '../library/modules/analytics/consent/ConsentService.js';
import { initAnalyticsConsentUI } from '../library/modules/analytics/ui/analytics-consent.js';

function assignGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
}

describe('analytics consent ui', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    let cleanup = null;

    beforeEach(() => {
        const dom = new JSDOM(`<!doctype html><html><body>
            <section data-consent-center>
                <button data-consent-open>Open</button>
                <div data-consent-status></div>
            </section>
        </body></html>`, { url: 'https://example.com' });
        assignGlobal('window', dom.window);
        assignGlobal('document', dom.window.document);
        localStorage.clear();
    });

    afterEach(() => {
        cleanup?.();
        cleanup = null;
        assignGlobal('window', originalWindow);
        assignGlobal('document', originalDocument);
        vi.restoreAllMocks();
    });

    it('renders toggles and updates state through interactions', () => {
        const service = new ConsentService();
        cleanup = initAnalyticsConsentUI(service);

        const modal = document.querySelector('[data-consent-modal]');
        expect(modal.dataset.open).toBe('true');
        expect(document.querySelectorAll('[data-consent-toggle]').length).toBe(4);

        const uiToggle = document.querySelector('[data-consent-toggle="ui_analytics"]');
        uiToggle.checked = true;
        uiToggle.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(service.getConsent('ui_analytics')).toBe(true);
        expect(document.querySelector('[data-consent-status]').textContent).toContain('ui_analytics');
    });

    it('accepts all, closes modal, and clears telemetry', () => {
        const service = new ConsentService();
        localStorage.setItem('analytics', JSON.stringify([{ event: 'test' }]));
        cleanup = initAnalyticsConsentUI(service);

        document.querySelector('[data-consent-accept]').click();
        expect(Object.values(service.getAllScopes()).every(Boolean)).toBe(true);
        expect(document.querySelector('[data-consent-modal]').dataset.open).toBe('false');

        document.querySelector('[data-consent-open]').click();
        document.querySelector('[data-consent-clear]').click();
        expect(localStorage.getItem('analytics')).toBeNull();
    });
});
