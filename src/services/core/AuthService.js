const DEFAULT_ENDPOINTS = {
    register: '/auth/register',
    login: '/auth/login',
    logout: '/auth/logout',
    session: '/auth/me'
};

const ROLE_ORDER = ['guest', 'user', 'staff', 'admin', 'system'];

export class AuthService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        const runtimeBase = typeof window !== 'undefined' ? window.location.origin : '';
        const configBase = typeof window !== 'undefined' ? window.csma?.config?.apiBaseUrl : undefined;
        this.baseUrl = options.baseUrl || configBase || runtimeBase;
        this.endpoints = { ...DEFAULT_ENDPOINTS, ...(options.endpoints || {}) };
        this.currentUser = null;
    }

    async init() {
        await this.refreshSession().catch(() => null);
    }

    getUser() {
        return this.currentUser;
    }

    async register(values) {
        const response = await this._request('POST', this.endpoints.register, values);
        this._setUser(response.user || null);
        return { success: true, user: this.currentUser };
    }

    async login(values) {
        const response = await this._request('POST', this.endpoints.login, values);
        this._setUser(response.user || null);
        return { success: true, user: this.currentUser };
    }

    async logout() {
        await this._request('POST', this.endpoints.logout, {});
        this._setUser(null);
        return { success: true };
    }

    async refreshSession() {
        const response = await this._request('GET', this.endpoints.session);
        this._setUser(response.user || null);
        return { success: true, user: this.currentUser };
    }

    async _request(method, endpoint, body) {
        const url = this._resolveUrl(endpoint);
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
        });

        if (!res.ok) {
            const errorPayload = await safeParse(res);
            const error = new Error(errorPayload?.error || res.statusText);
            error.status = res.status;
            throw error;
        }

        return res.status === 204 ? {} : await res.json();
    }

    _resolveUrl(endpoint) {
        if (/^https?:/.test(endpoint)) {
            return endpoint;
        }
        const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${base}${path}`;
    }

    _setUser(user) {
        this.currentUser = user;
        this.eventBus?.publish?.('AUTH_SESSION_UPDATED', {
            user,
            timestamp: Date.now()
        });
    }

    getRole() {
        return this.currentUser?.role || 'guest';
    }

    hasRole(requiredRole) {
        if (!requiredRole) return true;
        const currentRole = this.getRole();
        return ROLE_ORDER.indexOf(currentRole) >= ROLE_ORDER.indexOf(requiredRole);
    }
}

async function safeParse(res) {
    try {
        return await res.json();
    } catch (error) {
        return null;
    }
}

export function createAuthService(eventBus, options) {
    const service = new AuthService(eventBus, options);
    return service;
}
