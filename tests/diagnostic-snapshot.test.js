// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import EventBus from '../src/runtime/EventBus.js';
import { ServiceManager } from '../src/runtime/ServiceManager.js';
import { LogAccumulator } from '../src/runtime/LogAccumulator.js';
import { createSnapshot } from '../src/runtime/diagnosticSnapshot.js';

function assignGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
}

describe('diagnosticSnapshot', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNavigator = globalThis.navigator;
    const originalSessionStorage = globalThis.sessionStorage;
    let eventBus;
    let serviceManager;
    let logAccumulator;

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body></body></html>', {
            url: 'https://example.com'
        });
        assignGlobal('window', dom.window);
        assignGlobal('document', dom.window.document);
        assignGlobal('navigator', dom.window.navigator);
        assignGlobal('sessionStorage', dom.window.sessionStorage);
        eventBus = new EventBus();
        serviceManager = new ServiceManager(eventBus);
        serviceManager.register('alpha', { destroy() {} }, {
            version: '1.0.0',
            description: 'alpha service'
        });
        logAccumulator = new LogAccumulator(eventBus, {
            errorBoundary: {
                isCriticalError: () => false,
                handleError: () => {},
                destroy: () => {}
            }
        });
        window.csma = { config: { version: '1.2.0' }, serviceManager };
        window.serviceManager = serviceManager;
    });

    afterEach(() => {
        logAccumulator?.destroy();
        assignGlobal('window', originalWindow);
        assignGlobal('document', originalDocument);
        assignGlobal('navigator', originalNavigator);
        assignGlobal('sessionStorage', originalSessionStorage);
        vi.restoreAllMocks();
    });

    it('returns the expected compact structure', () => {
        logAccumulator.log('error', { message: 'boom', stack: 'trace' });
        logAccumulator.log('security', { type: 'rate-limit' });
        logAccumulator.log('contract-violation', { event: 'TEST_EVENT', payload: { secret: true } });
        serviceManager.register('analytics', {
            sessionEvents: [
                { type: 'pageview', seo: { hasDescription: false, hasOgImage: true, h1Count: 1, structuredDataTypes: [], titleLength: 4 } },
                { type: 'pageview', seo: { hasDescription: true, hasOgImage: false, h1Count: 2, structuredDataTypes: ['Article'], titleLength: 4 } }
            ]
        }, { version: '1.0.0', description: 'analytics' });

        const snapshot = createSnapshot(logAccumulator, serviceManager, eventBus);

        expect(snapshot).toHaveProperty('session');
        expect(snapshot).toHaveProperty('errors');
        expect(snapshot).toHaveProperty('security');
        expect(snapshot).toHaveProperty('contracts');
        expect(snapshot).toHaveProperty('seo');
        expect(snapshot).toHaveProperty('services');
        expect(snapshot).toHaveProperty('performance');
        expect(snapshot).toHaveProperty('meta');
        expect(typeof snapshot.session.id).toBe('string');
        expect(snapshot.errors.total).toBe(1);
        expect(snapshot.security.total).toBe(1);
        expect(snapshot.contracts.total).toBe(1);
        expect(snapshot.errors.degraded[0].data.stack).toBeUndefined();
        expect(snapshot.seo.pagesMissingDescription).toBe(1);
        expect(snapshot.seo.pagesMissingOgImage).toBe(1);
        expect(snapshot.seo.pagesWithMultipleH1).toBe(1);
    });

    it('includes stacks in verbose mode', () => {
        logAccumulator.log('error', { message: 'boom', stack: 'trace' });

        const snapshot = createSnapshot(logAccumulator, serviceManager, eventBus, { mode: 'verbose' });

        expect(snapshot.errors.degraded[0].data.stack).toBe('trace');
        expect(snapshot.meta.mode).toBe('verbose');
    });

    it('exposes diagnose through window.csma', async () => {
        const { syncWindowRuntime } = await import('../src/bootstrap/runtime.js');
        const state = {
            eventBus,
            serviceManager,
            moduleManager: null,
            channelManager: null,
            metaManager: null,
            logAccumulator,
            leaderService: null,
            registries: null,
            routerServiceRef: null,
            i18nServiceRef: null,
            authServiceRef: null
        };

        syncWindowRuntime(state, { apiBaseUrl: '', destroyApp: () => {} });
        const snapshot = window.csma.diagnose();

        expect(snapshot).toHaveProperty('session');
        expect(snapshot.meta.mode).toBe('compact');
    });
});
