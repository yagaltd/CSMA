import { normalizeRoutePath } from '../../../runtime/pageRouting.js';

function normalizePattern(pattern) {
    return normalizeRoutePath(pattern || '/');
}

function compilePattern(pattern) {
    const normalized = normalizePattern(pattern);
    if (normalized === '/') {
        return {
            pattern: '/',
            regex: /^\/$/,
            paramNames: []
        };
    }

    const paramNames = [];
    const parts = normalized
        .split('/')
        .filter(Boolean)
        .map((segment) => {
            const colonMatch = /^:([A-Za-z0-9_]+)$/.exec(segment);
            const braceMatch = /^\{([A-Za-z0-9_]+)\}$/.exec(segment);
            const paramName = colonMatch?.[1] || braceMatch?.[1];
            if (paramName) {
                paramNames.push(paramName);
                return '([^/]+)';
            }

            return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        });

    return {
        pattern: normalized,
        regex: new RegExp(`^/${parts.join('/')}$`),
        paramNames
    };
}

function normalizeRouteEntry(route, index) {
    if (!route || typeof route !== 'object' || Array.isArray(route)) {
        throw new Error('[RouterService] routes must be objects.');
    }

    const pattern = normalizePattern(route.path || route.pattern || '/');
    const compiled = compilePattern(pattern);
    return {
        id: route.id || `route-${index + 1}`,
        ...route,
        path: pattern,
        pattern,
        regex: compiled.regex,
        paramNames: compiled.paramNames
    };
}

function matchRoute(route, pathname) {
    const matched = route.regex.exec(pathname);
    if (!matched) {
        return null;
    }

    const params = route.paramNames.reduce((accumulator, name, index) => {
        accumulator[name] = decodeURIComponent(matched[index + 1]);
        return accumulator;
    }, {});

    return {
        route,
        params
    };
}

export class RouterService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.mode = 'spa';
        this.routes = [];
        this.notFoundRoute = null;
        this.beforeHooks = [];
        this.afterHooks = [];
        this.renderer = null;
        this.target = '#app';
        this.viewRegistry = null;
        this.clientNavigation = null;
        this.currentRoute = null;
        this.subscriptions = [];
    }

    init({
        mode = 'spa',
        routes = [],
        notFound = null,
        target = '#app',
        viewRegistry = null,
        renderer = null,
        clientNavigation = null
    } = {}) {
        this.mode = mode;
        this.routes = routes.map((route, index) => normalizeRouteEntry(route, index));
        this.notFoundRoute = notFound ? normalizeRouteEntry({
            id: notFound.id || 'not-found',
            path: '/404',
            ...notFound
        }, routes.length) : null;
        this.target = target;
        this.viewRegistry = viewRegistry;
        this.renderer = renderer;
        this.clientNavigation = clientNavigation;

        this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
        this.subscriptions.push(
            this.eventBus?.subscribe('INTENT_ROUTE_NAVIGATE', (payload = {}) => this.navigate(payload.path, payload)) || null
        );
    }

    setRenderer(renderer) {
        this.renderer = renderer;
    }

    setClientNavigation(clientNavigation) {
        this.clientNavigation = clientNavigation;
    }

    addBeforeEach(hook) {
        if (typeof hook !== 'function') {
            return () => {};
        }

        this.beforeHooks.push(hook);
        return () => {
            this.beforeHooks = this.beforeHooks.filter((entry) => entry !== hook);
        };
    }

    addAfterEach(hook) {
        if (typeof hook !== 'function') {
            return () => {};
        }

        this.afterHooks.push(hook);
        return () => {
            this.afterHooks = this.afterHooks.filter((entry) => entry !== hook);
        };
    }

    getCurrentRoute() {
        return this.currentRoute ? {
            ...this.currentRoute,
            params: { ...(this.currentRoute.params || {}) }
        } : null;
    }

    canHandlePath(pathname) {
        const normalizedPath = normalizeRoutePath(pathname);
        return Boolean(this.match(normalizedPath) || this.notFoundRoute);
    }

    match(pathname) {
        const normalizedPath = normalizeRoutePath(pathname);
        for (const route of this.routes) {
            const matched = matchRoute(route, normalizedPath);
            if (matched) {
                return {
                    ...matched,
                    pathname: normalizedPath,
                    isNotFound: false
                };
            }
        }

        return null;
    }

    async navigate(path, options = {}) {
        if (this.clientNavigation?.navigate) {
            return this.clientNavigation.navigate(path, options);
        }

        return this.handlePath(path, options);
    }

    async handlePath(pathname, { source = 'router', replace = false } = {}) {
        const normalizedPath = normalizeRoutePath(pathname);
        this.eventBus?.publishSync?.('ROUTE_NAVIGATION_STARTED', {
            path: normalizedPath,
            source,
            timestamp: Date.now()
        });

        const matched = this.match(normalizedPath);
        const resolved = matched || (this.notFoundRoute ? {
            route: this.notFoundRoute,
            params: {},
            pathname: normalizedPath,
            isNotFound: true
        } : null);

        if (!resolved) {
            this.eventBus?.publishSync?.('ROUTE_NOT_FOUND', {
                path: normalizedPath,
                routeId: 'not-found',
                source,
                timestamp: Date.now()
            });
            return null;
        }

        for (const hook of this.beforeHooks) {
            const result = await hook(resolved, { source, replace });
            if (result === false) {
                this.eventBus?.publishSync?.('ROUTE_BLOCKED', {
                    path: normalizedPath,
                    reason: 'beforeEach blocked navigation',
                    source,
                    timestamp: Date.now()
                });
                return null;
            }
        }

        try {
            const routeContext = {
                ...resolved,
                source,
                replace,
                target: resolved.route.target || this.target
            };

            if (resolved.route.viewId && this.viewRegistry) {
                await this.viewRegistry.render(resolved.route.viewId, {
                    target: routeContext.target,
                    props: resolved.route.props || {},
                    state: {
                        params: resolved.params,
                        ...(resolved.route.state || {})
                    }
                }, { source });
            } else if (typeof resolved.route.render === 'function') {
                await resolved.route.render(routeContext);
            } else if (typeof this.renderer === 'function') {
                await this.renderer(routeContext);
            }

            this.currentRoute = {
                path: normalizedPath,
                routeId: resolved.route.id,
                pattern: resolved.route.pattern,
                title: resolved.route.title || null,
                params: resolved.params,
                isNotFound: resolved.isNotFound
            };

            this.eventBus?.publishSync?.(resolved.isNotFound ? 'ROUTE_NOT_FOUND' : 'ROUTE_CHANGED', {
                path: normalizedPath,
                routeId: resolved.route.id,
                pattern: resolved.route.pattern,
                ...(resolved.route.title ? { title: resolved.route.title } : {}),
                params: resolved.params,
                source,
                timestamp: Date.now()
            });

            for (const hook of this.afterHooks) {
                await hook(this.currentRoute, { source, replace });
            }

            return this.getCurrentRoute();
        } catch (error) {
            this.eventBus?.publishSync?.('ROUTE_NAVIGATION_FAILED', {
                path: normalizedPath,
                error: error?.message || String(error),
                source,
                timestamp: Date.now()
            });
            throw error;
        }
    }

    destroy() {
        this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
        this.beforeHooks = [];
        this.afterHooks = [];
        this.routes = [];
        this.notFoundRoute = null;
        this.currentRoute = null;
    }
}
