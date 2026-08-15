/**
 * AuthService module-level helpers (config constants, storage adapters,
 * JWT/OAuth payload builders).
 * Extracted verbatim from AuthService.js (Phase 6.6) — pure functions and
 * constants only; the AuthService class itself is untouched.
 */
const DEFAULT_ENDPOINTS = {
    register: '/auth/register',
    login: '/auth/login',
    logout: '/auth/logout',
    session: '/auth/me',
    refresh: '/auth/refresh',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    verifyEmail: '/auth/verify-email',
    resendVerification: '/auth/resend-verification',
    oauthStart: '/auth/oauth/start',
    oauthCallback: '/auth/oauth/callback'
};

const DEFAULT_STORAGE = {
    accessToken: 'memory',
    session: 'memory',
    oauthState: 'memory',
    keyPrefix: 'csma.auth'
};

const ROLE_ORDER = ['guest', 'user', 'staff', 'admin', 'system'];

const METHOD_BY_FLOW = {
    register: 'register',
    login: 'password',
    oauth: 'api-key',
    jwt: 'api-key',
    token: 'api-key'
};

function now() {
    return Date.now();
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStrategy(strategy) {
    return ['cookie', 'jwt', 'oauth', 'hybrid'].includes(strategy) ? strategy : 'cookie';
}

function normalizeMethod(method, fallback = 'password') {
    return ['password', 'register', 'api-key', 'oauth', 'jwt'].includes(method) ? method : fallback;
}

function parseJsonSafe(value) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function createStorageAdapter(mode, key, fallbackStorage) {
    if (!mode || mode === 'memory') {
        return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
        };
    }

    const storage = fallbackStorage || (mode === 'sessionStorage' ? globalThis.sessionStorage : globalThis.localStorage);
    if (!storage) {
        return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
        };
    }

    return {
        getItem: () => storage.getItem(key),
        setItem: (value) => storage.setItem(key, value),
        removeItem: () => storage.removeItem(key)
    };
}

function createMemoryStorageAdapter() {
    let value = null;
    return {
        getItem: () => value,
        setItem: (nextValue) => {
            value = String(nextValue);
        },
        removeItem: () => {
            value = null;
        }
    };
}

function mergeOptions(base, override = {}) {
    return {
        ...base,
        ...override,
        endpoints: {
            ...(base.endpoints || {}),
            ...(override.endpoints || {})
        },
        storage: {
            ...(base.storage || {}),
            ...(override.storage || {})
        },
        oauth: {
            ...(base.oauth || {}),
            ...(override.oauth || {})
        }
    };
}

function safeParseResponseBody(response) {
    if (!response || response.status === 204) {
        return Promise.resolve({});
    }

    return response.json().catch(() => ({}));
}

function randomState() {
    const bytes = new Uint8Array(32);
    const cryptoRef = globalThis.crypto;
    if (cryptoRef?.getRandomValues) {
        cryptoRef.getRandomValues(bytes);
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    if (cryptoRef?.randomUUID) {
        return cryptoRef.randomUUID();
    }
    throw new Error('Crypto API unavailable for OAuth state generation');
}

function parseJwtClaims(token) {
    if (typeof token !== 'string') {
        return {};
    }

    const parts = token.split('.');
    if (parts.length < 2) {
        return {};
    }

    try {
        const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        return JSON.parse(globalThis.atob ? globalThis.atob(padded) : Buffer.from(padded, 'base64').toString('utf8'));
    } catch {
        return {};
    }
}

function buildUser(payload) {
    return payload?.user || payload?.account || payload?.profile || payload?.data?.user || null;
}

function buildAccessToken(payload) {
    return payload?.accessToken || payload?.token || payload?.jwt || payload?.data?.accessToken || null;
}

function buildSessionId(payload) {
    return payload?.sessionId || payload?.session?.id || payload?.session?.sessionId || payload?.id || null;
}

function buildRole(user, payload) {
    return user?.role || payload?.role || payload?.session?.role || 'guest';
}

function buildProvider(payload, fallback = null) {
    return payload?.provider || payload?.session?.provider || fallback;
}

function buildExpiresAt(payload, accessToken) {
    const explicit = payload?.expiresAt || payload?.session?.expiresAt || payload?.tokenExpiresAt;
    if (explicit) {
        return Number(explicit) || null;
    }

    const claims = parseJwtClaims(accessToken);
    if (claims?.exp) {
        return Number(claims.exp) * 1000;
    }

    return null;
}

function buildRequestId(payload) {
    return payload?.requestId || payload?.traceId || null;
}

function resolveCallbackInput(input = {}) {
    if (typeof input === 'string') {
        const parsed = new URL(input, globalThis.location?.origin || 'https://localhost');
        return {
            code: parsed.searchParams.get('code'),
            state: parsed.searchParams.get('state'),
            error: parsed.searchParams.get('error'),
            provider: parsed.searchParams.get('provider'),
            redirectUri: parsed.searchParams.get('redirect_uri') || parsed.searchParams.get('redirectUri')
        };
    }

    if (isPlainObject(input)) {
        return {
            code: input.code || input.authorizationCode || null,
            state: input.state || null,
            error: input.error || null,
            provider: input.provider || null,
            redirectUri: input.redirectUri || null
        };
    }

    if (globalThis.window?.location) {
        const search = new URLSearchParams(globalThis.window.location.search || '');
        return {
            code: search.get('code'),
            state: search.get('state'),
            error: search.get('error'),
            provider: search.get('provider'),
            redirectUri: search.get('redirect_uri') || search.get('redirectUri')
        };
    }

    return {
        code: null,
        state: null,
        error: null,
        provider: null,
        redirectUri: null
    };
}


export {
    DEFAULT_ENDPOINTS,
    DEFAULT_STORAGE,
    ROLE_ORDER,
    METHOD_BY_FLOW,
    now,
    isPlainObject,
    normalizeStrategy,
    normalizeMethod,
    parseJsonSafe,
    createStorageAdapter,
    createMemoryStorageAdapter,
    mergeOptions,
    safeParseResponseBody,
    randomState,
    parseJwtClaims,
    buildUser,
    buildAccessToken,
    buildSessionId,
    buildRole,
    buildProvider,
    buildExpiresAt,
    buildRequestId,
    resolveCallbackInput
};
