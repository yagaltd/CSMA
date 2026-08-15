/**
 * CSMA api contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, optional } from '../validation/index.js';

export const ApiWrapperContracts = {
    // APIWrapper Observability Events
    API_REQUEST_START: {
        version: 1,
        type: 'event',
        owner: 'api-wrapper',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'An API request began executing',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            requestId: number(),
            method: string(),
            endpoint: string(),
            attempt: number(),
            timestamp: number()
        })
    },

    API_REQUEST_SUCCESS: {
        version: 1,
        type: 'event',
        owner: 'api-wrapper',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'An API request completed successfully',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            requestId: number(),
            method: string(),
            endpoint: string(),
            status: number(),
            duration: number(),
            timestamp: number()
        })
    },

    API_REQUEST_ERROR: {
        version: 1,
        type: 'event',
        owner: 'api-wrapper',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'An API request failed (HTTP error, abort, or network failure)',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            requestId: number(),
            method: string(),
            endpoint: string(),
            status: optional(number()),
            error: string(),
            duration: number(),
            timestamp: number()
        })
    },

    API_REQUEST_RETRY: {
        version: 1,
        type: 'event',
        owner: 'api-wrapper',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'An API request is being retried after a failure',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            method: string(),
            endpoint: string(),
            attempt: number(),
            maxRetries: number(),
            delay: number(),
            timestamp: number()
        })
    },
};
