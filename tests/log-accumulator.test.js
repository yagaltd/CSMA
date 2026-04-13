import './helpers/storage-polyfill.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import EventBus from '../library/runtime/EventBus.js';
import { LogAccumulator } from '../library/runtime/LogAccumulator.js';

function assignGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
}

function setupDom() {
    const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div></body></html>', {
        url: 'https://example.com'
    });

    assignGlobal('window', dom.window);
    assignGlobal('document', dom.window.document);
    assignGlobal('navigator', dom.window.navigator);
    assignGlobal('location', dom.window.location);
    assignGlobal('sessionStorage', dom.window.sessionStorage);
    assignGlobal('localStorage', dom.window.localStorage);
    assignGlobal('MutationObserver', dom.window.MutationObserver);
}

describe('LogAccumulator', () => {
    let eventBus;
    let accumulator;
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNavigator = globalThis.navigator;
    const originalLocation = globalThis.location;
    const originalSessionStorage = globalThis.sessionStorage;
    const originalLocalStorage = globalThis.localStorage;
    const originalMutationObserver = globalThis.MutationObserver;

    beforeEach(() => {
        setupDom();
        eventBus = new EventBus();
        document.body.innerHTML = '<div id="app"></div>';
        document.head.innerHTML = '';
        sessionStorage.clear();
        accumulator = new LogAccumulator(eventBus);
    });

    afterEach(() => {
        accumulator?.destroy();
        accumulator = null;
        assignGlobal('window', originalWindow);
        assignGlobal('document', originalDocument);
        assignGlobal('navigator', originalNavigator);
        assignGlobal('location', originalLocation);
        assignGlobal('sessionStorage', originalSessionStorage);
        assignGlobal('localStorage', originalLocalStorage);
        assignGlobal('MutationObserver', originalMutationObserver);
        vi.restoreAllMocks();
    });

    it('keeps analytics methods removed and remains a slim runtime observer', () => {
        expect(LogAccumulator.prototype.trackPageView).toBeUndefined();
        expect(LogAccumulator.prototype.track).toBeUndefined();
        expect(LogAccumulator.prototype.setUser).toBeUndefined();
        expect(LogAccumulator.prototype.flush).toBeUndefined();
        expect(LogAccumulator.prototype.observeCSSChanges).toBeUndefined();
        expect(typeof LogAccumulator.prototype.log).toBe('function');
        expect(typeof LogAccumulator.prototype.logError).toBe('function');
        expect(typeof LogAccumulator.prototype.logAttack).toBe('function');
        expect(typeof LogAccumulator.prototype.export).toBe('function');
    });

    it('publishes LOG_ENTRY events for runtime logs', async () => {
        const entries = [];
        eventBus.subscribe('LOG_ENTRY', (payload) => entries.push(payload));

        accumulator.log('custom', { ok: true });
        await Promise.resolve();

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            type: 'custom',
            data: { ok: true }
        });
    });

    it('logs security and contract violations through event subscriptions', async () => {
        await eventBus.publish('SECURITY_VIOLATION', {
            type: 'rate-limit',
            userId: 'anonymous',
            pattern: 'burst'
        });
        await eventBus.publish('CONTRACT_VIOLATION', {
            event: 'TEST_EVENT',
            error: 'bad payload',
            payload: { secret: 'value' }
        });

        expect(accumulator.logs.some((entry) => entry.type === 'security')).toBe(true);
        expect(accumulator.logs.some((entry) => entry.type === 'contract-violation')).toBe(true);
    });

    it('delegates critical errors to the injected error boundary', () => {
        const errorBoundary = {
            isCriticalError: vi.fn(() => true),
            handleError: vi.fn(),
            destroy: vi.fn()
        };
        accumulator.destroy();
        accumulator = new LogAccumulator(eventBus, { errorBoundary });

        window.dispatchEvent(new window.ErrorEvent('error', {
            message: 'Cannot read properties of null',
            filename: 'app.js',
            lineno: 10,
            colno: 2
        }));

        expect(errorBoundary.isCriticalError).toHaveBeenCalled();
        expect(errorBoundary.handleError).toHaveBeenCalled();
        expect(accumulator.logs.some((entry) => entry.type === 'error')).toBe(true);
    });

    it('trims log history when maxLogs is exceeded', () => {
        accumulator.maxLogs = 10;

        for (let index = 0; index < 20; index++) {
            accumulator.log('test', { index });
        }

        expect(accumulator.logs.length).toBeLessThanOrEqual(10);
    });

    it('does not create a CSS mutation observer', () => {
        const mutationObserverSpy = vi.fn();
        assignGlobal('MutationObserver', mutationObserverSpy);

        accumulator.destroy();
        accumulator = new LogAccumulator(eventBus, {
            errorBoundary: {
                isCriticalError: () => false,
                handleError: () => {},
                destroy: () => {}
            }
        });

        expect(mutationObserverSpy).not.toHaveBeenCalled();
    });
});
