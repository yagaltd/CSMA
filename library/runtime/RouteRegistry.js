import { ContributionRegistry } from './ContributionRegistry.js';

function ensureString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`[RouteRegistry] ${label} must be a non-empty string`);
    }

    return value.trim();
}

export class RouteRegistry extends ContributionRegistry {
    constructor({ eventBus } = {}) {
        super('routes', { eventBus });
        this.router = null;
        this.routeIdsByPath = new Map();
    }

    validate(contribution) {
        if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
            throw new Error('[RouteRegistry] Contribution must be an object');
        }

        const id = ensureString(contribution.id, 'id');
        const path = ensureString(contribution.path, 'path');
        const page = ensureString(contribution.page, 'page');

        if (contribution.guards !== undefined) {
            if (!Array.isArray(contribution.guards) || contribution.guards.some((guard) => typeof guard !== 'string')) {
                throw new Error(`[RouteRegistry] guards must be an array of strings for route "${id}"`);
            }
        }

        return {
            id,
            path,
            page,
            ...(contribution.guards ? { guards: [...contribution.guards] } : {})
        };
    }

    register(moduleId, contribution) {
        const existing = this.routeIdsByPath.get(contribution.path);
        if (existing) {
            throw new Error(`[RouteRegistry] Route path "${contribution.path}" is already registered`);
        }

        const route = super.register(moduleId, contribution);
        this.routeIdsByPath.set(route.path, route.id);
        return route;
    }

    onRegistered(route) {
        this.attachRoute(route);
    }

    onUnregistered(route) {
        this.routeIdsByPath.delete(route.path);
        this.router?.unregister?.(route.path);
    }

    attachRouter(router) {
        this.router = router || null;
        this.list().forEach((route) => this.attachRoute(route));
        return () => {
            if (this.router === router) {
                this.router = null;
            }
        };
    }

    attachRoute(route) {
        if (!this.router?.register) {
            return;
        }

        this.router.unregister?.(route.path);
        this.router.register(
            route.path,
            () => this.eventBus?.publish?.('ROUTE_CONTRIBUTION_REQUESTED', {
                routeId: route.id,
                moduleId: route.moduleId,
                path: route.path,
                page: route.page,
                timestamp: Date.now()
            }),
            {
                meta: {
                    routeId: route.id,
                    moduleId: route.moduleId,
                    page: route.page,
                    source: 'module-registry'
                }
            }
        );
    }

    destroy() {
        if (this.router?.unregister) {
            this.list().forEach((route) => this.router.unregister(route.path));
        }

        this.router = null;
        this.routeIdsByPath.clear();
        super.destroy();
    }
}
