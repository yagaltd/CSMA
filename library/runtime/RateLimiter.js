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
        // In-memory storage (cleared on page reload)
        this.limits = new Map();

        // Generate session ID (persists until browser tab closes)
        this.sessionId = this.generateSessionId();
    }

    /**
     * Generate or retrieve session ID from sessionStorage
     * @returns {string} Session identifier
     */
    generateSessionId() {
        const key = 'csma-session-id';

        if (!sessionStorage.getItem(key)) {
            // Generate cryptographically secure random ID
            sessionStorage.setItem(key, crypto.randomUUID());
        }

        return sessionStorage.getItem(key);
    }

    /**
     * Check if request is within rate limits
     * 
     * @param {string} key - Unique key for the rate limit (e.g., 'INTENT_CREATE_ITEM-user123')
     * @param {Object} limits - Rate limit configuration
     * @param {number} limits.requests - Maximum requests allowed
     * @param {number} limits.window - Time window in milliseconds
     * @returns {boolean} True if within limits, false if exceeded
     */
    checkRateLimit(key, limits) {
        const storageKey = `${this.sessionId}-${key}`;
        const now = Date.now();

        // Get or initialize request history
        let history = this.limits.get(storageKey) || [];

        // Remove timestamps outside the current window
        history = history.filter(timestamp =>
            now - timestamp < limits.window
        );

        // Check if limit exceeded
        if (history.length >= limits.requests) {
            return false; // Rate limit exceeded
        }

        // Add current request timestamp
        history.push(now);
        this.limits.set(storageKey, history);

        return true; // Within rate limits
    }

    /**
     * Reset rate limit for a specific key
     * Useful for testing or manual override
     * 
     * @param {string} key - Rate limit key to reset
     */
    reset(key) {
        const storageKey = `${this.sessionId}-${key}`;
        this.limits.delete(storageKey);
    }

    /**
     * Clear all rate limits for current session
     * Use sparingly - primarily for testing
     */
    resetAll() {
        this.limits.clear();
    }

    /**
     * Get current rate limit status for debugging
     * 
     * @param {string} key - Rate limit key to check
     * @returns {Object|null} Status object with requestCount and timestamps
     */
    getStatus(key) {
        const storageKey = `${this.sessionId}-${key}`;
        const history = this.limits.get(storageKey);

        if (!history) {
            return null;
        }

        return {
            key: storageKey,
            requestCount: history.length,
            timestamps: [...history],
            oldestRequest: new Date(Math.min(...history)).toISOString(),
            newestRequest: new Date(Math.max(...history)).toISOString()
        };
    }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
