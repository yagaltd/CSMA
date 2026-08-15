/**
 * CSMA tabs contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, optional } from '../validation/index.js';

export const TabsContracts = {
    // Tabs Component Contracts
    // ========================================

    // UI: Intent to Switch Tab
    INTENT_TAB_SWITCH: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intent to switch to a different tab',

        schema: object({
            containerId: string(),
            tabId: string(),
            timestamp: number()
        })
    },

    // UI: Tab Switched Event
    TAB_SWITCHED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Tab switch was completed and UI updated',

        schema: object({
            containerId: string(),
            tabId: string(),
            previousTab: optional(string()),
            timestamp: number()
        })
    },

};
