/**
 * CSMA channel contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, optional, any, looseObject } from '../validation/index.js';

export const ChannelContracts = {
    // ChannelManager Events
    CHANNEL_SUBSCRIBED: {
        version: 1,
        type: 'event',
        owner: 'channel-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A channel subscription became active',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            id: string(),
            params: any(),
            timestamp: optional(number())
        })
    },

    CHANNEL_UNSUBSCRIBED: {
        version: 1,
        type: 'event',
        owner: 'channel-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A channel subscription was torn down',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            id: string(),
            params: any(),
            source: string(),
            timestamp: optional(number())
        })
    },

    CHANNEL_COMMAND_REQUEST: {
        version: 1,
        type: 'event',
        owner: 'channel-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'A transport command (filter/resend) was requested for a channel subscription',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            id: string(),
            params: any(),
            command: string(),
            args: any(),
            timestamp: optional(number())
        })
    },

    CHANNEL_ACCESS_REVOKED: {
        version: 1,
        type: 'event',
        owner: 'channel-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Access to a channel was revoked for a subscription',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        schema: object({
            id: string(),
            params: any(),
            timestamp: optional(number())
        })
    },

    CHANNEL_SERVER_CLOSE: {
        version: 1,
        type: 'event',
        owner: 'channel-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'The server closed a channel subscription (published by ChannelManager after teardown and by transports with the raw close message)',
        security: { rateLimits: { requests: 600, windowMs: 60000, scope: 'session' } },

        // looseObject: the transport publishes the raw protocol message (e.g. a
        // `type: 'channel.close'` field) while ChannelManager republishes a subset.
        schema: looseObject({
            channel: string(),
            params: optional(any()),
            code: optional(number()),
            reason: optional(string()),
            timestamp: optional(number())
        })
    },
};
