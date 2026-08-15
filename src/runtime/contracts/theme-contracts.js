/**
 * CSMA theme contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, number, enums, optional } from '../validation/index.js';

export const ThemeContracts = {
    // Example: Theme changed
    THEME_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when user changes theme',

        schema: object({
            theme: enums(['light', 'dark']),
            timestamp: optional(number())
        })
    },
};
