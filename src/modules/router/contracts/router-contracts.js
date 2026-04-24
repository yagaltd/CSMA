import { object, string, number, boolean, optional } from '../../../runtime/validation/index.js';

export const RouterContracts = {
    INTENT_ROUTE_NAVIGATE: {
        version: 1,
        type: 'intent',
        owner: 'router-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request navigation to a route managed by the router module',

        schema: object({
            path: string(),
            replace: optional(boolean()),
            source: optional(string()),
            timestamp: number()
        })
    },

    ROUTE_NAVIGATION_STARTED: {
        version: 1,
        type: 'event',
        owner: 'router-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Router module started resolving a route',

        schema: object({
            path: string(),
            source: optional(string()),
            timestamp: number()
        })
    },

    ROUTE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'router-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Router module resolved and rendered a route',

        schema: object({
            path: string(),
            routeId: string(),
            pattern: string(),
            title: optional(string()),
            params: optional(object()),
            source: optional(string()),
            timestamp: number()
        })
    },

    ROUTE_BLOCKED: {
        version: 1,
        type: 'event',
        owner: 'router-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A router hook blocked navigation',

        schema: object({
            path: string(),
            reason: string(),
            source: optional(string()),
            timestamp: number()
        })
    },

    ROUTE_NOT_FOUND: {
        version: 1,
        type: 'event',
        owner: 'router-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Router module could not resolve the requested path',

        schema: object({
            path: string(),
            routeId: string(),
            pattern: optional(string()),
            title: optional(string()),
            params: optional(object()),
            source: optional(string()),
            timestamp: number()
        })
    },

    ROUTE_NAVIGATION_FAILED: {
        version: 1,
        type: 'event',
        owner: 'router-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Router module failed to render or resolve a route',

        schema: object({
            path: string(),
            error: string(),
            source: optional(string()),
            timestamp: number()
        })
    }
};
