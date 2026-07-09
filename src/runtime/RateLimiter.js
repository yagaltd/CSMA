/**
 * RateLimiter - In-Memory Rate Limiting
 * 
 * Provides session-scoped rate limiting using in-memory Map storage.
 * 
 * SECURITY NOTE: This is client-side rate limiting only, which provides
 * basic protection against abuse but can be bypassed by determined attackers.
 * 
 * For production apps with backends, implement server-side rate limiting:
 * - Node.js: express-rate-limit, rate-limiter-flexible
 * - Cloudflare: Built-in Rate Limiting Rules
 * - AWS: API Gateway throttling
 * 
 * For headless/static sites needing stronger client-side protection, consider:
 * - FingerprintJS (browser fingerprinting) - ~10KB
 * - ClientJS (lightweight fingerprinting) - ~5KB
 */

export class RateLimiter {
    constructor() {
        this.limits = new Map();
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        const key = 'csma-session-id';
        try {
            if (!globalThis.sessionStorage?.getItem(key)) {
                globalThis.sessionStorage?.setItem(key, crypto.randomUUID());
            }
            return globalThis.sessionStorage?.getItem(key) || crypto.randomUUID();
        } catch {
            return crypto.randomUUID();
        }
    }

    checkRateLimit(key, limits) {
        const storageKey = `${this.sessionId}-${key}`;
        const now = Date.now();
        const windowMs = limits.windowMs ?? limits.window;
        const maxRequests = limits.requests;

        if (!Number.isFinite(maxRequests) || !Number.isFinite(windowMs)) {
            throw new Error('Invalid rate limit. Expected { requests, windowMs, scope }.');
        }

        let bucket = this.limits.get(storageKey);
        if (!bucket || now - bucket.windowStart >= windowMs) {
            bucket = { count: 0, windowStart: now, windowMs };
        }

        if (bucket.count >= maxRequests) {
            this.limits.set(storageKey, bucket);
            return false;
        }

        bucket.count += 1;
        this.limits.set(storageKey, bucket);
        return true;
    }

    reset(key) {
        const storageKey = `${this.sessionId}-${key}`;
        this.limits.delete(storageKey);
    }

    resetAll() {
        this.limits.clear();
    }

    getStatus(key) {
        const storageKey = `${this.sessionId}-${key}`;
        const bucket = this.limits.get(storageKey);

        if (!bucket) {
            return null;
        }

        return {
            key: storageKey,
            requestCount: bucket.count,
            windowStart: new Date(bucket.windowStart).toISOString(),
            windowMs: bucket.windowMs
        };
    }
}

export const rateLimiter = new RateLimiter();
