/**
 * CSMA overlay contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums, optional } from '../validation/index.js';

export const OverlayContracts = {
    // UI: Modal Open Intent
    INTENT_MODAL_OPEN: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Intent to open a modal',

        schema: object({
            modalId: string(),
            timestamp: number()
        })
    },

    // UI: Modal Close Intent
    INTENT_MODAL_CLOSE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Intent to close a modal',

        schema: object({
            modalId: string(),
            reason: string(),
            timestamp: number()
        })
    },

    INTENT_DRAWER_OPEN: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Intent to open a drawer',

        schema: object({
            drawerId: string(),
            timestamp: number()
        })
    },

    INTENT_DRAWER_CLOSE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Intent to close a drawer',

        schema: object({
            drawerId: string(),
            reason: string(),
            timestamp: number()
        })
    },

    INTENT_ALERT_DIALOG_OPEN: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Intent to open an alert dialog',

        schema: object({
            id: string(),
            timestamp: number()
        })
    },

    INTENT_ALERT_DIALOG_CLOSE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Intent to close an alert dialog',

        schema: object({
            id: string(),
            timestamp: number()
        })
    },

    // UI: Dropdown Menu Toggle
    INTENT_DROPDOWN_TOGGLE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User toggled dropdown menu',

        schema: object({
            dropdownId: string(),
            isOpen: enums([true, false]),
            timestamp: number()
        })
    },

    // UI: Dropdown Opened Event
    DROPDOWN_OPENED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Dropdown menu was opened',

        schema: object({
            dropdownId: string(),
            timestamp: number()
        })
    },

    // UI: Dropdown Closed Event
    DROPDOWN_CLOSED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Dropdown menu was closed',

        schema: object({
            dropdownId: string(),
            timestamp: number()
        })
    },

    // UI: Dropdown Initialized
    DROPDOWN_INITIALIZED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Dropdown component was initialized',

        schema: object({
            dropdownId: string(),
            itemCount: number(),
            timestamp: number()
        })
    },

    // UI: Dropdown Toggled Event
    DROPDOWN_TOGGLED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Dropdown was toggled',

        schema: object({
            dropdownId: string(),
            action: enums(['open', 'close']),
            timestamp: number()
        })
    },

    // UI: Dropdown Item Selected
    INTENT_DROPDOWN_ITEM_SELECT: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User selected dropdown menu item (legacy name)',

        schema: object({
            dropdownId: string(),
            value: string(),
            role: enums(['menuitem', 'menuitemcheckbox', 'menuitemradio']),
            itemId: optional(string()),
            timestamp: number()
        })
    },

    // UI: Dropdown Item Selected
    INTENT_DROPDOWN_ITEM_SELECTED: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User selected dropdown menu item',

        schema: object({
            dropdownId: string(),
            itemId: string(),
            itemValue: string(),
            itemLabel: string(),
            timestamp: number()
        })
    },

};
