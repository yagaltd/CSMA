import './helpers/storage-polyfill.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initUI } from '../library/ui/init.js';

describe('initUI', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalPerformance = globalThis.performance;

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.performance = { now: vi.fn(() => 0) };
        window.csma = {};
    });

    afterEach(() => {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.performance = originalPerformance;
    });

    it('returns a cleanup function when called with an eventBus', () => {
        const eventBus = { subscribe: vi.fn(() => () => {}) };
        const cleanup = initUI(eventBus);

        expect(typeof cleanup).toBe('function');
    });

    it('returns a no-op cleanup when called without an eventBus', () => {
        const cleanup = initUI();

        expect(typeof cleanup).toBe('function');
    });
});
