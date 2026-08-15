/**
 * CSMA hmac contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, optional, size } from '../validation/index.js';

export const HmacContracts = {
    HMAC_NONCE_REQUESTED: {
        version: 1,
        type: 'event',
        owner: 'hmac-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Client requested a new integrity nonce',

        schema: object({
            intentId: string(),
            nonce: string(),
            expiresAt: number(),
            timestamp: number()
        })
    },

    INTENT_PUBLIC_FORM_SUBMIT: {
        version: 1,
        type: 'intent',
        owner: 'form-management',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Public form submission intent requiring integrity guarantees',

        schema: object({
            formId: string(),
            intent: string(),
            timestamp: number()
        })
    },

    PUBLIC_FORM_SIGNED: {
        version: 1,
        type: 'event',
        owner: 'hmac-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Integrity signature generated for a public form submission',

        schema: object({
            intent: string(),
            nonce: string(),
            payloadHash: string(),
            timestamp: number(),
            expiresAt: number(),
            sessionId: optional(string())
        })
    },

    PUBLIC_FORM_REJECTED: {
        version: 1,
        type: 'event',
        owner: 'hmac-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Integrity signing failed and submission was rejected client-side',

        schema: object({
            formId: optional(string()),
            intent: string(),
            reason: size(string(), 1, 400),
            timestamp: number()
        })
    },

    HMAC_VERIFICATION_FAILED: {
        version: 1,
        type: 'event',
        owner: 'hmac-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Integrity verification failed for a signed payload',

        schema: object({
            intentId: string(),
            reason: size(string(), 1, 400),
            timestamp: number()
        })
    },
};
