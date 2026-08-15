/**
 * CSMA leader contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums, optional } from '../validation/index.js';

export const LeaderContracts = {
    // CrossTabLeader Event
    LEADER_STATE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'cross-tab-leader',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Cross-tab leadership role changed for this tab',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            tabId: string(),
            role: enums(['leader', 'follower']),
            leaderTabId: optional(string()),
            reason: string(),
            timestamp: number()
        })
    },
};
