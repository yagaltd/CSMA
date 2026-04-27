/**
 * Media Contracts — unified contracts for all capture + transform intents.
 *
 * owner: media-module
 * All old contract names (camera, media-capture, media-transform, image-optimizer)
 * are aliased during the deprecation window.
 */

import { object, string, number, boolean, optional, size, enums, array } from '../../../runtime/validation/index.js';

export const MediaContracts = {
    // ─── Capture Intents ────────────────────────────────────

    INTENT_MEDIA_CAPTURE_PHOTO: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to capture a photo',

        schema: object({
            title: optional(size(string(), 0, 240)),
            description: optional(size(string(), 0, 400)),
            tags: optional(array(string())),
            category: optional(string()),
            timestamp: number()
        })
    },

    INTENT_MEDIA_CAPTURE_VIDEO_START: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Start video recording session',

        schema: object({
            title: optional(size(string(), 0, 240)),
            description: optional(size(string(), 0, 400)),
            tags: optional(array(string())),
            category: optional(string()),
            timestamp: number()
        })
    },

    INTENT_MEDIA_CAPTURE_VIDEO_STOP: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Stop video recording session',

        schema: object({
            timestamp: number()
        })
    },

    INTENT_MEDIA_CAPTURE_AUDIO_START: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Start audio recording session',

        schema: object({
            title: optional(size(string(), 0, 240)),
            description: optional(size(string(), 0, 400)),
            tags: optional(array(string())),
            category: optional(string()),
            timestamp: number()
        })
    },

    INTENT_MEDIA_CAPTURE_AUDIO_STOP: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Stop audio recording session',

        schema: object({
            timestamp: number()
        })
    },

    INTENT_MEDIA_CAPTURE_SCREEN_START: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Start screen capture recording session',

        schema: object({
            title: optional(size(string(), 0, 240)),
            description: optional(size(string(), 0, 400)),
            tags: optional(array(string())),
            audio: optional(boolean()),
            timestamp: number()
        })
    },

    INTENT_MEDIA_CAPTURE_SCREEN_STOP: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Stop screen capture recording session',

        schema: object({
            timestamp: number()
        })
    },

    INTENT_MEDIA_CAPTURE_CANCEL: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Cancel any active recording',

        schema: object({
            timestamp: number()
        })
    },

    // ─── Capture Events ─────────────────────────────────────

    MEDIA_CAPTURE_STARTED: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Recording session started',

        schema: object({
            id: string(),
            type: enums(['photo', 'video', 'audio', 'screen']),
            metadata: object({}),
            mimeType: string(),
            startedAt: number()
        })
    },

    MEDIA_CAPTURE_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Capture or recording finished with data available',

        schema: object({
            id: string(),
            type: enums(['photo', 'video', 'audio', 'screen']),
            size: number(),
            duration: optional(number()),
            mimeType: string(),
            metadata: object({}),
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
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when media capture fails',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['photo', 'video-start', 'video-stop', 'audio-start', 'audio-stop', 'screen-start', 'screen-stop', 'cancel', 'transform', 'optimize', 'resize'])
        })
    },

    // ─── Transform Intents ──────────────────────────────────

    INTENT_MEDIA_TRANSFORM: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to encode a media blob to a specific format',

        schema: object({
            blob: object({}),
            format: string(),
            quality: optional(number()),
            resize: optional(object({
                width: optional(number()),
                height: optional(number()),
                maxWidth: optional(number()),
                maxHeight: optional(number()),
                maintainAspect: optional(boolean())
            })),
            timestamp: number()
        })
    },

    INTENT_MEDIA_OPTIMIZE: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request multi-variant image optimization',

        schema: object({
            blob: object({}),
            targets: array(string()),
            quality: optional(number()),
            resize: optional(object({
                width: optional(number()),
                height: optional(number()),
                maxWidth: optional(number()),
                maxHeight: optional(number()),
                maintainAspect: optional(boolean())
            })),
            metadata: optional(object({})),
            timestamp: number()
        })
    },

    INTENT_MEDIA_RESIZE: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to resize a media blob',

        schema: object({
            blob: object({}),
            width: optional(number()),
            height: optional(number()),
            maxWidth: optional(number()),
            maxHeight: optional(number()),
            maintainAspect: optional(boolean()),
            timestamp: number()
        })
    },

    // ─── Transform Events ───────────────────────────────────

    MEDIA_TRANSFORM_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when single format transform completes',

        schema: object({
            mimeType: string(),
            size: number(),
            width: number(),
            height: number(),
            originalWidth: number(),
            originalHeight: number()
        })
    },

    MEDIA_OPTIMIZE_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when multi-variant optimization completes',

        schema: object({
            originalSize: number(),
            variants: array(object({
                mimeType: string(),
                size: number(),
                width: number(),
                height: number()
            }))
        })
    },

    MEDIA_RESIZE_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when resize completes',

        schema: object({
            originalWidth: number(),
            originalHeight: number(),
            width: number(),
            height: number(),
            mimeType: string(),
            size: number()
        })
    },

    MEDIA_TRANSFORM_ERROR: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when a transform operation fails',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['transform', 'optimize', 'resize'])
        })
    },

    // ─── Deprecated Aliases ─────────────────────────────────

    INTENT_CAMERA_CAPTURE_PHOTO: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'public',
        description: 'Deprecated: use INTENT_MEDIA_CAPTURE_PHOTO',
        schema: object({ timestamp: number() })
    },

    INTENT_CAMERA_CAPTURE_VIDEO_START: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'public',
        description: 'Deprecated: use INTENT_MEDIA_CAPTURE_VIDEO_START',
        schema: object({ timestamp: number() })
    },

    INTENT_CAMERA_CAPTURE_VIDEO_STOP: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'public',
        description: 'Deprecated: use INTENT_MEDIA_CAPTURE_VIDEO_STOP',
        schema: object({ timestamp: number() })
    },

    CAMERA_CAPTURE_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'internal',
        description: 'Deprecated: use MEDIA_CAPTURE_COMPLETED',
        schema: object({ id: string(), type: string(), size: number(), mimeType: string() })
    },

    CAMERA_CAPTURE_ERROR: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'internal',
        description: 'Deprecated: use MEDIA_CAPTURE_ERROR',
        schema: object({ error: string(), operation: string() })
    },

    INTENT_MEDIA_CAPTURE_START: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'public',
        description: 'Deprecated: use INTENT_MEDIA_CAPTURE_AUDIO_START',
        schema: object({ timestamp: number() })
    },

    INTENT_MEDIA_CAPTURE_STOP: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'public',
        description: 'Deprecated: use INTENT_MEDIA_CAPTURE_AUDIO_STOP',
        schema: object({ timestamp: number() })
    },

    MEDIA_CAPTURE_STOPPED: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'internal',
        description: 'Deprecated: use MEDIA_CAPTURE_COMPLETED',
        schema: object({ id: string(), duration: number(), size: number(), mimeType: string() })
    },

    INTENT_IMAGE_OPTIMIZE: {
        version: 1,
        type: 'intent',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'public',
        description: 'Deprecated: use INTENT_MEDIA_OPTIMIZE',
        schema: object({ timestamp: number() })
    },

    IMAGE_OPTIMIZE_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'internal',
        description: 'Deprecated: use MEDIA_OPTIMIZE_COMPLETED',
        schema: object({ originalSize: number(), variants: array(object({})) })
    },

    IMAGE_OPTIMIZE_ERROR: {
        version: 1,
        type: 'event',
        owner: 'media-module',
        lifecycle: 'deprecated',
        stability: 'stable',
        compliance: 'internal',
        description: 'Deprecated: use MEDIA_TRANSFORM_ERROR',
        schema: object({ error: string(), operation: string() })
    }
};
