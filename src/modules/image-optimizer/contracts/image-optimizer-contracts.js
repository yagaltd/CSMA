import { object, string, number, optional, size, enums, array } from '../../../runtime/validation/index.js';

export const ImageOptimizerContracts = {
    INTENT_IMAGE_OPTIMIZE: {
        version: 1,
        type: 'intent',
        owner: 'image-optimizer',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to optimize an image',

        schema: object({
            targets: optional(array(string())),
            timestamp: number()
        })
    },

    IMAGE_OPTIMIZE_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'image-optimizer',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when image optimization yields variants',

        schema: object({
            originalSize: number(),
            variants: array(object({
                format: string(),
                size: number(),
                mimeType: string(),
                fileId: optional(string())
            }))
        })
    },

    IMAGE_OPTIMIZE_ERROR: {
        version: 1,
        type: 'event',
        owner: 'image-optimizer',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when optimization fails',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['optimize'])
        })
    }
};
