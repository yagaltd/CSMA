/**
 * CSMA aggregation contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, optional, any, record } from '../validation/index.js';

export const DataAggregationContracts = {
    // DataAggregator Observability Events
    DATA_AGGREGATION_STARTED: {
        version: 1,
        type: 'event',
        owner: 'data-aggregator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A data composition began (compose or waterfall mode)',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            name: string(),
            sourceCount: number(),
            mode: optional(string()),
            timestamp: number()
        })
    },

    DATA_AGGREGATION_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'data-aggregator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A data composition completed (compose, waterfall, or race mode)',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            name: string(),
            results: any(),
            errors: record(string(), any()),
            duration: optional(number()),
            successCount: optional(number()),
            errorCount: optional(number()),
            mode: optional(string()),
            winner: optional(string()),
            timestamp: number()
        })
    },

    DATA_AGGREGATION_FAILED: {
        version: 1,
        type: 'event',
        owner: 'data-aggregator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A data composition failed (waterfall or race mode)',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            name: string(),
            error: string(),
            duration: optional(number()),
            mode: optional(string()),
            timestamp: number()
        })
    },
};
