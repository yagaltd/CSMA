import { object, string, enums, number, optional, any } from '../../../runtime/validation/index.js';

export const StaticRenderContracts = {
    ISLAND_HYDRATION_INITIATED: {
        version: 1,
        type: 'event',
        owner: 'static-render',
        lifecycle: 'active',
        stability: 'experimental',
        compliance: 'public',
        description: 'Published whenever an island begins hydrating in the browser',

        schema: object({
            islandId: string(),
            route: string(),
            trigger: enums(['load', 'visible', 'idle', 'manual']),
            parameters: optional(any()),
            timestamp: number()
        })
    },

    ISLAND_DATA_REQUESTED: {
        version: 1,
        type: 'event',
        owner: 'static-render',
        lifecycle: 'active',
        stability: 'experimental',
        compliance: 'public',
        description: 'Published when an island requests data via its declared contract',

        schema: object({
            islandId: string(),
            dataContract: optional(string()),
            parameters: optional(any()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    ISLAND_INVALIDATED: {
        version: 1,
        type: 'event',
        owner: 'static-render',
        lifecycle: 'active',
        stability: 'experimental',
        compliance: 'public',
        description: 'Emitted when SSMA signals that an island should refresh itself',

        schema: object({
            islandId: string(),
            parameters: optional(any()),
            reason: optional(string()),
            site: optional(string()),
            cursor: optional(number()),
            timestamp: number(),
            dataContract: optional(string()),
            payload: optional(any()),
            eventId: optional(string()),
            type: optional(string())
        })
    }
};
