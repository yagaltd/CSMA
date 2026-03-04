import { object, string, number, optional, size, enums, array } from '../../../runtime/validation/index.js';

export const MediaCaptureContracts = {
    INTENT_MEDIA_CAPTURE_START: {
        version: 1,
        type: 'intent',
        owner: 'media-capture',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to start audio recording',

        schema: object({
            title: optional(size(string(), 0, 240)),
            description: optional(size(string(), 0, 400)),
            tags: optional(array(string())),
            category: optional(string()),
            timestamp: number()
        })
    },

    INTENT_MEDIA_CAPTURE_STOP: {
        version: 1,
        type: 'intent',
        owner: 'media-capture',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to stop recording',

        schema: object({
            timestamp: number(),
            metadata: optional(object({}))
        })
    },

    INTENT_MEDIA_CAPTURE_CANCEL: {
        version: 1,
        type: 'intent',
        owner: 'media-capture',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to cancel current recording',

        schema: object({
            timestamp: number()
        })
    },

    MEDIA_CAPTURE_STARTED: {
        version: 1,
        type: 'event',
        owner: 'media-capture',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Recording session started',

        schema: object({
            id: string(),
            metadata: object(),
            mimeType: string(),
            startedAt: number()
        })
    },

    MEDIA_CAPTURE_STOPPED: {
        version: 1,
        type: 'event',
        owner: 'media-capture',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Recording session finished with data available',

        schema: object({
            id: string(),
            duration: number(),
            size: number(),
            mimeType: string(),
            metadata: object(),
            file: optional(object({
                id: optional(string()),
                title: optional(string()),
                size: optional(number())
            }))
        })
    },

    MEDIA_CAPTURE_ERROR: {
        version: 1,
        type: 'event',
        owner: 'media-capture',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when media capture fails',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['start', 'stop', 'recording', 'cancel'])
        })
    }
};
