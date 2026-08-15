/**
 * CSMA pagination contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, number, enums } from '../validation/index.js';

export const PaginationContracts = {
    // UI: Pagination Navigation Intent
    INTENT_PAGINATION_NAVIGATE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to navigate pagination (prev/next)',

        schema: object({
            direction: enums(['prev', 'next']),
            timestamp: number()
        })
    },

    // UI: Pagination Page Changed Event
    PAGINATION_PAGE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when pagination page changes',

        schema: object({
            page: number(),
            timestamp: number()
        })
    },

    // UI: Pagination Size Changed Event
    PAGINATION_SIZE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when items per page changes',

        schema: object({
            size: number(),
            timestamp: number()
        })
    },
};
