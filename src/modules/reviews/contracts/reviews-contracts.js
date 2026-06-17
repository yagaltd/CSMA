import { object, string, number, boolean, array, any, optional, size } from '../../../runtime/validation/index.js';

export const ReviewsContracts = {
    INTENT_REVIEWS_LOAD: {
        version: 1,
        type: 'intent',
        owner: 'reviews',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent reviews load',
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
    INTENT_REVIEW_SUBMIT: {
        version: 1,
        type: 'intent',
        owner: 'reviews',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent review submit',
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
    INTENT_REVIEW_RESET: {
        version: 1,
        type: 'intent',
        owner: 'reviews',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'intent review reset',
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
    REVIEWS_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'reviews',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'reviews updated',
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
    REVIEW_SUBMITTED: {
        version: 1,
        type: 'event',
        owner: 'reviews',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'review submitted',
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
    REVIEWS_ERROR: {
        version: 1,
        type: 'event',
        owner: 'reviews',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        unsafeInternal: true,
        security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
        description: 'reviews error',
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
