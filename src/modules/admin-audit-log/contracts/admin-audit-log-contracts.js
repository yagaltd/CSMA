import { object, string, number, array, any, optional, size } from '../../../runtime/validation/index.js';

export const AdminAuditLogContracts = {
    INTENT_ADMIN_AUDIT_LOG_LOAD: {
        version: 1, type: 'intent', owner: 'admin-audit-log', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent admin audit log load',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_ADMIN_AUDIT_LOG_FILTER: {
        version: 1, type: 'intent', owner: 'admin-audit-log', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent admin audit log filter',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_ADMIN_AUDIT_LOG_EXPORT: {
        version: 1, type: 'intent', owner: 'admin-audit-log', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent admin audit log export',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    ADMIN_AUDIT_LOG_UPDATED: {
        version: 1, type: 'event', owner: 'admin-audit-log', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'admin audit log updated',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    ADMIN_AUDIT_LOG_EXPORTED: {
        version: 1, type: 'event', owner: 'admin-audit-log', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'admin audit log exported',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    ADMIN_AUDIT_LOG_ERROR: {
        version: 1, type: 'event', owner: 'admin-audit-log', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'admin audit log error',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    }
};
