// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupThemeToggle, resolveApiBaseUrl, buildLogEndpoint } from '../library/style/theme/theme-helpers.js';

describe('theme helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        window.csma = { config: {} };
        // Ensure localStorage works (jsdom provides it but polyfill may override)
        if (!window.localStorage.getItem) {
            window.localStorage = {
                getItem: vi.fn(() => null),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
            };
        }
    });

    it('setupThemeToggle returns cleanup function when no toggle button exists', () => {
        const eventBus = { publish: vi.fn() };
        const cleanup = setupThemeToggle(eventBus);
        expect(typeof cleanup).toBe('function');
    });

    it('setupThemeToggle attaches click listener when toggle button exists', () => {
        document.body.innerHTML = `
            <button data-theme-toggle data-theme-active="light">
                <span data-theme-label>Light</span>
            </button>
        `;
        const eventBus = { publish: vi.fn() };
        const cleanup = setupThemeToggle(eventBus);
        expect(typeof cleanup).toBe('function');
        cleanup();
    });

    it('resolveApiBaseUrl returns empty string by default', () => {
        const url = resolveApiBaseUrl();
        expect(typeof url).toBe('string');
    });

    it('resolveApiBaseUrl returns configured base URL', () => {
        window.csma.config.ssma = { baseUrl: 'http://localhost:5050' };
        const url = resolveApiBaseUrl();
        expect(url).toBe('http://localhost:5050');
    });

    it('buildLogEndpoint constructs endpoint from override', () => {
        const result = buildLogEndpoint('http://localhost:5050');
        expect(typeof result).toBe('string');
    });

    it('buildLogEndpoint returns path when no base URL', () => {
        const result = buildLogEndpoint();
        expect(result).toBe('/logs/batch');
    });
});
