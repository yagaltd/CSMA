/**
 * APIWrapper smoke tests — proves the core fetch wrapper (services/core)
 * stays alive and behavioral: helpers delegate to request(), events fire,
 * 4xx does not retry, 5xx retries then succeeds.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIWrapper } from '../src/services/core/APIWrapper.js';

function recordingBus() {
    const events = [];
    return {
        events,
        publish(name, payload) { events.push({ name, payload }); },
        subscribe() { return () => {}; }
    };
}

describe('APIWrapper (services/core)', () => {
    let bus;
    let wrapper;
    let fetchImpl;

    beforeEach(() => {
        bus = recordingBus();
        fetchImpl = vi.fn();
        vi.stubGlobal('fetch', fetchImpl); // wrapper uses global fetch
        wrapper = new APIWrapper(bus, { baseURL: 'https://api.test', retries: 2, timeout: 500 });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('get() resolves data and publishes the request lifecycle', async () => {
        fetchImpl.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ id: 7 })
        });

        const data = await wrapper.get('/things/7');
        expect(data).toEqual({ id: 7 });

        const [url, init] = fetchImpl.mock.calls[0];
        expect(String(url)).toContain('https://api.test/things/7');
        expect(init.method).toBe('GET');

        const names = bus.events.map((e) => e.name);
        expect(names).toContain('API_REQUEST_START');
        expect(names).toContain('API_REQUEST_SUCCESS');
    });

    it('post() sends JSON body with POST method', async () => {
        fetchImpl.mockResolvedValueOnce({
            ok: true, status: 201,
            headers: { get: () => 'application/json' },
            json: async () => ({ ok: true })
        });
        await wrapper.post('/things', { title: 'x' });
        const [, init] = fetchImpl.mock.calls[0];
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({ title: 'x' });
    });

    it('does not retry 4xx client errors', async () => {
        fetchImpl.mockResolvedValue({
            ok: false, status: 404, statusText: 'Not Found',
            headers: { get: () => 'application/json' },
            json: async () => ({ message: 'missing' })
        });

        await expect(wrapper.get('/missing')).rejects.toThrow();
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(bus.events.map((e) => e.name)).toContain('API_REQUEST_ERROR');
    });

    it('retries 5xx and succeeds on a later attempt', async () => {
        fetchImpl
            .mockResolvedValueOnce({
                ok: false, status: 503, statusText: 'Unavailable',
                headers: { get: () => 'application/json' },
                json: async () => ({})
            })
            .mockResolvedValueOnce({
                ok: true, status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ recovered: true })
            });

        const data = await wrapper.get('/flaky', { retries: 1 });
        expect(data).toEqual({ recovered: true });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(bus.events.map((e) => e.name)).toContain('API_REQUEST_RETRY');
    });
});

describe('APIWrapper optional response cache', () => {
    let fetchImpl;
    let bus;

    beforeEach(() => {
        bus = recordingBus();
        fetchImpl = vi.fn();
        vi.stubGlobal('fetch', fetchImpl);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function stubCache() {
        const store = new Map();
        const ttls = new Map();
        return {
            store, ttls,
            memoryCache: null, storage: null, // memory-only shape for private test
            async get(key) { return store.has(key) ? store.get(key) : undefined; },
            async set(key, value, ttl) { store.set(key, value); ttls.set(key, Date.now() + ttl); },
            async delete(key) { store.delete(key); ttls.delete(key); },
            async invalidate(regex) { for (const k of [...store.keys()]) if (regex.test(k)) { store.delete(k); ttls.delete(k); } },
            isExpired(key) { const t = ttls.get(key); return t !== undefined && Date.now() >= t; }
        };
    }

    function okResponse(data, cacheControl) {
        return {
            ok: true, status: 200,
            headers: { get: (h) => (h === 'cache-control' ? cacheControl : 'application/json') },
            json: async () => data
        };
    }

    it('second GET with same key is served from cache (no second fetch)', async () => {
        fetchImpl.mockImplementation(() => Promise.resolve(okResponse({ a: 1 })));
        const cached = new APIWrapper(bus, { cache: stubCache(), retries: 0 });

        await cached.get('/items');
        await cached.get('/items');

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const hit = bus.events.filter((e) => e.name === 'API_REQUEST_SUCCESS' && e.payload.cache === 'hit');
        expect(hit).toHaveLength(1);
    });

    it('respects no-store: result is not cached', async () => {
        fetchImpl.mockImplementation(() => Promise.resolve(okResponse({ s: 1 }, 'no-store')));
        const cached = new APIWrapper(bus, { cache: stubCache(), retries: 0 });

        await cached.get('/secret');
        await cached.get('/secret');

        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('derives TTL from max-age header', async () => {
        fetchImpl.mockImplementation(() => Promise.resolve(okResponse({ m: 1 }, 'public, max-age=0')));
        const cache = stubCache();
        const cached = new APIWrapper(bus, { cache, retries: 0 });

        await cached.get('/fresh');
        // max-age=0 → already expired → second call refetches
        await cached.get('/fresh');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('mutation invalidates cached GETs for the endpoint', async () => {
        fetchImpl.mockImplementation((url, init) => {
            if ((init?.method || 'GET') === 'GET') return Promise.resolve(okResponse({ v: 1 }));
            return Promise.resolve(okResponse({ saved: true }));
        });
        const cache = stubCache();
        const cached = new APIWrapper(bus, { cache, retries: 0 });

        await cached.get('/things?x=1');
        await cached.post('/things', { v: 2 });
        await cached.get('/things?x=1');

        expect(fetchImpl.mock.calls.filter(([u, i]) => (i?.method || 'GET') === 'GET')).toHaveLength(2);
    });

    it('no cache configured: behavior unchanged', async () => {
        fetchImpl.mockImplementation(() => Promise.resolve(okResponse({ n: 1 })));
        const plain = new APIWrapper(bus, { retries: 0 });
        await plain.get('/plain');
        await plain.get('/plain');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
});
