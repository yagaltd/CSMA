// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('SSMA endpoint resolution', () => {
    const originalWindow = globalThis.window;

    beforeEach(() => {
        globalThis.window = {
            location: {
                protocol: 'https:',
                host: 'example.com'
            },
            csma: {
                config: {}
            }
        };
        delete window.__CSMA_API_URL;
        vi.resetModules();
    });

    afterEach(() => {
        globalThis.window = originalWindow;
        vi.restoreAllMocks();
    });

    it('prefers the unified ssma.baseUrl config', async () => {
        window.csma.config.ssma = { baseUrl: 'https://gateway.example.com/' };
        const { resolveSsmaBaseUrl, resolveSsmaHttpEndpoint, resolveSsmaWsEndpoint } = await import('../library/runtime/ssma.js');

        expect(resolveSsmaBaseUrl()).toBe('https://gateway.example.com');
        expect(resolveSsmaHttpEndpoint('/logs/batch')).toBe('https://gateway.example.com/logs/batch');
        expect(resolveSsmaWsEndpoint('/optimistic/ws')).toBe('wss://gateway.example.com/optimistic/ws');
    });

    it('falls back to same-origin relative endpoints when no SSMA base is configured', async () => {
        const { resolveSsmaHttpEndpoint, resolveSsmaWsEndpoint } = await import('../library/runtime/ssma.js');

        expect(resolveSsmaHttpEndpoint('/optimistic/events')).toBe('/optimistic/events');
        expect(resolveSsmaWsEndpoint('/optimistic/ws')).toBe('wss://example.com/optimistic/ws');
    });
});
