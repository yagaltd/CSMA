/**
 * CSMA validation contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, array, any, record } from '../validation/index.js';

export const FormValidationContracts = {
    // FormValidator Observability Events
    FORM_VALIDATION_PASSED: {
        version: 1,
        type: 'event',
        owner: 'form-validator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A full form passed validation',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            formId: string(),
            data: any(),
            duration: number(),
            timestamp: number()
        })
    },

    FORM_VALIDATION_FAILED: {
        version: 1,
        type: 'event',
        owner: 'form-validator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A full form failed validation',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            formId: string(),
            errors: record(string(), array(string())),
            duration: number(),
            timestamp: number()
        })
    },

    FIELD_VALIDATION_STARTED: {
        version: 1,
        type: 'event',
        owner: 'form-validator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A single field began validation',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            formId: string(),
            fieldName: string(),
            timestamp: number()
        })
    },

    FIELD_VALIDATION_PASSED: {
        version: 1,
        type: 'event',
        owner: 'form-validator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A single field passed validation',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            formId: string(),
            fieldName: string(),
            value: any(),
            duration: number(),
            timestamp: number()
        })
    },

    FIELD_VALIDATION_FAILED: {
        version: 1,
        type: 'event',
        owner: 'form-validator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A single field failed validation',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            formId: string(),
            fieldName: string(),
            errors: array(string()),
            duration: number(),
            timestamp: number()
        })
    },
};
