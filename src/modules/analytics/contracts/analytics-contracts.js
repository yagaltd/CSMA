import { object, string, number, boolean, optional, size, enums, array } from '../../../runtime/validation/index.js';

const SeoAuditSchema = object({
    titleLength: number(),
    hasDescription: boolean(),
    hasOgImage: boolean(),
    canonicalUrl: optional(string()),
    h1Count: number(),
    structuredDataTypes: array(string())
});

/**
 * Analytics Contracts
 * Event schemas for the analytics module
 */
export const AnalyticsContracts = {
    ANALYTICS_PAGE_VIEW: {
        version: 1,
        type: 'event',
        owner: 'analytics',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a page view is tracked',

        schema: object({
            type: enums(['pageview']),
            title: size(string(), 1, 120),
            url: string(),
            path: string(),
            referrer: optional(string()),
            seo: optional(SeoAuditSchema),
            timestamp: number()
        })
    },

    ANALYTICS_EVENT: {
        version: 1,
        type: 'event',
        owner: 'analytics',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a custom analytics event is tracked',

        schema: object({
            type: enums(['event']),
            name: size(string(), 1, 80),
            properties: optional(object()),
            timestamp: number()
        })
    },

    ANALYTICS_BATCH_FLUSH: {
        version: 1,
        type: 'event',
        owner: 'analytics',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when a batch of analytics events is flushed to the server',

        schema: object({
            batchId: string(),
            entryCount: number(),
            source: string(),
            timestamp: number()
        })
    },

    ANALYTICS_FLUSH_ERROR: {
        version: 1,
        type: 'event',
        owner: 'analytics',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when flushing analytics events fails',

        schema: object({
            error: string(),
            queueSize: number(),
            willRetry: boolean(),
            timestamp: number()
        })
    }
};
