import { object, string, number, optional, enums, boolean, size } from '../../../runtime/validation/index.js';

export const LocationContracts = {
    INTENT_LOCATION_START: {
        version: 1,
        type: 'intent',
        owner: 'location-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Start geolocation tracking',

        schema: object({
            highAccuracy: optional(boolean()),
            timestamp: number()
        })
    },

    INTENT_LOCATION_STOP: {
        version: 1,
        type: 'intent',
        owner: 'location-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Stop geolocation tracking',

        schema: object({
            timestamp: number()
        })
    },

    INTENT_GEOFENCE_ADD: {
        version: 1,
        type: 'intent',
        owner: 'location-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Add a geofence',

        schema: object({
            id: optional(string()),
            latitude: number(),
            longitude: number(),
            radius: optional(number()),
            timestamp: number()
        })
    },

    INTENT_GEOFENCE_REMOVE: {
        version: 1,
        type: 'intent',
        owner: 'location-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Remove a geofence',

        schema: object({
            id: string(),
            timestamp: number()
        })
    },

    LOCATION_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'location-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when new coordinates are available',

        schema: object({
            latitude: number(),
            longitude: number(),
            accuracy: optional(number()),
            altitude: optional(number()),
            heading: optional(number()),
            speed: optional(number()),
            timestamp: number()
        })
    },

    GEOFENCE_TRIGGERED: {
        version: 1,
        type: 'event',
        owner: 'location-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when location enters a geofence',

        schema: object({
            id: string(),
            latitude: number(),
            longitude: number(),
            radius: number(),
            distance: number(),
            timestamp: number()
        })
    },

    LOCATION_ERROR: {
        version: 1,
        type: 'event',
        owner: 'location-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when location tracking fails',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['start', 'watch'])
        })
    }
};
