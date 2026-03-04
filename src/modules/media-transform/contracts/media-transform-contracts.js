import { object, string, number, optional, size, enums } from '../../../runtime/validation/index.js';

export const MediaTransformContracts = {
    INTENT_MEDIA_TRANSFORM: {
        version: 1,
        type: 'intent',
        owner: 'media-transform',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to transform a media blob',

        schema: object({
            format: string(),
            quality: optional(number()),
            timestamp: number()
        })
    },

    MEDIA_TRANSFORM_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'media-transform',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when transformation completes',

        schema: object({
            size: number(),
            format: string(),
            quality: optional(number()),
            mimeType: string(),
            duration: optional(number())
        })
    },

    MEDIA_TRANSFORM_ERROR: {
        version: 1,
        type: 'event',
        owner: 'media-transform',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when transformation fails',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['transform'])
        })
    }
};
