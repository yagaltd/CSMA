/**
 * CSMA progress contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums, optional } from '../validation/index.js';

export const ProgressContracts = {
    // Progress Component Contracts
    // ========================================

    // UI: Intent to Update Progress
    INTENT_PROGRESS_UPDATE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Intent to update progress bar value',

        schema: object({
            progressId: string(),
            percentage: number(),
            status: optional(enums(['loading', 'complete', 'error', 'indeterminate'])),
            label: optional(string())
        })
    },

    // UI: Progress Updated Event
    PROGRESS_UPDATE: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Progress bar value was updated',

        schema: object({
            progressId: string(),
            percentage: number(),
            status: enums(['loading', 'complete', 'error', 'indeterminate']),
            label: optional(string()),
            timestamp: number()
        })
    },

    // UI: Progress Completed Event
    PROGRESS_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Progress reached 100% and completed',

        schema: object({
            progressId: string(),
            timestamp: number()
        })
    },

};
