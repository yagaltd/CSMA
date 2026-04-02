// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { EventBus } from '../src/runtime/EventBus.js';
import { ServiceManager } from '../src/runtime/ServiceManager.js';
import { ModuleManager } from '../src/runtime/ModuleManager.js';
import { CommandRegistry } from '../src/runtime/CommandRegistry.js';
import { RouteRegistry } from '../src/runtime/RouteRegistry.js';
import { NavigationRegistry } from '../src/runtime/NavigationRegistry.js';
import { PanelRegistry } from '../src/runtime/PanelRegistry.js';
import { AdapterRegistry } from '../src/runtime/AdapterRegistry.js';
import { ViewRegistry } from '../src/runtime/ViewRegistry.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { LogAccumulator } from '../src/runtime/LogAccumulator.js';
import { AnalyticsService } from '../src/modules/analytics/services/AnalyticsService.js';

function createAnalyticsRuntime() {
    const eventBus = new EventBus();
    eventBus.contracts = Contracts;

    const serviceManager = new ServiceManager(eventBus);
    const registries = {
        commands: new CommandRegistry({ eventBus, serviceManager }),
        routes: new RouteRegistry({ eventBus }),
        navigation: new NavigationRegistry({ eventBus }),
        panels: new PanelRegistry({ eventBus }),
        adapters: new AdapterRegistry({ eventBus, serviceManager }),
        views: new ViewRegistry({ eventBus, serviceManager })
    };
    const moduleManager = new ModuleManager(eventBus, serviceManager, registries);

    return {
        eventBus,
        serviceManager,
        moduleManager,
        channelManager: {
            setContextResolver() {},
            reevaluateAccess() {}
        },
        registries,
        routerServiceRef: null,
        i18nServiceRef: null,
        authServiceRef: null
    };
}

