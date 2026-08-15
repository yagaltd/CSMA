/**
 * CacheManager localStorage quota fallback (audit plan 3.5)
 *
 * When the persistent backend fails a write (e.g. QuotaExceededError), the
 * key must be demoted to a session memory-only map so it still reads back,
 * and CACHE_PERSIST_FAILED must be emitted with the key and the error.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CacheManager } from '../src/services/core/CacheManager.js';

class RecordingBus {
    constructor() {
        this.events = [];
    }

    publish(name, payload) {
        this.events.push({ name, payload });
    }
}

function quotaExceededStorage() {
    return {
        getItem: () => null,
        setItem: () => {
            const error = new Error('QuotaExceededError: localStorage quota exceeded');
            error.name = 'QuotaExceededError';
            throw error;
        },
        removeItem: () => {},
        key: () => null,
        length: 0
    };
}

function workingStorage() {
    const store = new Map();
    return {
        getItem: (key) => store.has(key) ? store.get(key) : null,
        setItem: (key, value) => store.set(key, value),
        removeItem: (key) => store.delete(key),
        key: (i) => Array.from(store.keys())[i] ?? null,
        get length() {
            return store.size;
        }
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('CacheManager localStorage quota fallback', () => {
    it('emits CACHE_PERSIST_FAILED with key and error when the backend throws QuotaExceededError', async () => {
        vi.stubGlobal('localStorage', quotaExceededStorage());
        const bus = new RecordingBus();
        const cache = new CacheManager(bus, { backend: 'localStorage' });

        await cache.set('alpha', { hello: 1 });

        const failed = bus.events.filter((event) => event.name === 'CACHE_PERSIST_FAILED');
        expect(failed).toHaveLength(1);
        expect(failed[0].payload.key).toBe('alpha');
        expect(failed[0].payload.error).toContain('QuotaExceededError');
        expect(typeof failed[0].payload.timestamp).toBe('number');
    });

    it('still reads the value back from the session memory-only fallback', async () => {
        vi.stubGlobal('localStorage', quotaExceededStorage());
        const cache = new CacheManager(new RecordingBus(), { backend: 'localStorage' });

        await cache.set('alpha', { hello: 1 });
        expect(await cache.get('alpha')).toEqual({ hello: 1 });

        // Simulate memory-cache eviction: the demoted session fallback must
        // still serve the key (this is the persistFallback read path).
        cache.memoryCache.clear();
        expect(await cache.get('alpha')).toEqual({ hello: 1 });
        expect(cache.memoryCache.has('alpha')).toBe(true); // re-populated
    });

    it('does not emit CACHE_PERSIST_FAILED on successful persists and writes through the backend', async () => {
        const storage = workingStorage();
        vi.stubGlobal('localStorage', storage);
        const bus = new RecordingBus();
        const cache = new CacheManager(bus, { backend: 'localStorage' });

        await cache.set('beta', { ok: true });

        expect(bus.events.filter((event) => event.name === 'CACHE_PERSIST_FAILED')).toHaveLength(0);
        expect(storage.getItem('cache:beta')).toBe(JSON.stringify({ ok: true }));
    });

    it('clears the session fallback on delete', async () => {
        vi.stubGlobal('localStorage', quotaExceededStorage());
        const bus = new RecordingBus();
        const cache = new CacheManager(bus, { backend: 'localStorage' });

        await cache.set('gamma', { bye: 1 });
        expect(await cache.get('gamma')).toEqual({ bye: 1 });

        await cache.delete('gamma');
        expect(await cache.get('gamma')).toBeUndefined();
    });

    it('keeps publishing CACHE_SET even when persistence failed', async () => {
        vi.stubGlobal('localStorage', quotaExceededStorage());
        const bus = new RecordingBus();
        const cache = new CacheManager(bus, { backend: 'localStorage' });

        await cache.set('delta', { set: true });

        expect(bus.events.some((event) => event.name === 'CACHE_SET' && event.payload.key === 'delta')).toBe(true);
    });
});
