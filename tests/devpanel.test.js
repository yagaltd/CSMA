import './helpers/storage-polyfill.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { DevPanel } from '../src/runtime/devtools/DevPanel.js';

function assignGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
}

describe('DevPanel', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body></body></html>', {
            url: 'https://example.com'
        });
        assignGlobal('window', dom.window);
        assignGlobal('document', dom.window.document);
        window.csma = {};
    });

    afterEach(() => {
        assignGlobal('window', originalWindow);
        assignGlobal('document', originalDocument);
        vi.restoreAllMocks();
    });

    it('subscribes through observe without monkey-patching publish', () => {
        const unsubscribe = vi.fn();
        const eventBus = {
            publish: vi.fn(),
            subscribe: vi.fn(() => () => {}),
            observe: vi.fn(() => unsubscribe)
        };
        const originalPublish = eventBus.publish;
        const logAccumulator = {
            eventBus,
            logs: [],
            log: vi.fn(),
            update: vi.fn()
        };

        const panel = new DevPanel(logAccumulator);

        expect(eventBus.observe).toHaveBeenCalledTimes(1);
        expect(eventBus.publish).toBe(originalPublish);

        panel.destroy();
        expect(unsubscribe).toHaveBeenCalled();
    });

    it('copies diagnostic snapshots instead of raw logs', () => {
        const writeText = vi.fn();
        navigator.clipboard = { writeText };

        const eventBus = {
            publish: vi.fn(),
            subscribe: vi.fn(() => () => {}),
            observe: vi.fn(() => () => {})
        };
        const logAccumulator = {
            eventBus,
            logs: [{ type: 'raw-log' }],
            log: vi.fn(),
            update: vi.fn(),
            diagnosticSnapshot: vi.fn(({ mode }) => ({ meta: { mode } }))
        };

        const panel = new DevPanel(logAccumulator);

        panel.panel.querySelector('#devtools-copy').click();
        panel.panel.querySelector('#devtools-copy-compact').click();

        expect(logAccumulator.diagnosticSnapshot).toHaveBeenNthCalledWith(1, { mode: 'verbose' });
        expect(logAccumulator.diagnosticSnapshot).toHaveBeenNthCalledWith(2, { mode: 'compact' });
        expect(writeText).toHaveBeenNthCalledWith(1, JSON.stringify({ meta: { mode: 'verbose' } }, null, 2));
        expect(writeText).toHaveBeenNthCalledWith(2, JSON.stringify({ meta: { mode: 'compact' } }, null, 2));

        panel.destroy();
    });
});
