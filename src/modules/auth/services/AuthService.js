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

export class AuthService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        const runtimeBase = typeof window !== 'undefined' ? window.location.origin : '';
        const configBase = typeof window !== 'undefined'
            ? window.csma?.config?.ssma?.baseUrl || window.csma?.config?.apiBaseUrl
            : undefined;

        this.options = mergeOptions({
            baseUrl: options.baseUrl || configBase || runtimeBase,
            strategy: 'cookie',
            credentials: 'include',
            endpoints: DEFAULT_ENDPOINTS,
            storage: DEFAULT_STORAGE,
            securityPolicy: options.securityPolicy || null,
            oauth: {
                redirect: false
            }
        }, options);
        this.securityPolicy = this.options.securityPolicy || { profile: this.options.securityProfile || 'production', auth: {} };

        this.baseUrl = this.options.baseUrl || '';
        this.#assertSecureConfig();
        this.endpoints = { ...DEFAULT_ENDPOINTS, ...(this.options.endpoints || {}) };
        this.strategy = normalizeStrategy(this.options.strategy);
        this.currentUser = null;
        this.accessToken = null;
        this.sessionId = null;
        this.sessionRecord = null;
        this.pendingOAuth = null;
        this.subscriptions = [];

        this.accessStorage = createStorageAdapter(
            this.options.storage?.accessToken,
            `${this.options.storage?.keyPrefix || DEFAULT_STORAGE.keyPrefix}.accessToken`
        );
        this.sessionStorage = createStorageAdapter(
            this.options.storage?.session,
            `${this.options.storage?.keyPrefix || DEFAULT_STORAGE.keyPrefix}.session`
        );
        this.oauthStorage = this.options.storage?.oauthState === 'sessionStorage'
            ? createStorageAdapter(
                'sessionStorage',
                `${this.options.storage?.keyPrefix || DEFAULT_STORAGE.keyPrefix}.oauth`
            )
            : createMemoryStorageAdapter();
        if (this.options.storage?.oauthState && !['memory', 'sessionStorage'].includes(this.options.storage.oauthState)) {
            throw new Error('OAuth state may only use memory or sessionStorage.');
        }

        this.#restoreFromStorage();
    }

    init(options = {}) {
        this.options = mergeOptions(this.options, options);
        this.securityPolicy = this.options.securityPolicy || this.securityPolicy || { profile: this.options.securityProfile || 'production', auth: {} };
        this.#assertSecureConfig();
        this.baseUrl = this.options.baseUrl || this.baseUrl || '';
        this.endpoints = { ...DEFAULT_ENDPOINTS, ...(this.options.endpoints || {}) };
        this.strategy = normalizeStrategy(this.options.strategy);

        this.accessStorage = createStorageAdapter(
            this.options.storage?.accessToken,
            `${this.options.storage?.keyPrefix || DEFAULT_STORAGE.keyPrefix}.accessToken`
        );
        this.sessionStorage = createStorageAdapter(
            this.options.storage?.session,
            `${this.options.storage?.keyPrefix || DEFAULT_STORAGE.keyPrefix}.session`
        );
        this.oauthStorage = this.options.storage?.oauthState === 'sessionStorage'
            ? createStorageAdapter('sessionStorage', `${this.options.storage?.keyPrefix || DEFAULT_STORAGE.keyPrefix}.oauth`)
            : this.oauthStorage || createMemoryStorageAdapter();

        this.#restoreFromStorage();
        this.#setupIntentHandlers();

        return this.refreshSession()
            .catch(() => null)
            .then(() => this);
    }

    async register(values = {}) {
        return this.#authenticate('register', values, {
            endpoint: this.endpoints.register
        });
    }

    async login(values = {}) {
        return this.#authenticate('login', values, {
            endpoint: this.endpoints.login
        });
    }

    async logout(values = {}) {
        const reason = values?.reason || 'user';
        try {
            await this.#request('POST', this.endpoints.logout, values, {
                includeAuth: true
            });
        } catch (error) {
            this.#publishError({
                method: 'api-key',
                error,
                code: error?.status ? String(error.status) : undefined
            });
        } finally {
            this.#clearSession({ reason });
        }

        return {
            success: true
        };
    }

    async forgotPassword(values = {}) {
        return this.#accountAction('forgot-password', values, {
            endpoint: this.endpoints.forgotPassword,
            eventName: 'AUTH_PASSWORD_RESET_REQUESTED',
            intentName: 'INTENT_AUTH_FORGOT_PASSWORD'
        });
    }

    async resetPassword(values = {}) {
        return this.#accountAction('reset-password', values, {
            endpoint: this.endpoints.resetPassword,
            eventName: 'AUTH_PASSWORD_RESET_COMPLETED',
            intentName: 'INTENT_AUTH_RESET_PASSWORD'
        });
    }

    async verifyEmail(values = {}) {
        return this.#accountAction('verify-email', values, {
            endpoint: this.endpoints.verifyEmail,
            eventName: 'AUTH_EMAIL_VERIFIED',
            intentName: 'INTENT_AUTH_VERIFY_EMAIL'
        });
    }

    async resendVerification(values = {}) {
        return this.#accountAction('resend-verification', values, {
            endpoint: this.endpoints.resendVerification,
            eventName: 'AUTH_VERIFICATION_RESENT',
            intentName: 'INTENT_AUTH_RESEND_VERIFICATION'
        });
    }

    async refreshSession() {
        try {
            const response = await this.#request('GET', this.endpoints.session, null, {
                includeAuth: true
            });

            if (!response || !Object.keys(response).length) {
                if (this.isAuthenticated()) {
                    this.#publishSessionUpdate('refresh');
                    return {
                        success: true,
                        user: this.currentUser,
                        sessionId: this.sessionId,
                        authenticated: true
                    };
                }

                return {
                    success: false,
                    authenticated: false,
                    user: null
                };
            }

            const session = this.#applySessionResponse(response, {
                flow: 'refresh',
                method: this.accessToken ? 'api-key' : 'password',
                requestId: buildRequestId(response)
            });

            return {
                success: session.authenticated,
                user: this.currentUser,
                sessionId: this.sessionId,
                authenticated: session.authenticated
            };
        } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
                this.#clearSession({ reason: 'expired' });
                this.#publishEvent('SESSION_EXPIRED', {
                    reason: 'unauthorized',
                    requestId: null
                });
                return {
                    success: false,
                    authenticated: false,
                    user: null
                };
            }

            this.#publishError({
                method: 'api-key',
                error,
                code: error?.status ? String(error.status) : undefined
            });
            throw error;
        }
    }

    async startOAuth(options = {}) {
        const provider = typeof options === 'string' ? options : options.provider || this.options.oauth?.provider || null;
        const redirectUri = isPlainObject(options)
            ? options.redirectUri || this.options.oauth?.redirectUri || this.#defaultRedirectUri()
            : this.options.oauth?.redirectUri || this.#defaultRedirectUri();
        this.#assertAllowedRedirectUri(redirectUri);
        const requestId = randomState();
        const payload = {
            provider,
            redirectUri,
            state: requestId,
            timestamp: now()
        };

        const response = await this.#request('POST', this.endpoints.oauthStart, payload, {
            includeAuth: false
        });

        const authorizationUrl = response.authorizationUrl || response.url || response.redirectUrl || null;
        const state = response.state || payload.state;
        this.pendingOAuth = { provider, state, redirectUri };
        this.#persistOAuthState(this.pendingOAuth);
        this.#publishEvent('AUTH_OAUTH_STARTED', {
            provider: provider || undefined,
            authorizationUrl: authorizationUrl || undefined,
            state: state || undefined
        });

        if (this.options.oauth?.redirect && authorizationUrl && globalThis.window?.location?.assign) {
            globalThis.window.location.assign(authorizationUrl);
        }

        return {
            success: true,
            authorizationUrl,
            state,
            provider
        };
    }

    async handleOAuthCallback(input = {}) {
        const callback = resolveCallbackInput(input);
        const pending = this.#loadOAuthState();

        if (callback.error) {
            const error = new Error(callback.error);
            this.#publishOAuthFailure({
                provider: callback.provider || pending?.provider || undefined,
                error,
                requestId: callback.state || pending?.state || undefined
            });
            throw error;
        }

        if (!pending?.state || !callback.state || callback.state !== pending.state) {
            const error = new Error('Invalid OAuth state');
            this.#publishOAuthFailure({
                provider: callback.provider || pending?.provider || undefined,
                error,
                requestId: callback.state || undefined
            });
            throw error;
        }

        const redirectUri = callback.redirectUri || pending?.redirectUri || this.options.oauth?.redirectUri || this.#defaultRedirectUri();
        this.#assertAllowedRedirectUri(redirectUri);

        const payload = {
            code: callback.code,
            state: callback.state,
            provider: callback.provider || pending?.provider || undefined,
            redirectUri,
            timestamp: now()
        };

        const response = await this.#request('POST', this.endpoints.oauthCallback, payload, {
            includeAuth: false
        });

        const session = this.#applySessionResponse(response, {
            flow: 'oauth',
            method: 'api-key',
            requestId: buildRequestId(response) || payload.state || payload.code
        });

        this.pendingOAuth = null;
        this.oauthStorage.removeItem();
        this.#publishEvent('AUTH_OAUTH_COMPLETED', {
            provider: payload.provider || undefined,
            requestId: payload.state || payload.code || undefined
        });

        return {
            success: session.authenticated,
            user: this.currentUser,
            sessionId: this.sessionId,
            authenticated: session.authenticated
        };
    }

    getUser() {
        return this.currentUser;
    }

    isAuthenticated() {
        return Boolean(this.currentUser || this.accessToken || this.sessionId);
    }

    getRole() {
        return this.currentUser?.role || this.sessionRecord?.role || 'guest';
    }

    hasRole(requiredRole) {
        if (!requiredRole) {
            return true;
        }

        return ROLE_ORDER.indexOf(this.getRole()) >= ROLE_ORDER.indexOf(requiredRole);
    }

    destroy() {
        this.subscriptions.forEach((unsubscribe) => unsubscribe?.());
        this.subscriptions = [];
        this.#clearSession({ reason: 'destroy' });
        this.pendingOAuth = null;
        this.oauthStorage.removeItem();
    }

    #setupIntentHandlers() {
        this.subscriptions.forEach((unsubscribe) => unsubscribe?.());
        this.subscriptions = [];

        if (!this.eventBus?.subscribe) {
            return;
        }

        this.subscriptions.push(
            this.eventBus.subscribe('INTENT_AUTH_LOGIN', (payload = {}) => this.login(payload)),
            this.eventBus.subscribe('INTENT_AUTH_REGISTER', (payload = {}) => this.register(payload)),
            this.eventBus.subscribe('INTENT_AUTH_LOGOUT', (payload = {}) => this.logout(payload)),
            this.eventBus.subscribe('INTENT_AUTH_FORGOT_PASSWORD', (payload = {}) => this.forgotPassword(payload)),
            this.eventBus.subscribe('INTENT_AUTH_RESET_PASSWORD', (payload = {}) => this.resetPassword(payload)),
            this.eventBus.subscribe('INTENT_AUTH_VERIFY_EMAIL', (payload = {}) => this.verifyEmail(payload)),
            this.eventBus.subscribe('INTENT_AUTH_RESEND_VERIFICATION', (payload = {}) => this.resendVerification(payload)),
            this.eventBus.subscribe('INTENT_AUTH_REFRESH_SESSION', () => this.refreshSession()),
            this.eventBus.subscribe('INTENT_AUTH_START_OAUTH', (payload = {}) => this.startOAuth(payload)),
            this.eventBus.subscribe('INTENT_AUTH_HANDLE_OAUTH_CALLBACK', (payload = {}) => this.handleOAuthCallback(payload))
        );
    }

    async #accountAction(flow, values, { endpoint, eventName, intentName }) {
        const requestId = values?.requestId || now().toString(36);
        try {
            const response = await this.#request('POST', endpoint, values, {
                includeAuth: flow === 'verify-email'
            });
            const payload = {
                flow,
                email: values?.email || response?.email || undefined,
                requestId: buildRequestId(response) || requestId,
                timestamp: now()
            };
            this.#publishEvent(eventName, payload);
            return {
                success: true,
                requestId: payload.requestId,
                message: response?.message,
                data: response
            };
        } catch (error) {
            this.#publishEvent('AUTH_ACCOUNT_ACTION_FAILED', {
                flow,
                intent: intentName,
                error: error?.message || String(error),
                code: error?.status ? String(error.status) : undefined,
                requestId,
                timestamp: now()
            });
            this.#publishError({
                method: 'password',
                error,
                code: error?.status ? String(error.status) : undefined,
                requestId
            });
            throw error;
        }
    }

    async #authenticate(flow, values, { endpoint }) {
        const method = normalizeMethod(values?.method || METHOD_BY_FLOW[flow], METHOD_BY_FLOW[flow]);
        const requestId = values?.requestId || now().toString(36);

        try {
            const response = await this.#request('POST', endpoint, values, {
                includeAuth: false
            });
            const session = this.#applySessionResponse(response, {
                flow,
                method,
                requestId
            });

            if (!session.authenticated) {
                throw new Error('Authentication response did not include a user or session');
            }

            if (flow === 'register') {
                this.#publishEvent('USER_REGISTERED', {
                    user: this.currentUser || undefined,
                    requestId,
                    timestamp: now()
                });
            }

            return {
                success: true,
                user: this.currentUser,
                sessionId: this.sessionId,
                authenticated: true
            };
        } catch (error) {
            this.#publishFailure(flow, method, error, requestId);
            throw error;
        }
    }

    async #request(method, endpoint, body, { includeAuth = true } = {}) {
        const url = this.#resolveUrl(endpoint);
        const headers = {
            'Content-Type': 'application/json'
        };

        if (includeAuth && this.accessToken) {
            headers.Authorization = `Bearer ${this.accessToken}`;
        }

        const response = await fetch(url, {
            method,
            headers,
            credentials: this.options.credentials || 'include',
            body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
        });

        if (!response.ok) {
            const errorPayload = await safeParseResponseBody(response);
            const error = new Error(errorPayload?.error || response.statusText || 'Request failed');
            error.status = response.status;
            error.payload = errorPayload;
            throw error;
        }

        return safeParseResponseBody(response);
    }

    #resolveUrl(endpoint) {
        if (!endpoint) {
            return endpoint;
        }

        if (/^https?:/i.test(endpoint)) {
            return endpoint;
        }

        const base = String(this.baseUrl || '').replace(/\/$/, '');
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${base}${path}`;
    }

    #assertSecureConfig() {
        const profile = this.securityPolicy?.profile || this.options.securityProfile || 'production';
        if (profile !== 'production') {
            return;
        }

        const tokenMode = this.options.storage?.accessToken || DEFAULT_STORAGE.accessToken;
        if (tokenMode !== 'memory') {
            throw new Error('CSMA production security forbids persistent access-token storage.');
        }

        const url = this.baseUrl ? new URL(this.baseUrl, globalThis.location?.origin || 'http://localhost') : null;
        if (url && url.origin !== globalThis.location?.origin && url.protocol !== 'https:') {
            throw new Error('CSMA production security requires HTTPS for external auth baseUrl.');
        }
    }

    #assertAllowedRedirectUri(redirectUri) {
        const profile = this.securityPolicy?.profile || this.options.securityProfile || 'production';
        if (profile !== 'production' || !redirectUri) {
            return;
        }

        const url = new URL(redirectUri, globalThis.location?.origin || 'http://localhost');
        const allowedOrigins = this.securityPolicy?.auth?.allowedRedirectOrigins || [];
        const allowedUris = this.securityPolicy?.auth?.allowedRedirectUris || [];
        const sameOrigin = globalThis.location?.origin && url.origin === globalThis.location.origin;
        if (!sameOrigin && !allowedOrigins.includes(url.origin) && !allowedUris.includes(url.href)) {
            throw new Error('CSMA production security rejected OAuth redirect URI outside the allowlist.');
        }
    }

    #applySessionResponse(payload, { flow, method, requestId } = {}) {
        const user = buildUser(payload);
        const token = buildAccessToken(payload);
        const role = buildRole(user, payload);
        const provider = buildProvider(payload, flow === 'oauth' ? this.pendingOAuth?.provider : null);
        const expiresAt = buildExpiresAt(payload, token);
        const strategy = normalizeStrategy(payload?.strategy || payload?.session?.strategy || (flow === 'oauth' ? 'oauth' : (token ? 'jwt' : 'cookie')));
        const sessionId = buildSessionId(payload) || ((user || token) ? `auth-${requestId || now().toString(36)}` : null);
        const authenticated = Boolean(user || token || sessionId);

        this.currentUser = user;
        this.accessToken = token || (flow === 'refresh' ? this.accessToken : null);
        this.sessionId = sessionId;
        this.strategy = strategy;
        this.sessionRecord = authenticated
            ? {
                sessionId: this.sessionId,
                role,
                strategy,
                provider,
                expiresAt,
                authenticatedAt: now(),
                user
            }
            : null;

        if (this.accessToken) {
            this.accessStorage.setItem(this.accessToken);
        } else {
            this.accessStorage.removeItem();
        }

        if (this.sessionRecord) {
            this.sessionStorage.setItem(JSON.stringify(this.#serializableSessionRecord()));
        } else {
            this.sessionStorage.removeItem();
        }

        this.#publishSessionUpdate(flow, {
            requestId,
            authenticated,
            role,
            provider,
            strategy
        });

        if (flow !== 'refresh' && authenticated && this.sessionId) {
            const publishedMethod = flow === 'register'
                ? 'register'
                : (token ? 'api-key' : method);

            this.#publishEvent('AUTH_LOGIN_SUCCEEDED', {
                method: publishedMethod,
                userId: user?.id || user?.userId || undefined,
                sessionId: this.sessionId,
                requestId,
                timestamp: now()
            });

            this.#publishEvent('USER_LOGGED_IN', {
                user: user || undefined,
                sessionId: this.sessionId,
                timestamp: now()
            });
        }

        if (token) {
            this.#publishEvent('TOKEN_REFRESHED', {
                requestId,
                timestamp: now()
            });
        }

        return {
            user,
            token,
            sessionId: this.sessionId,
            authenticated,
            strategy
        };
    }

    #serializableSessionRecord() {
        if (!this.sessionRecord) {
            return null;
        }

        return {
            sessionId: this.sessionRecord.sessionId || null,
            role: this.sessionRecord.role || 'guest',
            strategy: this.sessionRecord.strategy || 'hybrid',
            provider: this.sessionRecord.provider || null,
            expiresAt: this.sessionRecord.expiresAt || null,
            authenticatedAt: this.sessionRecord.authenticatedAt || now(),
            user: this.sessionRecord.user || null
        };
    }

    #restoreFromStorage() {
        const storedAccessToken = this.accessStorage.getItem();
        if (storedAccessToken) {
            this.accessToken = storedAccessToken;
        }

        const storedSession = parseJsonSafe(this.sessionStorage.getItem());
        if (storedSession) {
            this.sessionRecord = storedSession;
            this.sessionId = storedSession.sessionId || null;
            this.currentUser = storedSession.user || this.currentUser;
            this.strategy = normalizeStrategy(storedSession.strategy || this.strategy);
        }

        const storedOAuth = parseJsonSafe(this.oauthStorage.getItem());
        if (storedOAuth) {
            this.pendingOAuth = storedOAuth;
        }
    }

    #persistOAuthState(state) {
        if (!state) {
            this.oauthStorage.removeItem();
            return;
        }

        this.oauthStorage.setItem(JSON.stringify(state));
    }

    #loadOAuthState() {
        if (this.pendingOAuth) {
            return this.pendingOAuth;
        }

        return parseJsonSafe(this.oauthStorage.getItem());
    }

    #defaultRedirectUri() {
        if (globalThis.window?.location) {
            return `${globalThis.window.location.origin}${globalThis.window.location.pathname}`;
        }

        return this.baseUrl || '';
    }

    #clearSession({ reason = 'logout' } = {}) {
        this.currentUser = null;
        this.accessToken = null;
        this.sessionId = null;
        this.sessionRecord = null;
        this.accessStorage.removeItem();
        this.sessionStorage.removeItem();

        this.#publishSessionUpdate(reason, {
            authenticated: false,
            role: 'guest'
        });

        this.#publishEvent('USER_LOGGED_OUT', {
            reason,
            timestamp: now()
        });
    }

    #publishSessionUpdate(reason, extras = {}) {
        this.#publishEvent('AUTH_SESSION_UPDATED', {
            user: this.currentUser || undefined,
            sessionId: this.sessionId || undefined,
            strategy: this.strategy || 'hybrid',
            authenticated: this.isAuthenticated(),
            role: this.getRole(),
            provider: this.sessionRecord?.provider || undefined,
            requestId: extras.requestId || undefined,
            reason,
            timestamp: now()
        });
    }

    #publishFailure(flow, method, error, requestId) {
        this.#publishEvent('AUTH_LOGIN_FAILED', {
            method: normalizeMethod(method, METHOD_BY_FLOW[flow]),
            error: error?.message || String(error),
            code: error?.status ? String(error.status) : undefined,
            requestId,
            timestamp: now()
        });

        this.#publishError({
            method: normalizeMethod(method, METHOD_BY_FLOW[flow]),
            error,
            code: error?.status ? String(error.status) : undefined,
            requestId
        });
    }

    #publishOAuthFailure({ provider, error, requestId }) {
        this.#publishEvent('AUTH_OAUTH_FAILED', {
            provider: provider || undefined,
            error: error?.message || String(error),
            requestId,
            timestamp: now()
        });
        this.#publishError({
            method: 'oauth',
            error,
            requestId
        });
    }

    #publishError({ method, error, code, requestId }) {
        this.#publishEvent('AUTH_ERROR', {
            method: method || undefined,
            error: error?.message || String(error),
            code,
            requestId,
            timestamp: now()
        });
    }

    #publishEvent(name, payload) {
        this.eventBus?.publish?.(name, payload);
    }
}

export function createAuthService(eventBus, options = {}) {
    return new AuthService(eventBus, options);
}
