import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCacheManager } from '../src/services/core/CacheManager.js';
import {
    createOfflineCacheRuntime,
    shouldCacheResponse,
    shouldHandleRequest
} from '../public/sw.js';

class StubEventBus {
    constructor() {
        this.publish = vi.fn();
    }
}

function createResponse(body, {
    status = 200,
    type = 'basic',
    headers = {}
} = {}) {
    const headerEntries = Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]);
    const headerMap = new Map(headerEntries);

    return {
        body,
        status,
        type,
        headers: {
            get(name) {
                return headerMap.get(String(name).toLowerCase()) ?? null;
            }
        },
        clone() {
            return createResponse(body, { status, type, headers });
        }
    };
}

function createRequest(url, {
    method = 'GET',
    mode = 'same-origin',
    accept = 'text/plain',
    authorization = null
} = {}) {
    return {
        url,
        method,
        mode,
        headers: {
            get(name) {
                const normalized = String(name).toLowerCase();
                if (normalized === 'accept') return accept;
                if (normalized === 'authorization') return authorization;
                return null;
            }
        }
    };
}

class FakeCache {
    constructor() {
        this.store = new Map();
        this.put = vi.fn(async (key, response) => {
            this.store.set(key, response);
        });
        this.match = vi.fn(async (key) => this.store.get(key));
    }
}

describe('CacheManager offline lifecycle', () => {
    it('supports init, get, set, delete, clear, and destroy with cache events', async () => {
        const eventBus = new StubEventBus();
        const cache = createCacheManager(eventBus, { backend: 'memory', defaultTTL: 1000 });

        await cache.init();
        await cache.set('alpha', { value: 1 }, 1000);

        expect(await cache.get('alpha')).toEqual({ value: 1 });
        expect(await cache.get('missing')).toBeUndefined();

        await cache.delete('alpha');
        expect(await cache.get('alpha')).toBeUndefined();

        await cache.set('beta', { value: 2 }, 1000);
        await cache.set('gamma', { value: 3 }, 1000);
        await cache.clear();
        await cache.destroy();

        expect(eventBus.publish).toHaveBeenCalledWith('CACHE_SET', expect.objectContaining({ key: 'alpha' }));
        expect(eventBus.publish).toHaveBeenCalledWith('CACHE_HIT', expect.objectContaining({ key: 'alpha', source: 'memory' }));
        expect(eventBus.publish).toHaveBeenCalledWith('CACHE_MISS', expect.objectContaining({ key: 'missing' }));
        expect(eventBus.publish).toHaveBeenCalledWith('CACHE_INVALIDATED', expect.objectContaining({ pattern: '*', reason: 'clear' }));
        expect(cache.getStats()).toEqual(expect.objectContaining({
            sets: 3,
            deletes: 1,
            invalidations: 1
        }));
    });

    it('expires entries based on TTL', async () => {
        const cache = createCacheManager(new StubEventBus(), { backend: 'memory', defaultTTL: 1000 });
        await cache.set('short-lived', { ok: true }, 1);
        cache.ttls.set('short-lived', Date.now() - 1);

        expect(await cache.get('short-lived')).toBeUndefined();
    });

    it('supports cache-first and network-first strategies without duplicating public get events', async () => {
        const eventBus = new StubEventBus();
        const cache = createCacheManager(eventBus, { backend: 'memory', defaultTTL: 1000 });
        const fetcher = vi.fn().mockResolvedValue({ from: 'network' });

        await expect(cache.fetch('resource', fetcher, { strategy: 'cache-first' })).resolves.toEqual({ from: 'network' });
        await expect(cache.fetch('resource', fetcher, { strategy: 'cache-first' })).resolves.toEqual({ from: 'network' });

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(eventBus.publish).toHaveBeenCalledWith('CACHE_MISS', expect.objectContaining({
            key: 'resource',
            strategy: 'cache-first'
        }));
        expect(eventBus.publish).toHaveBeenCalledWith('CACHE_HIT', expect.objectContaining({
            key: 'resource',
            strategy: 'cache-first'
        }));

        const failingFetcher = vi.fn().mockRejectedValue(new Error('network down'));
        await cache.set('fallback', { from: 'cache' }, 1000);

        await expect(cache.fetch('fallback', failingFetcher, { strategy: 'network-first' })).resolves.toEqual({ from: 'cache' });
        expect(eventBus.publish).toHaveBeenCalledWith('CACHE_HIT', expect.objectContaining({
            key: 'fallback',
            strategy: 'network-first',
            stale: true
        }));
    });
});

describe('service worker offline cache strategy', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('allows only same-origin GET requests for the shell and public assets', () => {
        const options = { origin: 'https://example.com' };

        expect(shouldHandleRequest(createRequest('https://example.com/assets/app.js'), options)).toBe(true);
        expect(shouldHandleRequest(createRequest('https://example.com/src/foo.js'), options)).toBe(false);
        expect(shouldHandleRequest(createRequest('https://example.com/api/items'), options)).toBe(false);
        expect(shouldHandleRequest(createRequest('https://example.com/forms/draft'), options)).toBe(false);
        expect(shouldHandleRequest(createRequest('https://example.com/optimistic/events'), options)).toBe(false);
        expect(shouldHandleRequest(createRequest('https://other.example/assets/app.js'), options)).toBe(false);
        expect(shouldHandleRequest(createRequest('https://example.com/assets/app.js', { method: 'POST' }), options)).toBe(false);
        expect(shouldHandleRequest(createRequest('https://example.com/assets/app.js', { authorization: 'Bearer token' }), options)).toBe(false);
    });

    it('rejects opaque and no-store responses from the cache', () => {
        expect(shouldCacheResponse(createResponse('ok'))).toBe(true);
        expect(shouldCacheResponse(createResponse('ok', { type: 'opaque' }))).toBe(false);
        expect(shouldCacheResponse(createResponse('ok', { headers: { 'cache-control': 'no-store' } }))).toBe(false);
        expect(shouldCacheResponse(createResponse('ok', { status: 204 }))).toBe(false);
    });

    it('serves cached assets first and falls back to the app shell when navigation fetch fails', async () => {
        const cache = new FakeCache();
        const shellUrl = 'https://example.com/index.html';
        const assetUrl = 'https://example.com/assets/app.js';
        cache.store.set(assetUrl, createResponse('cached asset'));
        cache.store.set(shellUrl, createResponse('cached shell'));

        const cachesImpl = {
            open: vi.fn(async () => cache),
            keys: vi.fn(async () => ['offline-cache-v1']),
            delete: vi.fn(async () => true)
        };

        const fetchImpl = vi.fn(async (request) => {
            if (request.url === assetUrl) {
                return createResponse('fresh asset');
            }

            throw new Error('offline');
        });

        const runtime = createOfflineCacheRuntime({
            cachesImpl,
            fetchImpl,
            origin: 'https://example.com',
            cacheName: 'offline-cache-v1'
        });

        const cachedAsset = await runtime.handleFetch(createRequest(assetUrl));
        expect(cachedAsset.body).toBe('cached asset');
        expect(fetchImpl).toHaveBeenCalledWith(expect.objectContaining({ url: assetUrl }));

        const cachedShell = await runtime.handleFetch(createRequest('https://example.com/dashboard', {
            mode: 'navigate',
            accept: 'text/html'
        }));
        expect(cachedShell.body).toBe('cached shell');
    });
});
