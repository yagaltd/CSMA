/**
 * RateLimiter per-session isolation tests (audit plan 3.3)
 *
 * Proves the existing behavior documented in src/runtime/RateLimiter.js:
 * buckets are keyed by `storageKey = sessionId-key`, so
 *  - two different keys/events on one session do NOT share buckets,
 *  - two different sessions do NOT share buckets (no global 'anonymous' bucket),
 *  - the same key on the same session DOES share its bucket,
 *  - getStatus reports the storageKey containing the sessionId.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RateLimiter } from '../src/runtime/RateLimiter.js';

const LIMITS = { requests: 2, windowMs: 60_000, scope: 'session' };
const SINGLE = { requests: 1, windowMs: 60_000, scope: 'session' };

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('RateLimiter per-session isolation', () => {
    it('shares a bucket for the same key on the same session', () => {
        const limiter = new RateLimiter();

        expect(limiter.checkRateLimit('event-a', LIMITS)).toBe(true);
        expect(limiter.checkRateLimit('event-a', LIMITS)).toBe(true);
        // Third request in the same window: bucket exhausted.
        expect(limiter.checkRateLimit('event-a', LIMITS)).toBe(false);
    });

    it('does not share buckets between different keys on the same session', () => {
        const limiter = new RateLimiter();

        // Exhaust event-a.
        expect(limiter.checkRateLimit('event-a', SINGLE)).toBe(true);
        expect(limiter.checkRateLimit('event-a', SINGLE)).toBe(false);

        // event-b has its own bucket and must still be allowed.
        expect(limiter.checkRateLimit('event-b', SINGLE)).toBe(true);
        expect(limiter.checkRateLimit('event-b', SINGLE)).toBe(false);

        // Same event name ('event-a') with a different limits object: the
        // bucket is keyed by key, not by the limits object, so the count
        // from the SINGLE calls carries over — only one slot of two remains.
        expect(limiter.checkRateLimit('event-a', LIMITS)).toBe(true);
        expect(limiter.checkRateLimit('event-a', LIMITS)).toBe(false);
    });

    it('does not share buckets between different sessions for the same key', () => {
        // Force deterministic, distinct session ids.
        vi.spyOn(RateLimiter.prototype, 'generateSessionId')
            .mockReturnValueOnce('session-a')
            .mockReturnValueOnce('session-b');

        const firstSession = new RateLimiter();
        const secondSession = new RateLimiter();

        expect(firstSession.sessionId).toBe('session-a');
        expect(secondSession.sessionId).toBe('session-b');

        // Exhaust the key in session A.
        expect(firstSession.checkRateLimit('login', SINGLE)).toBe(true);
        expect(firstSession.checkRateLimit('login', SINGLE)).toBe(false);

        // Session B has its own bucket for the same key.
        expect(secondSession.checkRateLimit('login', SINGLE)).toBe(true);
        expect(secondSession.checkRateLimit('login', SINGLE)).toBe(false);
    });

    it('keys the storage key with the session id', () => {
        vi.spyOn(RateLimiter.prototype, 'generateSessionId').mockReturnValueOnce('session-a');

        const limiter = new RateLimiter();
        limiter.checkRateLimit('event-c', LIMITS);

        const status = limiter.getStatus('event-c');
        expect(status).not.toBeNull();
        expect(status.key).toBe('session-a-event-c');
        expect(status.key).toContain(limiter.sessionId);
    });

    it('returns null status for a key that has never been checked', () => {
        const limiter = new RateLimiter();
        expect(limiter.getStatus('never-checked')).toBeNull();
    });

    it('resets a bucket when reset(key) is called', () => {
        const limiter = new RateLimiter();

        expect(limiter.checkRateLimit('event-d', SINGLE)).toBe(true);
        expect(limiter.checkRateLimit('event-d', SINGLE)).toBe(false);

        limiter.reset('event-d');
        expect(limiter.checkRateLimit('event-d', SINGLE)).toBe(true);
    });

    it('opens a fresh bucket after the window elapses', () => {
        vi.useFakeTimers();
        const limiter = new RateLimiter();

        expect(limiter.checkRateLimit('event-e', { requests: 1, windowMs: 1000, scope: 'session' })).toBe(true);
        expect(limiter.checkRateLimit('event-e', { requests: 1, windowMs: 1000, scope: 'session' })).toBe(false);

        vi.advanceTimersByTime(1001);
        expect(limiter.checkRateLimit('event-e', { requests: 1, windowMs: 1000, scope: 'session' })).toBe(true);
    });

    it('throws on invalid limits', () => {
        const limiter = new RateLimiter();
        expect(() => limiter.checkRateLimit('event-f', { requests: 'nope' })).toThrow(/Invalid rate limit/);
    });
});
