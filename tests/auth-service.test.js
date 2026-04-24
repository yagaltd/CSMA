import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthService } from '../src/services/core/AuthService.js';
import { AuthContracts } from '../src/modules/auth/contracts/auth-contracts.js';

function createMemoryStorage() {
    const store = new Map();
    return {
        getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
        setItem: vi.fn((key, value) => {
            store.set(key, String(value));
        }),
        removeItem: vi.fn((key) => {
            store.delete(key);
        }),
        clear: vi.fn(() => store.clear()),
        dump: () => Object.fromEntries(store.entries())
    };
}

class MockEventBus {
    constructor() {
        this.listeners = new Map();
        this.publish = vi.fn(async (eventName, payload) => {
            const handlers = this.listeners.get(eventName) || [];
            for (const handler of handlers) {
                await handler(payload);
            }
        });
    }

    subscribe(eventName, handler) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        this.listeners.get(eventName).push(handler);
        return () => {
            const handlers = this.listeners.get(eventName) || [];
            const index = handlers.indexOf(handler);
            if (index >= 0) {
                handlers.splice(index, 1);
            }
        };
    }
}

const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;
const originalSessionStorage = globalThis.sessionStorage;

beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
    globalThis.sessionStorage = createMemoryStorage();
    globalThis.fetch = vi.fn();
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
    globalThis.sessionStorage = originalSessionStorage;
    vi.restoreAllMocks();
});

describe('AuthService', () => {
    it('restores a cookie/session login and emits compatibility events', async () => {
        const eventBus = new MockEventBus();
        fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                user: { id: 'u-1', name: 'Ada', role: 'staff' },
                sessionId: 'sess-1'
            })
        });

        const auth = createAuthService(eventBus, { baseUrl: 'https://api.example.com' });
        const result = await auth.login({ email: 'ada@example.com', password: 'secret' });

        expect(result.success).toBe(true);
        expect(auth.getUser()).toEqual({ id: 'u-1', name: 'Ada', role: 'staff' });
        expect(auth.isAuthenticated()).toBe(true);
        expect(auth.getRole()).toBe('staff');
        expect(auth.hasRole('user')).toBe(true);
        expect(eventBus.publish).toHaveBeenCalledWith(
            'AUTH_SESSION_UPDATED',
            expect.objectContaining({ authenticated: true, sessionId: 'sess-1' })
        );
        expect(eventBus.publish).toHaveBeenCalledWith(
            'AUTH_LOGIN_SUCCEEDED',
            expect.objectContaining({ method: 'password', sessionId: 'sess-1' })
        );
        expect(eventBus.publish).toHaveBeenCalledWith(
            'USER_LOGGED_IN',
            expect.objectContaining({ sessionId: 'sess-1' })
        );
    });

    it('keeps JWT access tokens in memory by default and avoids refresh token persistence', async () => {
        const eventBus = new MockEventBus();
        fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                user: { id: 'u-2', role: 'admin' },
                accessToken: 'header.payload.signature',
                refreshToken: 'do-not-store',
                sessionId: 'sess-2'
            })
        });

        const auth = createAuthService(eventBus, {
            baseUrl: 'https://api.example.com',
            storage: {
                accessToken: 'sessionStorage',
                session: 'localStorage'
            }
        });

        await auth.login({ email: 'admin@example.com', password: 'secret' });

        expect(globalThis.sessionStorage.setItem).toHaveBeenCalledWith(
            expect.stringContaining('csma.auth.accessToken'),
            'header.payload.signature'
        );
        expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
            expect.stringContaining('csma.auth.session'),
            expect.any(String)
        );
        const stored = globalThis.localStorage.dump();
        expect(JSON.stringify(stored)).not.toContain('do-not-store');
        expect(auth.isAuthenticated()).toBe(true);
    });

    it('starts and completes backend-mediated OAuth without client secrets', async () => {
        const eventBus = new MockEventBus();
        fetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    authorizationUrl: 'https://oauth.example.com/authorize?state=abc',
                    state: 'abc'
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    user: { id: 'u-3', name: 'Mina', role: 'user' },
                    sessionId: 'sess-3'
                })
            });

        const auth = createAuthService(eventBus, { baseUrl: 'https://api.example.com' });
        const started = await auth.startOAuth({ provider: 'google', redirectUri: 'https://app.example.com/auth/callback' });
        const completed = await auth.handleOAuthCallback({ code: 'code-123', state: started.state, provider: 'google' });

        expect(started.authorizationUrl).toContain('oauth.example.com');
        expect(completed.success).toBe(true);
        expect(auth.getUser()).toEqual({ id: 'u-3', name: 'Mina', role: 'user' });
        expect(eventBus.publish).toHaveBeenCalledWith(
            'AUTH_OAUTH_STARTED',
            expect.objectContaining({ provider: 'google', state: 'abc' })
        );
        expect(eventBus.publish).toHaveBeenCalledWith(
            'AUTH_OAUTH_COMPLETED',
            expect.objectContaining({ provider: 'google' })
        );
    });

    it('refreshes a cookie session during init and clears auth on logout', async () => {
        const eventBus = new MockEventBus();
        fetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    user: { id: 'u-4', role: 'user' },
                    sessionId: 'sess-4'
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 204,
                json: async () => ({})
            });

        const auth = createAuthService(eventBus, { baseUrl: 'https://api.example.com' });
        await auth.init();
        await auth.logout({ reason: 'manual' });

        expect(auth.isAuthenticated()).toBe(false);
        expect(eventBus.publish).toHaveBeenCalledWith(
            'USER_LOGGED_OUT',
            expect.objectContaining({ reason: 'manual' })
        );
        expect(eventBus.publish).toHaveBeenCalledWith(
            'AUTH_SESSION_UPDATED',
            expect.objectContaining({ authenticated: false })
        );
    });
});

describe('AuthContracts', () => {
    it('keeps module-local auth contracts available', () => {
        expect(AuthContracts.AUTH_SESSION_UPDATED).toBeDefined();
        const [error] = AuthContracts.AUTH_SESSION_UPDATED.schema.validate({
            strategy: 'hybrid',
            authenticated: true,
            timestamp: Date.now()
        });
        expect(error).toBeUndefined();
    });
});
