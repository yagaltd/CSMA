/**
 * Router - Lightweight SPA routing (~2KB)
 * Hash-based routing with EventBus integration
 */
import { LifecycleScope } from '../../../runtime/LifecycleScope.js';

export class Router {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.routes = new Map();
        this.guards = [];
        this.currentRoute = null;
        this.notFoundHandler = () => this.renderNotFound();
        this.lifecycle = new LifecycleScope('Router');
        this.handleRouteChange = this.handleRoute.bind(this);
        this.destroyed = false;

        this.setupRouting();
    }

    setupRouting() {
        // Listen to hash changes
        this.lifecycle.listen(window, 'hashchange', this.handleRouteChange);
        this.lifecycle.listen(window, 'load', this.handleRouteChange);
    }

    /**
     * Register a route
     */
    register(path, handler, options = {}) {
        this.routes.set(path, {
            handler,
            meta: options.meta || {},
            guards: options.guards || []
        });
        return this;
    }

    /**
     * Register global navigation guard
     */
    beforeEach(guard) {
        this.guards.push(guard);
        return this;
    }

    /**
     * Register 404 handler
     */
    notFound(handler) {
        this.notFoundHandler = handler;
        return this;
    }

    /**
     * Navigate to path
     */
    push(path) {
        window.location.hash = path;
    }

    /**
     * Replace current route
     */
    replace(path) {
        history.replaceState(null, '', `#${path}`);
        this.handleRoute();
    }

    /**
     * Go back
     */
    back() {
        history.back();
    }

    /**
     * Get current route path
     */
    get path() {
        return window.location.hash.slice(1) || '/';
    }

    /**
     * Get route parameters
     */
    get params() {
        return this.currentRoute?.params || {};
    }

    /**
     * Get query parameters
     */
    get query() {
        const params = new URLSearchParams(window.location.search);
        const query = {};
        for (const [key, value] of params) {
            query[key] = value;
        }
        return query;
    }

    /**
     * Handle route change
     */
    async handleRoute() {
        const path = this.path;
        const route = this.matchRoute(path);

        if (!route) {
            this.notFoundHandler();
            this.eventBus.publish('ROUTE_NOT_FOUND', { path });
            return;
        }

        // Run global guards
        for (const guard of this.guards) {
            const result = await guard(route, this.currentRoute);
            if (result === false) {
                return; // Navigation cancelled
            }
        }

        // Run route-specific guards
        for (const guard of route.guards) {
            const result = await guard(route, this.currentRoute);
            if (result === false) {
                return; // Navigation cancelled
            }
        }

        // Update current route
        const from = this.currentRoute;
        this.currentRoute = route;

        // Publish route change event
        this.eventBus.publish('ROUTE_CHANGED', {
            to: route,
            from,
            path
        });

        // Execute route handler
        try {
            await route.handler(route);
        } catch (error) {
            console.error('Route handler error:', error);
            this.eventBus.publish('ROUTE_ERROR', { error, route });
        }
    }

    /**
     * Match path to route (supports params like /user/:id)
     */
    matchRoute(path) {
        // Exact match first
        if (this.routes.has(path)) {
            const route = this.routes.get(path);
            return { ...route, path, params: {} };
        }

        // Dynamic route matching
        for (const [pattern, route] of this.routes) {
            const params = this.matchPattern(pattern, path);
            if (params) {
                return { ...route, path: pattern, params };
            }
        }

        return null;
    }

    /**
     * Match pattern like /user/:id with /user/123
     */
    matchPattern(pattern, path) {
        const patternParts = pattern.split('/').filter(Boolean);
        const pathParts = path.split('/').filter(Boolean);

        if (patternParts.length !== pathParts.length) {
            return null;
        }

        const params = {};

        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathPart = pathParts[i];

            if (patternPart.startsWith(':')) {
                // Dynamic segment
                const paramName = patternPart.slice(1);
                params[paramName] = decodeURIComponent(pathPart);
            } else if (patternPart !== pathPart) {
                // Mismatch
                return null;
            }
        }

        return params;
    }

    /**
     * Default not found handler
     */
    renderNotFound() {
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `
                <div class="not-found">
                    <h1>404</h1>
                    <p>Page not found</p>
                    <a href="#/">Go Home</a>
                </div>
            `;
        }
    }

    destroy() {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.lifecycle.destroy();
    }
}

/**
 * Create router instance
 */
export function createRouter(eventBus) {
    return new Router(eventBus);
}
