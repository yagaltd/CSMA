import { object, number, boolean, string, size, enums, optional } from '../../../runtime/validation/index.js';

export const NetworkStatusContracts = {
    INTENT_NETWORK_STATUS_REFRESH: {
        version: 1,
        type: 'intent',
        owner: 'network-status',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request a manual network status ping',

        schema: object({
            timestamp: number()
        })
    },

    NETWORK_STATUS_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'network-status',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published whenever connectivity state changes',

        schema: object({
            online: boolean(),
            reason: string(),
            latency: optional(number()),
            timestamp: number()
        })
    },

    NETWORK_STATUS_ERROR: {
        version: 1,
        type: 'event',
        owner: 'network-status',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when pings fail',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['ping', 'refresh'])
        })
    }
};
