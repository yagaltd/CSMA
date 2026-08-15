/**
 * CSMA tooltip contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number } from '../validation/index.js';

export const TooltipContracts = {
    // Tooltip Component Contracts
    // ========================================

    // UI: Tooltip Initialized Event
    TOOLTIP_INITIALIZED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Tooltip component was initialized',

        schema: object({
            triggerId: string(),
            timestamp: number()
        })
    },

};
