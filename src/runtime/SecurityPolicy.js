const SECURITY_PROFILES = new Set(['production', 'development', 'test']);

const DEFAULT_POLICY = {
    profile: 'production',
    auth: {
        tokenStorage: 'memory',
        sessionStorage: 'memory',
        allowedRedirectOrigins: [],
        allowedRedirectUris: [],
        allowedAuthorizationOrigins: [],
        allowedAuthorizationUris: []
    },
    forms: {
        autoSave: false,
        maxFieldLength: 4096,
        maxPayloadBytes: 65536,
        sensitiveFields: ['password', 'passcode', 'token', 'secret', 'ssn', 'creditCard', 'cardNumber', 'cvv'],
        requireIntegrityForPublicNetwork: true
    },
    transport: {
        allowedOrigins: [],
        maxMessageBytes: 65536,
        maxJsonDepth: 12,
        maxArrayLength: 500,
        maxViolations: 3
    },
    storage: {
        blockSensitivePersistence: true
    },
    cache: {
        sensitivePrefixes: ['/api/', '/auth/', '/forms/', '/media/', '/logs/', '/optimistic/', '/query/', '/admin/', '/internal/']
    },
    csp: {
        required: true,
        template: "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; connect-src 'self'"
    },
    globals: {
        exposeInternals: false
    },
    rateLimits: {
        defaultPublicIntent: { requests: 60, windowMs: 60000, scope: 'session' }
    }
};

const DEVELOPMENT_OVERRIDES = {
    profile: 'development',
    auth: {
        tokenStorage: 'sessionStorage',
        sessionStorage: 'localStorage'
    },
    forms: {
        autoSave: true,
        requireIntegrityForPublicNetwork: false
    },
    globals: {
        exposeInternals: true
    },
    storage: {
        blockSensitivePersistence: false
    }
};

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, override = {}) {
    const result = { ...base };
    for (const [key, value] of Object.entries(override || {})) {
        if (isPlainObject(value) && isPlainObject(result[key])) {
            result[key] = mergeDeep(result[key], value);
        } else if (Array.isArray(value)) {
            result[key] = [...value];
        } else if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}

export function resolveSecurityPolicy(runtimeConfig = {}) {
    const requestedProfile = runtimeConfig.securityProfile || runtimeConfig.security?.profile || 'production';
    const profile = SECURITY_PROFILES.has(requestedProfile) ? requestedProfile : 'production';
    const profileDefaults = profile === 'development' ? DEVELOPMENT_OVERRIDES : { profile };
    const policy = mergeDeep(mergeDeep(DEFAULT_POLICY, profileDefaults), runtimeConfig.security || {});

    policy.profile = profile;
    return policy;
}

function parseUrl(value, base = globalThis.location?.origin || 'http://localhost') {
    try {
        return new URL(value, base);
    } catch {
        return null;
    }
}

export function isAllowedOrigin(urlLike, allowedOrigins = [], { allowSameOrigin = true } = {}) {
    const url = parseUrl(urlLike);
    if (!url) {
        return false;
    }

    const currentOrigin = globalThis.location?.origin || null;
    if (allowSameOrigin && currentOrigin && url.origin === currentOrigin) {
        return true;
    }

    return allowedOrigins.some((origin) => origin === url.origin || origin === url.href);
}

export function assertProductionSecurityPolicy(policy, runtimeConfig = {}) {
    if (policy.profile !== 'production') {
        return;
    }

    const authConfig = runtimeConfig.auth || {};
    const authStorage = authConfig.storage || {};
    const tokenMode = authStorage.accessToken || policy.auth.tokenStorage || 'memory';
    if (tokenMode && tokenMode !== 'memory') {
        throw new Error('CSMA production security forbids persistent access-token storage. Use memory or securityProfile: "development".');
    }

    const baseUrl = authConfig.baseUrl || runtimeConfig.ssma?.baseUrl || '';
    const base = parseUrl(baseUrl);
    if (base && base.origin !== globalThis.location?.origin && base.protocol !== 'https:') {
        throw new Error('CSMA production security requires HTTPS for external API bases.');
    }

    const redirectUri = authConfig.oauth?.redirectUri;
    if (redirectUri && !isAllowedOrigin(redirectUri, policy.auth.allowedRedirectOrigins, { allowSameOrigin: true }) &&
        !policy.auth.allowedRedirectUris.includes(redirectUri)) {
        throw new Error('CSMA production security rejected an OAuth redirect URI outside the allowlist.');
    }

    const ssmaEndpoints = [
        runtimeConfig.ssma?.baseUrl,
        runtimeConfig.optimisticSync?.wsEndpoint,
        runtimeConfig.optimisticSync?.eventsEndpoint
    ].filter(Boolean);
    for (const endpoint of ssmaEndpoints) {
        const url = parseUrl(endpoint);
        if (!url || url.origin === globalThis.location?.origin) {
            continue;
        }
        if (!policy.transport.allowedOrigins.includes(url.origin)) {
            throw new Error(`CSMA production security rejected cross-origin SSMA endpoint: ${url.origin}`);
        }
        if (globalThis.location?.protocol === 'https:' && !['https:', 'wss:'].includes(url.protocol)) {
            throw new Error('CSMA production security requires secure SSMA transport under HTTPS.');
        }
    }
}
