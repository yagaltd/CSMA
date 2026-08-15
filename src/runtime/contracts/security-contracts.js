/**
 * CSMA security contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { contract } from './helpers.js';

export const SecurityContracts = {
    // Security violation event (no validation to avoid infinite loop)
    SECURITY_VIOLATION: contract({
        version: 1,
        type: 'event',
        owner: 'event-bus',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Security violation detected',

        // NO SCHEMA - validated in EventBus directly to avoid infinite loop
    }),

    CONTRACT_VIOLATION: contract({
        version: 1,
        type: 'event',
        owner: 'event-bus',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Contract violation detected during event validation'

        // NO SCHEMA - validated in EventBus directly to avoid infinite loop
    }),

};
