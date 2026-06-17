import { object, string, number, boolean, array, any, optional, size } from '../../../runtime/validation/index.js';

export const AbTestingContracts = {
    INTENT_AB_TEST_ASSIGN: {
        version: 1,
        type: 'intent',
        owner: 'ab-testing',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent ab test assign',
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
    INTENT_AB_TEST_EXPOSE: {
        version: 1,
        type: 'intent',
        owner: 'ab-testing',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent ab test expose',
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
    INTENT_AB_TEST_RESET: {
        version: 1,
        type: 'intent',
        owner: 'ab-testing',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent ab test reset',
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
    AB_TEST_ASSIGNED: {
        version: 1,
        type: 'event',
        owner: 'ab-testing',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'ab test assigned',
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
    AB_TEST_EXPOSURE: {
        version: 1,
        type: 'event',
        owner: 'ab-testing',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'ab test exposure',
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
    AB_TEST_ERROR: {
        version: 1,
        type: 'event',
        owner: 'ab-testing',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'ab test error',
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
