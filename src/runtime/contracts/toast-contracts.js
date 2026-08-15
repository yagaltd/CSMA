/**
 * CSMA toast contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, optional } from '../validation/index.js';

export const ToastContracts = {
    // Toast Component Contracts
    // ========================================

    // UI: Intent to Show Toast
    INTENT_TOAST_SHOW: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intent to show a toast notification',

        schema: object({
            type: optional(string()), // 'default' | 'success' | 'error' | 'warning'
            title: optional(string()),
            description: optional(string()),
            duration: optional(number())
        })
    },

    // UI: Toast Shown Event
    TOAST_SHOWN: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Toast notification was shown',

        schema: object({
            toastId: string(),
            type: string(),
            timestamp: number()
        })
    },

    // UI: Toast Dismissed Event
    TOAST_DISMISSED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Toast notification was dismissed',

        schema: object({
            toastId: string(),
            timestamp: number()
        })
    },
};
