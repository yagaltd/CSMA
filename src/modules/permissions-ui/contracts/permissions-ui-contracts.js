import { object, string, number, array, any, optional, size } from '../../../runtime/validation/index.js';

export const PermissionsUIContracts = {
    INTENT_PERMISSIONS_UI_SET: {
        version: 1, type: 'intent', owner: 'permissions-ui', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent permissions ui set',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_PERMISSIONS_UI_CHECK: {
        version: 1, type: 'intent', owner: 'permissions-ui', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent permissions ui check',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_PERMISSIONS_UI_CLEAR: {
        version: 1, type: 'intent', owner: 'permissions-ui', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent permissions ui clear',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    PERMISSIONS_UI_UPDATED: {
        version: 1, type: 'event', owner: 'permissions-ui', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'permissions ui updated',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    PERMISSIONS_UI_DENIED: {
        version: 1, type: 'event', owner: 'permissions-ui', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'permissions ui denied',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    PERMISSIONS_UI_ERROR: {
        version: 1, type: 'event', owner: 'permissions-ui', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'permissions ui error',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    }
};
