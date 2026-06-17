import { object, string, number, array, any, optional, size } from '../../../runtime/validation/index.js';

export const CommentsContracts = {
    INTENT_COMMENTS_LOAD: {
        version: 1, type: 'intent', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent comments load',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_COMMENT_SUBMIT: {
        version: 1, type: 'intent', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent comment submit',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_COMMENT_MODERATE: {
        version: 1, type: 'intent', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent comment moderate',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    COMMENTS_UPDATED: {
        version: 1, type: 'event', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'comments updated',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    COMMENT_SUBMITTED: {
        version: 1, type: 'event', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'comment submitted',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    COMMENTS_ERROR: {
        version: 1, type: 'event', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'comments error',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    }
};
