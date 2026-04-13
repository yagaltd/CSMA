// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('SSMA endpoint resolution', () => {
    const originalWindow = globalThis.window;

    beforeEach(() => {
        globalThis.window = {
            location: {
                protocol: 'https:',
                host: 'example.com'
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
        const { resolveSsmaBaseUrl, resolveSsmaHttpEndpoint, resolveSsmaWsEndpoint } = await import('../library/runtime/ssma.js');
        const runtimeConfig = {
            ssma: { baseUrl: 'https://gateway.example.com/' }
        };

        expect(resolveSsmaBaseUrl(runtimeConfig)).toBe('https://gateway.example.com');
        expect(resolveSsmaHttpEndpoint('/logs/batch', undefined, runtimeConfig)).toBe('https://gateway.example.com/logs/batch');
        expect(resolveSsmaWsEndpoint('/optimistic/ws', undefined, runtimeConfig)).toBe('wss://gateway.example.com/optimistic/ws');
    });

    it('falls back to same-origin relative endpoints when no SSMA base is configured', async () => {
        const { resolveSsmaHttpEndpoint, resolveSsmaWsEndpoint } = await import('../library/runtime/ssma.js');

        expect(resolveSsmaHttpEndpoint('/optimistic/events')).toBe('/optimistic/events');
        expect(resolveSsmaWsEndpoint('/optimistic/ws')).toBe('wss://example.com/optimistic/ws');
    });
});
