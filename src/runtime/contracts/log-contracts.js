/**
 * CSMA log contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums } from '../validation/index.js';

export const LogContracts = {
    // Log entry (for LogAccumulator)
    LOG_ENTRY: {
        version: 1,
        type: 'event',
        owner: 'log-accumulator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'System log entry',

        schema: object({
            type: enums(['click', 'navigation', 'error', 'security', 'css-change', 'event', 'promise-error', 'contract-violation']),
            data: object(),
            sessionId: string(),
            timestamp: number()
        })
    },

};
