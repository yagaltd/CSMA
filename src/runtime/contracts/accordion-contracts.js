/**
 * CSMA accordion contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums } from '../validation/index.js';

export const AccordionContracts = {
    // Accordion Component Contracts
    // ========================================

    // UI: Intent to Toggle Accordion Item
    INTENT_ACCORDION_TOGGLE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intent to toggle an accordion item',

        schema: object({
            containerId: string(),
            itemId: string(),
            timestamp: number()
        })
    },

    // UI: Accordion Item Toggled Event
    ACCORDION_TOGGLED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Accordion item was toggled and UI updated',

        schema: object({
            containerId: string(),
            itemId: string(),
            action: enums(['open', 'close']),
            timestamp: number()
        })
    },

    // UI: Accordion Initialized Event
    ACCORDION_INITIALIZED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Accordion component was initialized',

        schema: object({
            containerId: string(),
            itemCount: number(),
            singleOpen: enums([true, false]),
            timestamp: number()
        })
    },

};
