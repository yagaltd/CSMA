import { object, string, number, optional, size, enums, array } from '../../../runtime/validation/index.js';

export const CameraContracts = {
    INTENT_CAMERA_CAPTURE_PHOTO: {
        version: 1,
        type: 'intent',
        owner: 'camera-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to capture a single photo',

        schema: object({
            title: optional(size(string(), 0, 240)),
            description: optional(size(string(), 0, 400)),
            tags: optional(array(string())),
            category: optional(string()),
            timestamp: number()
        })
    },

    INTENT_CAMERA_CAPTURE_VIDEO_START: {
        version: 1,
        type: 'intent',
        owner: 'camera-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Start video capture session',

        schema: object({
            title: optional(size(string(), 0, 240)),
            description: optional(size(string(), 0, 400)),
            tags: optional(array(string())),
            category: optional(string()),
            timestamp: number()
        })
    },

    INTENT_CAMERA_CAPTURE_VIDEO_STOP: {
        version: 1,
        type: 'intent',
        owner: 'camera-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Stop video capture session',

        schema: object({
            timestamp: number()
        })
    },

    CAMERA_CAPTURE_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'camera-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when camera capture finishes',

        schema: object({
            id: string(),
            type: enums(['photo', 'video']),
            size: number(),
            duration: optional(number()),
            mimeType: string(),
            metadata: object(),
            file: optional(object({
                id: optional(string()),
                title: optional(string()),
                size: optional(number())
            }))
        })
    },

    CAMERA_CAPTURE_ERROR: {
        version: 1,
        type: 'event',
        owner: 'camera-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when camera operations fail',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['photo', 'video-start', 'video-stop'])
        })
    }
};
