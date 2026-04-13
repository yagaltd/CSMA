import './helpers/storage-polyfill.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import EventBus from '../library/runtime/EventBus.js';
import { Contracts } from '../library/runtime/Contracts.js';
import { AnalyticsService } from '../library/modules/analytics/services/AnalyticsService.js';

function assignGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
}

function setupDom(html = '<button data-track="cta">Launch</button>') {
    const dom = new JSDOM(`<!doctype html><html><head><title>Initial</title><meta name="description" content="desc"></head><body>${html}<h1>Heading</h1></body></html>`, {
        url: 'https://example.com/page?secret=token#section'
    });

    assignGlobal('window', dom.window);
    assignGlobal('document', dom.window.document);
    assignGlobal('navigator', dom.window.navigator);
    assignGlobal('location', dom.window.location);
    assignGlobal('sessionStorage', dom.window.sessionStorage);
    assignGlobal('localStorage', dom.window.localStorage);
    assignGlobal('MutationObserver', dom.window.MutationObserver);
    window.csma = { config: { version: '1.2.0', analytics: {} } };
}

describe('AnalyticsService', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNavigator = globalThis.navigator;
    const originalLocation = globalThis.location;
    const originalSessionStorage = globalThis.sessionStorage;
    const originalLocalStorage = globalThis.localStorage;
    const originalMutationObserver = globalThis.MutationObserver;
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        setupDom();
        assignGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200 })));
    });

    afterEach(() => {
        assignGlobal('window', originalWindow);
        assignGlobal('document', originalDocument);
        assignGlobal('navigator', originalNavigator);
        assignGlobal('location', originalLocation);
        assignGlobal('sessionStorage', originalSessionStorage);
        assignGlobal('localStorage', originalLocalStorage);
        assignGlobal('MutationObserver', originalMutationObserver);
        assignGlobal('fetch', originalFetch);
        vi.restoreAllMocks();
    });

    it('tracks page views from PAGE_CHANGED with sanitized urls and seo audit data', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = Contracts;
        const service = new AnalyticsService(eventBus).init();
        const pageViews = [];
        eventBus.subscribe('ANALYTICS_PAGE_VIEW', (payload) => pageViews.push(payload));

        await eventBus.publish('PAGE_CHANGED', {
            title: 'Test Page',
            description: 'desc',
            locale: 'en'
        });

        expect(service.analyticsQueue).toHaveLength(1);
        expect(service.analyticsQueue[0].url).toBe('https://example.com/page');
        expect(service.analyticsQueue[0].seo.hasDescription).toBe(true);
        expect(pageViews).toHaveLength(1);
        expect(pageViews[0].title).toBe('Test Page');
        expect(pageViews[0].seo.h1Count).toBe(1);

        service.destroy();
    });

    it('respects consent gating for ui analytics', () => {
        const eventBus = new EventBus();
        eventBus.contracts = Contracts;
        const service = new AnalyticsService(eventBus, {
            consent: { getConsent: (scope) => scope !== 'ui_analytics' }
        }).init();

        service.trackPageView('Blocked Page');
        service.track('button_click', { button: 'submit' });

        expect(service.analyticsQueue).toHaveLength(0);
        expect(fetch).not.toHaveBeenCalled();

        service.destroy();
    });

    it('flushes when the batch size threshold is reached', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = Contracts;
        const service = new AnalyticsService(eventBus, {
            maxBatchSize: 3
        }).init();

        service.track('button_click', { button: 'one' });
        service.track('button_click', { button: 'two' });
        service.track('button_click', { button: 'three' });
        await Promise.resolve();
        await Promise.resolve();

        expect(fetch).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(fetch.mock.calls[0][1].body);
        expect(payload.entries).toHaveLength(3);
        expect(payload.batchId.startsWith('csma-')).toBe(true);

        service.destroy();
    });

    it('sends critical errors immediately', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = Contracts;
        const service = new AnalyticsService(eventBus).init();

        service.processTrackedEvent({
            type: 'error',
            message: 'Cannot read properties of null',
            timestamp: Date.now()
        });
        await Promise.resolve();

        expect(fetch).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(fetch.mock.calls[0][1].body);
        expect(payload.entries).toHaveLength(1);
        expect(payload.entries[0].event).toBe('ANALYTICS_ERROR');

        service.destroy();
    });

    it('upgrades suspicious input into security analytics', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = Contracts;
        const service = new AnalyticsService(eventBus, {
            maxBatchSize: 1
        }).init();

        service.track('search_submit', {
            query: '<script>alert(1)</script>'
        });
        await Promise.resolve();
        await Promise.resolve();

        const payload = JSON.parse(fetch.mock.calls[0][1].body);
        expect(payload.entries[0].event).toBe('SECURITY_XSS');
        expect(payload.entries[0].context.threat.threat).toBe('xss');

        service.destroy();
    });

    it('enforces analytics contracts through EventBus validation', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = Contracts;
        const violations = [];
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        eventBus.subscribe('SECURITY_VIOLATION', (payload) => violations.push(payload));

        await eventBus.publish('ANALYTICS_PAGE_VIEW', {
            type: 'pageview',
            title: 'Bad payload',
            timestamp: Date.now()
        });

        expect(violations).toHaveLength(1);
        expect(violations[0].type).toBe('contract-violation');
        consoleError.mockRestore();
    });
});
