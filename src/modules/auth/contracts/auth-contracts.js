import { object, string, number, boolean, optional, enums } from '../../../runtime/validation/index.js';

const AuthUserSchema = object();

const AuthMethodSchema = enums(['password', 'register', 'api-key', 'oauth', 'jwt']);

export const AuthContracts = {
    INTENT_AUTH_LOGIN: {
        version: 1,
        type: 'intent',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Authenticate an existing user session',
        schema: object({
            method: AuthMethodSchema,
            identifier: optional(string()),
            provider: optional(string()),
            timestamp: number()
        })
    },

    INTENT_AUTH_REGISTER: {
        version: 1,
        type: 'intent',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Create a new authenticated user session',
        schema: object({
            method: enums(['register']),
            identifier: optional(string()),
            provider: optional(string()),
            timestamp: number()
        })
    },

    INTENT_AUTH_LOGOUT: {
        version: 1,
        type: 'intent',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Terminate the current authenticated session',
        schema: object({
            reason: optional(string()),
            timestamp: number()
        })
    },

    INTENT_AUTH_FORGOT_PASSWORD: {
        version: 1,
        type: 'intent',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request a password reset challenge for an account',
        schema: object({
            email: string(),
            timestamp: number()
        })
    },

    INTENT_AUTH_RESET_PASSWORD: {
        version: 1,
        type: 'intent',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Complete password reset using a backend-issued token',
        schema: object({
            token: string(),
            password: string(),
            timestamp: number()
        })
    },

    INTENT_AUTH_VERIFY_EMAIL: {
        version: 1,
        type: 'intent',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Verify an email address using a backend-issued token',
        schema: object({
            token: string(),
            email: optional(string()),
            timestamp: number()
        })
    },

    INTENT_AUTH_RESEND_VERIFICATION: {
        version: 1,
        type: 'intent',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request another email verification challenge',
        schema: object({
            email: string(),
            timestamp: number()
        })
    },

    INTENT_AUTH_REFRESH_SESSION: {
        version: 1,
        type: 'intent',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Refresh the current session from backend state',
        schema: object({
            source: optional(string()),
            timestamp: number()
        })
    },

    INTENT_AUTH_START_OAUTH: {
        version: 1,
        type: 'intent',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Begin a backend-mediated OAuth flow',
        schema: object({
            provider: optional(string()),
            redirectUri: optional(string()),
            timestamp: number()
        })
    },

    INTENT_AUTH_HANDLE_OAUTH_CALLBACK: {
        version: 1,
        type: 'intent',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Finalize a backend-mediated OAuth callback',
        schema: object({
            code: optional(string()),
            state: optional(string()),
            provider: optional(string()),
            timestamp: number()
        })
    },

    AUTH_SESSION_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when the active auth session changes',
        schema: object({
            user: optional(AuthUserSchema),
            sessionId: optional(string()),
            strategy: enums(['cookie', 'jwt', 'oauth', 'hybrid']),
            authenticated: boolean(),
            role: optional(string()),
            provider: optional(string()),
            requestId: optional(string()),
            reason: optional(string()),
            timestamp: number()
        })
    },

    AUTH_LOGIN_SUCCEEDED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Authentication completed successfully',
        schema: object({
            method: AuthMethodSchema,
            userId: optional(string()),
            sessionId: string(),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_LOGIN_FAILED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Authentication attempt failed',
        schema: object({
            method: AuthMethodSchema,
            error: string(),
            code: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    USER_LOGGED_IN: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Client session established',
        schema: object({
            user: optional(AuthUserSchema),
            sessionId: string(),
            timestamp: number()
        })
    },

    USER_LOGGED_OUT: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Client session terminated',
        schema: object({
            reason: string(),
            timestamp: number()
        })
    },

    USER_REGISTERED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'User registration completed',
        schema: object({
            user: optional(AuthUserSchema),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_ERROR: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Authentication subsystem reported an error',
        schema: object({
            method: optional(AuthMethodSchema),
            error: string(),
            code: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    TOKEN_REFRESHED: {
        version: 1,
        type: 'event',
        owner: 'auth',
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
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Active session expired or was invalidated',
        schema: object({
            requestId: optional(string()),
            reason: optional(string()),
            timestamp: number()
        })
    },

    AUTH_OAUTH_STARTED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Backend-mediated OAuth flow has started',
        schema: object({
            provider: optional(string()),
            authorizationUrl: optional(string()),
            state: optional(string()),
            timestamp: number()
        })
    },

    AUTH_OAUTH_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Backend-mediated OAuth flow completed',
        schema: object({
            provider: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_OAUTH_FAILED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Backend-mediated OAuth flow failed',
        schema: object({
            provider: optional(string()),
            error: string(),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_PASSWORD_RESET_REQUESTED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Password reset challenge request was accepted',
        schema: object({
            flow: string(),
            email: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_PASSWORD_RESET_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Password reset was completed',
        schema: object({
            flow: string(),
            email: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_EMAIL_VERIFIED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Email verification was completed',
        schema: object({
            flow: string(),
            email: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_VERIFICATION_RESENT: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Email verification challenge was resent',
        schema: object({
            flow: string(),
            email: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_ACCOUNT_ACTION_FAILED: {
        version: 1,
        type: 'event',
        owner: 'auth',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Account lifecycle action failed',
        schema: object({
            flow: string(),
            intent: string(),
            error: string(),
            code: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    }
};
