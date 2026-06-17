import { object, string, number, boolean, array, any, optional, size } from '../../../runtime/validation/index.js';

export const CartContracts = {
    INTENT_CART_ADD_ITEM: {
        version: 1,
        type: 'intent',
        owner: 'cart',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent cart add item',
        schema: object({
            requestId: optional(size(string(), 1, 120)),
            key: optional(size(string(), 1, 160)),
            id: optional(size(string(), 1, 160)),
            enabled: optional(boolean()),
            items: optional(array(any())),
            item: optional(any()),
            data: optional(any()),
            error: optional(size(string(), 1, 500)),
            timestamp: number()
        })
    },
    INTENT_CART_UPDATE_ITEM: {
        version: 1,
        type: 'intent',
        owner: 'cart',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent cart update item',
        schema: object({
            requestId: optional(size(string(), 1, 120)),
            key: optional(size(string(), 1, 160)),
            id: optional(size(string(), 1, 160)),
            enabled: optional(boolean()),
            items: optional(array(any())),
            item: optional(any()),
            data: optional(any()),
            error: optional(size(string(), 1, 500)),
            timestamp: number()
        })
    },
    INTENT_CART_CLEAR: {
        version: 1,
        type: 'intent',
        owner: 'cart',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent cart clear',
        schema: object({
            requestId: optional(size(string(), 1, 120)),
            key: optional(size(string(), 1, 160)),
            id: optional(size(string(), 1, 160)),
            enabled: optional(boolean()),
            items: optional(array(any())),
            item: optional(any()),
            data: optional(any()),
            error: optional(size(string(), 1, 500)),
            timestamp: number()
        })
    },
    CART_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'cart',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'cart updated',
        schema: object({
            requestId: optional(size(string(), 1, 120)),
            key: optional(size(string(), 1, 160)),
            id: optional(size(string(), 1, 160)),
            enabled: optional(boolean()),
            items: optional(array(any())),
            item: optional(any()),
            data: optional(any()),
            error: optional(size(string(), 1, 500)),
            timestamp: number()
        })
    },
    CART_ITEM_REMOVED: {
        version: 1,
        type: 'event',
        owner: 'cart',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'cart item removed',
        schema: object({
            requestId: optional(size(string(), 1, 120)),
            key: optional(size(string(), 1, 160)),
            id: optional(size(string(), 1, 160)),
            enabled: optional(boolean()),
            items: optional(array(any())),
            item: optional(any()),
            data: optional(any()),
            error: optional(size(string(), 1, 500)),
            timestamp: number()
        })
    },
    CART_ERROR: {
        version: 1,
        type: 'event',
        owner: 'cart',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'cart error',
        schema: object({
            requestId: optional(size(string(), 1, 120)),
            key: optional(size(string(), 1, 160)),
            id: optional(size(string(), 1, 160)),
            enabled: optional(boolean()),
            items: optional(array(any())),
            item: optional(any()),
            data: optional(any()),
            error: optional(size(string(), 1, 500)),
            timestamp: number()
        })
    }
};
