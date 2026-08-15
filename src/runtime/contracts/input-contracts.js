/**
 * CSMA input contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums, size } from '../validation/index.js';

export const InputContracts = {
    // UI: Button Clicked
    INTENT_BUTTON_CLICKED: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User clicked a button with an action',

        schema: object({
            action: string(),
            buttonId: string(),
            timestamp: number()
        })
    },

    // UI: Input Changed (Valid)
    INTENT_INPUT_CHANGED: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User input changed and passed validation',

        schema: object({
            inputId: string(),
            value: string(),
            isValid: enums([true]), // Must be true for this intent
            timestamp: number()
        })
    },

    // UI: Input Validation Failed
    INPUT_VALIDATION_FAILED: {
        version: 2,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User input failed validation - enhanced with size limits for security',

        schema: object({
            inputId: string(),
            error: size(string(), 1, 200), // Max 200 chars for error messages
            value: size(string(), 0, 16000), // Max 16KB for input values (LLM context limit)
            timestamp: number()
        })
    },
};
