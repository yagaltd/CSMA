/**
 * CSMA cache contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, boolean, optional, looseObject } from '../validation/index.js';

export const CacheContracts = {
    CACHE_SET: {
        version: 1,
        type: 'event',
        owner: 'cache-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when a cache entry is written',

        schema: object({
            key: string(),
            ttl: number(),
            size: number(),
            timestamp: number()
        })
    },

    CACHE_HIT: {
        version: 1,
        type: 'event',
        owner: 'cache-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when a cache strategy returns a cached entry',

        schema: object({
            key: string(),
            strategy: optional(string()),
            source: optional(string()),
            ttlRemaining: optional(number()),
            stale: optional(boolean()),
            revalidating: optional(boolean()),
            timestamp: number()
        })
    },

    CACHE_MISS: {
        version: 1,
        type: 'event',
        owner: 'cache-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when a cache strategy falls back to a fresh value',

        schema: object({
            key: string(),
            strategy: optional(string()),
            timestamp: number()
        })
    },

    CACHE_INVALIDATED: {
        version: 1,
        type: 'event',
        owner: 'cache-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when cache entries are invalidated by pattern',

        schema: object({
            pattern: string(),
            count: number(),
            reason: optional(string()),
            timestamp: number()
        })
    },

    CACHE_PERSIST_FAILED: {
        version: 1,
        type: 'event',
        owner: 'cache-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when a cache write fails to persist (quota/storage failure); the key is demoted to memory-only for the session',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: looseObject({
            key: string(),
            error: string(),
            timestamp: number()
        })
    },
};
