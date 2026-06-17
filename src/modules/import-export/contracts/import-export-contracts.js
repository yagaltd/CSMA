import { object, string, number, array, any, optional, size } from '../../../runtime/validation/index.js';

export const ImportExportContracts = {
    INTENT_IMPORT_PREVIEW: {
        version: 1, type: 'intent', owner: 'import-export', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent import preview',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_EXPORT_PREPARE: {
        version: 1, type: 'intent', owner: 'import-export', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent export prepare',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_IMPORT_EXPORT_RESET: {
        version: 1, type: 'intent', owner: 'import-export', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent import export reset',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    IMPORT_PREVIEW_READY: {
        version: 1, type: 'event', owner: 'import-export', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'import preview ready',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    EXPORT_READY: {
        version: 1, type: 'event', owner: 'import-export', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'export ready',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    IMPORT_EXPORT_ERROR: {
        version: 1, type: 'event', owner: 'import-export', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'import export error',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), filters: optional(any()), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    }
};