describe('Analytics module', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNavigator = globalThis.navigator;
    const originalFetch = globalThis.fetch;
    const originalMutationObserver = globalThis.MutationObserver;

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body><button data-track="submit">Submit</button></body></html>', {
            url: 'https://example.com/products?secret=token#details'
        });

        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.navigator = dom.window.navigator;
        globalThis.sessionStorage = dom.window.sessionStorage;
        globalThis.localStorage = dom.window.localStorage;
        globalThis.MutationObserver = dom.window.MutationObserver;
        window.csma = { config: { analytics: {} } };
        globalThis.fetch = vi.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true })
        }));
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        globalThis.fetch = originalFetch;
        globalThis.MutationObserver = originalMutationObserver;
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.navigator = originalNavigator;
    });

    it('loads the analytics module and exposes the public API', async () => {
        const { loadOptionalFeatures } = await import('../src/bootstrap/features.js');
        const { syncWindowRuntime } = await import('../src/bootstrap/runtime.js');
        const state = createAnalyticsRuntime();

        await loadOptionalFeatures(state, {
            FEATURES: { ANALYTICS_MODULE: true, ANALYTICS_CONSENT: true },
            apiBaseUrl: ''
        });
        syncWindowRuntime(state, { apiBaseUrl: '', destroyApp: () => {} });

        const analytics = state.serviceManager.get('analytics');
        expect(analytics).toBeTruthy();
        expect(window.csma.analytics).toBe(analytics);
        expect(window.csma.analyticsConsent).toBe(state.serviceManager.get('analyticsConsent'));
        expect(typeof window.csma.seoAudit).toBe('function');
        expect(analytics.analyticsEndpoint).toBe('/analytics');
        expect(window.csma.exportAnalytics().entries).toEqual([]);

        analytics.destroy();
        await state.serviceManager.destroyAll();
    });

    it('tracks page views from PAGE_CHANGED with sanitized URLs', async () => {
        const { loadOptionalFeatures } = await import('../src/bootstrap/features.js');
        const state = createAnalyticsRuntime();

        await loadOptionalFeatures(state, {
            FEATURES: { ANALYTICS_MODULE: true, ANALYTICS_CONSENT: false },
            apiBaseUrl: ''
        });

        const analytics = state.serviceManager.get('analytics');
        await state.eventBus.publish('PAGE_CHANGED', {
            title: 'Test Page',
            description: 'desc',
            locale: 'en'
        });

        expect(analytics.analyticsQueue).toHaveLength(1);
        expect(analytics.analyticsQueue[0].type).toBe('pageview');
        expect(analytics.analyticsQueue[0].title).toBe('Test Page');
        expect(analytics.analyticsQueue[0].url).toBe('https://example.com/products');

        analytics.destroy();
        await state.serviceManager.destroyAll();
    });

    it('tracks custom events and auto-flushes at the batch threshold', async () => {
        const service = new AnalyticsService(new EventBus());
        const flushSpy = vi.spyOn(service, 'flushViaFetch').mockResolvedValue(undefined);

        service.init({
            endpoint: '/analytics',
            maxBatchSize: 3
        });

        service.track('button_click', { button: 'submit' });
        service.track('button_click', { button: 'submit' });
        service.track('button_click', { button: 'submit' });

        await Promise.resolve();
        await Promise.resolve();
        expect(flushSpy).toHaveBeenCalledTimes(1);
        expect(flushSpy.mock.calls[0][0].entries).toHaveLength(3);
        expect(flushSpy.mock.calls[0][0].batchId).toMatch(/^csma-/);

        service.destroy();
    });

    it('respects consent gating when consent is explicitly denied', () => {
        const service = new AnalyticsService(new EventBus());

        service.init({
            consent: {
                getConsent: () => false
            }
        });

        service.trackPageView('Denied Page');

        expect(service.analyticsQueue).toHaveLength(0);

        service.destroy();
    });

    it('does not reintroduce analytics methods on LogAccumulator', () => {
        expect(LogAccumulator.prototype.trackPageView).toBeUndefined();
        expect(LogAccumulator.prototype.track).toBeUndefined();
        expect(LogAccumulator.prototype.setUser).toBeUndefined();
        expect(LogAccumulator.prototype.flush).toBeUndefined();
        expect(typeof LogAccumulator.prototype.log).toBe('function');
        expect(typeof LogAccumulator.prototype.logError).toBe('function');
        expect(typeof LogAccumulator.prototype.logAttack).toBe('function');
        expect(typeof LogAccumulator.prototype.export).toBe('function');
    });

    it('validates analytics contracts through EventBus and emits contract violations', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = Contracts;
        const securityViolations = [];
        const contractViolations = [];
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        eventBus.subscribe('SECURITY_VIOLATION', (payload) => {
            securityViolations.push(payload);
        });
        eventBus.subscribe('CONTRACT_VIOLATION', (payload) => {
            contractViolations.push(payload);
        });

        await eventBus.publish('ANALYTICS_PAGE_VIEW', {
            type: 'pageview',
            url: 'https://example.com',
            path: '/missing-title',
            timestamp: Date.now()
        });

        expect(securityViolations).toHaveLength(1);
        expect(contractViolations).toHaveLength(1);
        expect(securityViolations[0].type).toBe('contract-violation');
        expect(securityViolations[0].eventName).toBe('ANALYTICS_PAGE_VIEW');
        expect(contractViolations[0].type).toBe('contract-violation');
        expect(contractViolations[0].eventName).toBe('ANALYTICS_PAGE_VIEW');
        consoleError.mockRestore();
    });

    it('lets LogAccumulator record contract violations raised by analytics contracts', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = Contracts;
        const logAccumulator = new LogAccumulator(eventBus);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        await eventBus.publish('ANALYTICS_PAGE_VIEW', {
            type: 'pageview',
            url: 'https://example.com',
            path: '/missing-title',
            timestamp: Date.now()
        });

        expect(logAccumulator.logs.some((entry) => entry.type === 'contract-violation')).toBe(true);
        consoleError.mockRestore();

        logAccumulator.destroy();
    });
});
