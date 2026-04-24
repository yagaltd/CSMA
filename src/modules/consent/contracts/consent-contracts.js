import { object, string, number, boolean, optional, enums } from '../../../runtime/validation/index.js';

const ConsentCategoriesSchema = object({
    essential: boolean(),
    preferences: boolean(),
    analytics: boolean(),
    performance: boolean(),
    marketing: boolean()
});

export const ConsentContracts = {
    INTENT_CONSENT_ACCEPT_ALL: {
        version: 1,
        type: 'intent',
        owner: 'consent',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to accept all consent categories',
        schema: object({
            source: optional(string()),
            timestamp: number()
        })
    },

    INTENT_CONSENT_REJECT_OPTIONAL: {
        version: 1,
        type: 'intent',
        owner: 'consent',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to reject all optional consent categories',
        schema: object({
            source: optional(string()),
            timestamp: number()
        })
    },

    INTENT_CONSENT_UPDATE: {
        version: 1,
        type: 'intent',
        owner: 'consent',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to update one consent category',
        schema: object({
            category: enums(['preferences', 'analytics', 'performance', 'marketing']),
            value: boolean(),
            source: optional(string()),
            timestamp: number()
        })
    },

    CONSENT_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'consent',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when consent preferences change',
        schema: object({
            category: optional(string()),
            value: optional(boolean()),
            categories: ConsentCategoriesSchema,
            acknowledged: boolean(),
            source: optional(string()),
            timestamp: number()
        })
    },

    CONSENT_ACKNOWLEDGED: {
        version: 1,
        type: 'event',
        owner: 'consent',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when the user acknowledges consent choices',
        schema: object({
            categories: ConsentCategoriesSchema,
            source: optional(string()),
            timestamp: number()
        })
    },

    CONSENT_RESET: {
        version: 1,
        type: 'event',
        owner: 'consent',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when consent preferences are reset',
        schema: object({
            categories: ConsentCategoriesSchema,
            source: optional(string()),
            timestamp: number()
        })
    },

    ANALYTICS_CONSENT_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'consent',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Legacy analytics consent update event',
        schema: object({
            scope: optional(string()),
            value: optional(boolean()),
            scopes: object({
                ui_analytics: boolean(),
                performance: boolean(),
                error_tracking: boolean(),
                security: boolean()
            }),
            acknowledged: boolean(),
            timestamp: number()
        })
    }
};
