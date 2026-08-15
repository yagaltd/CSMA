/**
 * CSMA popover contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, boolean, enums, optional } from '../validation/index.js';

export const PopoverContracts = {
    // Popover Component Contracts
    // ========================================

    // UI: Intent to Toggle Popover
    INTENT_POPOVER_TOGGLE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        schema: object({
            popoverId: string(),
            action: enums(['toggle', 'open', 'close']),
            source: optional(string()),
            timestamp: number()
        })
    },

    // UI: Popover Toggled Event
    POPOVER_TOGGLED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        schema: object({
            popoverId: string(),
            isOpen: boolean(),
            timestamp: number()
        })
    },

};
