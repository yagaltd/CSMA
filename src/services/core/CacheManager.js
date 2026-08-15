/**
 * CacheManager - Multi-strategy caching with TTL
 * Supports memory, localStorage, and IndexedDB backends
 * ~200 lines, ~2KB gzipped
 */

import { MemoryBackend } from './cache/backends/MemoryBackend.js';
import { LocalStorageBackend } from './cache/backends/LocalStorageBackend.js';
import { IndexedDBBackend } from './cache/backends/IndexedDBBackend.js';

export class CacheManager {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.backend = options.backend || 'memory';
        this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
        this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB
        this.debug = options.debug ?? false;
        this.initialized = false;
        this.destroyed = false;
        this._initPromise = null;

        // Initialize storage backend
        this.storage = this.createBackend(this.backend, options.storageOptions);

        // In-memory cache for quick access
        this.memoryCache = new Map();
        this.ttls = new Map();

        // Session memory-only fallback for keys whose persistent write
        // failed (e.g. localStorage quota exceeded). See set().
        this.persistFallback = new Map();

        // Statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            invalidations: 0
        };
    }

    async init() {
        if (this.destroyed) {
            this.destroyed = false;
        }

        if (this.initialized) {
            return this;
        }

        if (!this._initPromise) {
            this._initPromise = (async () => {
                if (typeof this.storage.init === 'function') {
                    await this.storage.init();
                }
                this.initialized = true;
                return this;
            })().finally(() => {
                this._initPromise = null;
            });
        }

        return this._initPromise;
    }

    async destroy() {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;

        try {
            if (typeof this.storage.destroy === 'function') {
                await this.storage.destroy();
            } else if (typeof this.storage.close === 'function') {
                await this.storage.close();
            }
        } finally {
            this.memoryCache.clear();
            this.ttls.clear();
            this.persistFallback.clear();
            this.initialized = false;
        }
    }

    createBackend(type, options) {
        switch (type) {
            case 'memory':
                return new MemoryBackend();
            case 'localStorage':
                return new LocalStorageBackend(options);
            case 'indexeddb':
                return new IndexedDBBackend(options);
            default:
                throw new Error(`Unknown backend type: ${type}`);
        }
    }

    /**
     * Get value from cache
     */
    async get(key) {
        await this.init();

        const result = await this._read(key);

        if (result.hit) {
            this._publish('CACHE_HIT', {
                key,
                source: result.source,
                ttlRemaining: result.ttlRemaining,
                timestamp: Date.now()
            });
            return result.value;
        }

        this._publish('CACHE_MISS', {
            key,
            timestamp: Date.now()
        });

        return undefined;
    }

    /**
     * Set value in cache
     */
    async set(key, value, ttl = this.defaultTTL) {
        await this.init();

        const expiresAt = this.resolveExpiry(ttl);

        // Store in memory
        this.memoryCache.set(key, value);
        this.ttls.set(key, expiresAt);

        // Store in persistent backend
        try {
            await this.storage.set(key, value);
        } catch (error) {
            // Persistence failed (e.g. localStorage quota exceeded): demote
            // the key to a session memory-only map so it still reads back,
            // and emit CACHE_PERSIST_FAILED for observability.
            this.persistFallback.set(key, value);
            this._publish('CACHE_PERSIST_FAILED', {
                key,
                error: error?.message || String(error),
                timestamp: Date.now()
            });
        }

        this.stats.sets++;

        this._publish('CACHE_SET', {
            key,
            ttl,
            size: this.estimateSize(value),
            expiresAt,
            timestamp: Date.now()
        });

        this.log('Cache set:', key, 'TTL:', ttl);
    }

    /**
     * Delete value from cache
     */
    async delete(key) {
        await this.init();

        this.memoryCache.delete(key);
        this.ttls.delete(key);
        this.persistFallback.delete(key);
        await this.storage.delete(key);

        this.stats.deletes++;
        this.log('Cache delete:', key);
    }

    /**
     * Fetch with caching strategy
     */
    async fetch(key, fetcher, options = {}) {
        await this.init();

        const {
            ttl = this.defaultTTL,
            strategy = 'cache-first'
        } = options;

        this.log(`Fetch (${strategy}):`, key);

        switch (strategy) {
            case 'cache-first':
                return this.cacheFirst(key, fetcher, ttl);
            case 'network-first':
                return this.networkFirst(key, fetcher, ttl);
            case 'stale-while-revalidate':
                return this.staleWhileRevalidate(key, fetcher, ttl);
            default:
                throw new Error(`Unknown strategy: ${strategy}`);
        }
    }

    /**
     * Cache-first: Return cached, fetch if miss
     */
    async cacheFirst(key, fetcher, ttl) {
        const cached = await this._read(key);

        if (cached.hit) {
            this._publish('CACHE_HIT', {
                key,
                strategy: 'cache-first',
                source: cached.source,
                timestamp: Date.now()
            });
            return cached.value;
        }

        this._publish('CACHE_MISS', {
            key,
            strategy: 'cache-first',
            timestamp: Date.now()
        });

        const fresh = await fetcher();
        await this.set(key, fresh, ttl);
        return fresh;
    }

    /**
     * Network-first: Fetch fresh, fallback to cache
     */
    async networkFirst(key, fetcher, ttl) {
        try {
            const fresh = await fetcher();
            await this.set(key, fresh, ttl);

            this._publish('CACHE_MISS', {
                key,
                strategy: 'network-first',
                timestamp: Date.now()
            });

            return fresh;
        } catch (error) {
            // Network failed, try cache
            const cached = await this._read(key);

            if (cached.hit) {
                this.log('Network failed, using stale cache:', key);
                this._publish('CACHE_HIT', {
                    key,
                    strategy: 'network-first',
                    stale: true,
                    source: cached.source,
                    timestamp: Date.now()
                });
                return cached.value;
            }

            throw error;
        }
    }

    /**
     * Stale-while-revalidate: Return cache, update in background
     */
    async staleWhileRevalidate(key, fetcher, ttl) {
        const cached = await this._read(key);

        // Revalidate in background (don't await)
        fetcher()
            .then(fresh => this.set(key, fresh, ttl))
            .catch(err => this.log('Background revalidation failed:', err));

        if (cached.hit) {
            this._publish('CACHE_HIT', {
                key,
                strategy: 'stale-while-revalidate',
                revalidating: true,
                source: cached.source,
                timestamp: Date.now()
            });
            return cached.value;
        }

        // No cache, wait for fresh
        const fresh = await fetcher();
        await this.set(key, fresh, ttl);

        this._publish('CACHE_MISS', {
            key,
            strategy: 'stale-while-revalidate',
            timestamp: Date.now()
        });

        return fresh;
    }

    /**
     * Invalidate cache by pattern
     */
    async invalidate(pattern) {
        await this.init();

        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        const keys = await this._keys();
        let count = 0;

        for (const key of keys) {
            if (regex.test(key)) {
                await this.delete(key);
                count++;
            }
        }

        this.stats.invalidations++;

        this._publish('CACHE_INVALIDATED', {
            pattern: pattern.toString(),
            count,
            timestamp: Date.now()
        });

        this.log('Invalidated', count, 'keys matching:', pattern);
    }

    /**
     * Clear all cache
     */
    async clear() {
        await this.init();

        const keys = await this._keys();
        this.memoryCache.clear();
        this.ttls.clear();
        this.persistFallback.clear();
        await this.storage.clear();

        this.stats.invalidations++;
        this._publish('CACHE_INVALIDATED', {
            pattern: '*',
            count: keys.length,
            reason: 'clear',
            timestamp: Date.now()
        });

        this.log('Cache cleared');
    }

    /**
     * Check if key is expired
     */
    isExpired(key) {
        const expiry = this.ttls.get(key);
        return expiry ? Date.now() > expiry : false;
    }

    resolveExpiry(ttl) {
        const duration = Number.isFinite(ttl) ? Math.max(0, ttl) : this.defaultTTL;
        return Date.now() + duration;
    }

    async _read(key) {
        let expired = false;

        if (this.memoryCache.has(key)) {
            if (!this.isExpired(key)) {
                this.stats.hits++;
                this.log('Cache hit (memory):', key);
                return {
                    hit: true,
                    source: 'memory',
                    value: this.memoryCache.get(key),
                    ttlRemaining: this._ttlRemaining(key)
                };
            }

            this.memoryCache.delete(key);
            expired = true;
        }

        const value = await this.storage.get(key);

        if (value !== undefined) {
            if (!expired && !this.isExpired(key)) {
                this.stats.hits++;
                this.memoryCache.set(key, value);
                this.log('Cache hit (storage):', key);
                return {
                    hit: true,
                    source: 'storage',
                    value,
                    ttlRemaining: this._ttlRemaining(key)
                };
            }

            await this.storage.delete(key);
            this.memoryCache.delete(key);
            this.ttls.delete(key);
        }

        // Serve the session memory-only fallback for keys whose persist
        // failed earlier, when the regular stores no longer have them.
        if (this.persistFallback.has(key)) {
            if (!expired && !this.isExpired(key)) {
                this.stats.hits++;
                const value = this.persistFallback.get(key);
                this.memoryCache.set(key, value);
                return {
                    hit: true,
                    source: 'memory',
                    value,
                    ttlRemaining: this._ttlRemaining(key)
                };
            }
            this.persistFallback.delete(key);
        }

        this.stats.misses++;
        this.log('Cache miss:', key);
        return { hit: false, source: 'miss', value: undefined, ttlRemaining: 0 };
    }

    async _keys() {
        const storageKeys = typeof this.storage.keys === 'function' ? await this.storage.keys() : [];
        const keys = new Set([...storageKeys, ...this.memoryCache.keys(), ...this.persistFallback.keys()]);
        return Array.from(keys);
    }

    _ttlRemaining(key) {
        const expiry = this.ttls.get(key);
        return expiry ? Math.max(0, expiry - Date.now()) : 0;
    }

    _publish(eventName, payload) {
        this.eventBus?.publish?.(eventName, payload);
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            ...this.stats,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
            memorySize: this.memoryCache.size,
            backend: this.backend
        };
    }

    /**
     * Estimate value size in bytes
     */
    estimateSize(value) {
        try {
            return new Blob([JSON.stringify(value)]).size;
        } catch {
            return 0;
        }
    }

    log(...args) {
        if (this.debug) {
            console.debug('[CacheManager]', ...args);
        }
    }
}

/**
 * Create CacheManager instance
 */
export function createCacheManager(eventBus, options = {}) {
    return new CacheManager(eventBus, options);
}
