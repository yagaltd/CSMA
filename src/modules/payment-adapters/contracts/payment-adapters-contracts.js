import { object, string, number, boolean, array, any, optional, size } from '../../../runtime/validation/index.js';

export const PaymentAdaptersContracts = {
    INTENT_PAYMENT_ADAPTER_REGISTER: {
        version: 1,
        type: 'intent',
        owner: 'payment-adapters',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent payment adapter register',
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
    INTENT_PAYMENT_FLOW_START: {
        version: 1,
        type: 'intent',
        owner: 'payment-adapters',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent payment flow start',
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
    INTENT_PAYMENT_FLOW_RESET: {
        version: 1,
        type: 'intent',
        owner: 'payment-adapters',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent payment flow reset',
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
    PAYMENT_ADAPTER_READY: {
        version: 1,
        type: 'event',
        owner: 'payment-adapters',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'payment adapter ready',
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
    PAYMENT_FLOW_STARTED: {
        version: 1,
        type: 'event',
        owner: 'payment-adapters',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'payment flow started',
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
    PAYMENT_FLOW_ERROR: {
        version: 1,
        type: 'event',
        owner: 'payment-adapters',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'payment flow error',
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
