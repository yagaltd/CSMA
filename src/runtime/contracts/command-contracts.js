/**
 * CSMA command contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums, optional, size, array } from '../validation/index.js';

export const CommandContracts = {
    // Command Menu Component Contracts
    // ========================================

    // Command Menu: Open Intent
    INTENT_COMMAND_OPEN: {
        version: 1,
        type: 'intent',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Open command menu (Cmd/Ctrl + K)',

        schema: object({
            trigger: string(), // 'keyboard' | 'click'
            timestamp: number()
        })
    },

    INTENT_COMMAND_CLOSE: {
        version: 1,
        type: 'intent',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Close command menu',

        schema: object({
            trigger: string(),
            timestamp: number()
        })
    },

    // Command Menu: Search Intent
    INTENT_COMMAND_SEARCH: {
        version: 1,
        type: 'intent',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Search command menu',

        schema: object({
            query: size(string(), 0, 100),
            timestamp: number()
        })
    },

    // Command Menu: Execute Command Intent
    INTENT_COMMAND_EXECUTE: {
        version: 1,
        type: 'intent',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Execute a selected command',

        schema: object({
            commandId: string(),
            payload: optional(object()),
            source: optional(enums(['palette', 'ui', 'ai', 'system'])),
            timestamp: number()
        })
    },

    INTENT_VIEW_RENDER: {
        version: 1,
        type: 'intent',
        owner: 'view-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Render or update a registered safe view capability',

        schema: object({
            viewId: string(),
            target: optional(string()),
            props: optional(object()),
            state: optional(object()),
            mode: optional(enums(['replace', 'append', 'prepend', 'update', 'remove'])),
            source: optional(enums(['palette', 'ui', 'ai', 'system'])),
            timestamp: number()
        })
    },

    // Command Menu: Opened Event
    COMMAND_OPENED: {
        version: 1,
        type: 'event',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Command menu was opened',

        schema: object({
            trigger: string(),
            timestamp: number()
        })
    },

    // Command Menu: Closed Event
    COMMAND_CLOSED: {
        version: 1,
        type: 'event',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Command menu was closed',

        schema: object({
            trigger: string(), // 'escape' | 'blur' | 'execute'
            timestamp: number()
        })
    },

    // Command Menu: Results Updated Event
    COMMAND_RESULTS_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Command search results updated',

        schema: object({
            query: string(),
            results: array(object({
                id: string(),
                title: string(),
                group: optional(string()),
                shortcut: optional(string()),
                score: optional(number())
            })),
            timestamp: number()
        })
    },

    // Command Menu: Command Executed Event
    COMMAND_EXECUTED: {
        version: 1,
        type: 'event',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Command was executed',

        schema: object({
            commandId: string(),
            command: string(),
            payload: optional(object()),
            source: optional(enums(['palette', 'ui', 'ai', 'system'])),
            timestamp: number()
        })
    },

    VIEW_RENDERED: {
        version: 1,
        type: 'event',
        owner: 'view-registry',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Registered safe view capability rendered successfully',

        schema: object({
            viewId: string(),
            target: string(),
            mode: enums(['replace', 'append', 'prepend', 'update', 'remove']),
            source: optional(enums(['palette', 'ui', 'ai', 'system'])),
            timestamp: number()
        })
    },

    VIEW_RENDER_FAILED: {
        version: 1,
        type: 'event',
        owner: 'view-registry',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Registered safe view capability failed validation or execution',

        schema: object({
            viewId: string(),
            target: optional(string()),
            error: string(),
            source: optional(enums(['palette', 'ui', 'ai', 'system'])),
            timestamp: number()
        })
    },
};
