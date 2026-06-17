import { object, string, number, array, any, optional, size } from '../../../runtime/validation/index.js';

export const ContentWorkflowContracts = {
    INTENT_CONTENT_WORKFLOW_SET: {
        version: 1, type: 'intent', owner: 'content-workflow', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent content workflow set',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_CONTENT_WORKFLOW_TRANSITION: {
        version: 1, type: 'intent', owner: 'content-workflow', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent content workflow transition',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_CONTENT_WORKFLOW_CLEAR: {
        version: 1, type: 'intent', owner: 'content-workflow', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent content workflow clear',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    CONTENT_WORKFLOW_UPDATED: {
        version: 1, type: 'event', owner: 'content-workflow', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'content workflow updated',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    CONTENT_WORKFLOW_TRANSITIONED: {
        version: 1, type: 'event', owner: 'content-workflow', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'content workflow transitioned',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    CONTENT_WORKFLOW_ERROR: {
        version: 1, type: 'event', owner: 'content-workflow', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'content workflow error',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    }
};
