import './helpers/storage-polyfill.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ErrorBoundary } from '../src/runtime/ErrorBoundary.js';

function assignGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
}

describe('ErrorBoundary', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
            url: 'https://example.com'
        });
        assignGlobal('window', dom.window);
        assignGlobal('document', dom.window.document);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        assignGlobal('window', originalWindow);
        assignGlobal('document', originalDocument);
        vi.restoreAllMocks();
    });

    it('shows an overlay on critical errors', () => {
        const boundary = new ErrorBoundary({ devMode: true });

        boundary.handleError({
            message: 'Cannot read properties of null',
            error: { stack: 'stack trace' }
        });

        expect(document.querySelector('.error-boundary')).toBeTruthy();
        expect(document.querySelector('.error-boundary h2')?.textContent).toContain('Something went wrong');
        expect(document.querySelector('.error-actions')).toBeTruthy();
        expect(document.querySelector('.error-stack')?.textContent).toContain('stack trace');

        boundary.destroy();
    });

    it('auto-dismisses non-critical errors after 10 seconds', () => {
        const boundary = new ErrorBoundary({ devMode: false });

        boundary.handleError({
            message: 'Minor UI warning'
        });

        expect(document.querySelector('.error-boundary')).toBeTruthy();

        vi.advanceTimersByTime(10000);

        expect(document.querySelector('.error-boundary')).toBeFalsy();

        boundary.destroy();
    });

    it('sanitizes urls in production mode', () => {
        const boundary = new ErrorBoundary({ devMode: false });

        const sanitized = boundary.sanitizeError('Error at https://secret.com/api?key=abc and file:///tmp/a.js');

        expect(sanitized).toContain('[URL]');
        expect(sanitized).toContain('[FILE]');
    });

    it('shows stack traces only in dev mode', () => {
        const devBoundary = new ErrorBoundary({ devMode: true });
        devBoundary.handleError({
            message: 'Cannot read properties of null',
            error: { stack: 'dev stack' }
        });
        expect(document.querySelector('.error-stack')).toBeTruthy();
        devBoundary.destroy();

        const prodBoundary = new ErrorBoundary({ devMode: false });
        prodBoundary.handleError({
            message: 'Cannot read properties of null',
            error: { stack: 'prod stack' }
        });
        expect(document.querySelector('.error-stack')).toBeFalsy();
        prodBoundary.destroy();
    });
});
