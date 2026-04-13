import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveSsmaHttpEndpoint, resolveSsmaWsEndpoint } from '../library/runtime/ssma.js';

describe('SSMA endpoint resolution', () => {
    const originalWindow = globalThis.window;
    const originalEnv = import.meta.env;

    beforeEach(() => {
        globalThis.window = {
            location: { protocol: 'http:' },
            __CSMA_API_URL: ''
        };
    });

    afterEach(() => {
        globalThis.window = originalWindow;
    });

    it('resolveSsmaHttpEndpoint returns path when no base URL configured', () => {
        const result = resolveSsmaHttpEndpoint('/optimistic/events');
        expect(result).toBe('/optimistic/events');
    });

    it('resolveSsmaHttpEndpoint prepends base URL from config', () => {
        const result = resolveSsmaHttpEndpoint('/optimistic/events', undefined, {
            ssma: { baseUrl: 'http://localhost:5050' }
        });
        expect(result).toBe('http://localhost:5050/optimistic/events');
    });

    it('resolveSsmaHttpEndpoint uses override when provided', () => {
        const result = resolveSsmaHttpEndpoint('/optimistic/events', 'https://custom.api/events');
        expect(result).toBe('https://custom.api/events');
    });

    it('resolveSsmaWsEndpoint returns ws URL when no base URL', () => {
        const result = resolveSsmaWsEndpoint('/optimistic/ws');
        expect(result).toContain('ws:');
        expect(result).toContain('/optimistic/ws');
    });

    it('resolveSsmaWsEndpoint uses wss when window is https', () => {
        window.location.protocol = 'https:';
        const result = resolveSsmaWsEndpoint('/optimistic/ws', undefined, {});
        expect(result).toContain('wss:');
    });

    it('resolveSsmaWsEndpoint uses override when provided', () => {
        const result = resolveSsmaWsEndpoint('/optimistic/ws', 'wss://custom/ws');
        expect(result).toBe('wss://custom/ws');
    });
});
