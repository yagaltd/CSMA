/**
 * CSMA auth contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums, optional, size } from '../validation/index.js';

export const AuthContracts = {
    INTENT_AUTH_LOGIN: {
        version: 1,
        type: 'intent',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'User initiated an authentication flow',

        schema: object({
            method: enums(['password', 'register', 'api-key']),
            identifier: optional(size(string(), 2, 320)),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_LOGIN_SUCCEEDED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Authentication completed with a valid session',

        schema: object({
            method: enums(['password', 'register', 'api-key']),
            userId: optional(string()),
            sessionId: string(),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_LOGIN_FAILED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Authentication attempt failed',

        schema: object({
            method: enums(['password', 'register', 'api-key']),
            error: size(string(), 1, 400),
            code: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    API_KEY_LOGIN_SUCCEEDED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'API key authentication completed successfully',

        schema: object({
            method: enums(['api-key']),
            userId: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    USER_LOGGED_IN: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'User session established on the client',

        schema: object({
            user: optional(object()),
            sessionId: string(),
            timestamp: number()
        })
    },

    USER_LOGGED_OUT: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'User session terminated',

        schema: object({
            reason: string(),
            timestamp: number()
        })
    },

    USER_REGISTERED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'User completed registration',

        schema: object({
            user: optional(object()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_ERROR: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Authentication subsystem reported an error',

        schema: object({
            method: optional(string()),
            error: size(string(), 1, 400),
            code: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    TOKEN_REFRESHED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Access token rotated client-side',

        schema: object({
            requestId: optional(string()),
            timestamp: number()
        })
    },

    SESSION_EXPIRED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Session expired or was invalidated',

        schema: object({
            requestId: optional(string()),
            reason: optional(string()),
            timestamp: number()
        })
    },
};
