import { object, string, number, optional, size } from '../../../runtime/validation/index.js';

export const FileUploadContracts = {
    INTENT_FILE_UPLOAD: {
        version: 1,
        type: 'intent',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request a file upload',

        schema: object({
            file: object(),
            options: optional(object()),
            timestamp: number()
        })
    },

    INTENT_FILE_UPLOAD_PAUSE: {
        version: 1,
        type: 'intent',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Pause an in-flight file upload',

        schema: object({
            fileId: string(),
            timestamp: number(),
            reason: optional(string())
        })
    },

    INTENT_FILE_UPLOAD_RESUME: {
        version: 1,
        type: 'intent',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Resume a paused or queued file upload',

        schema: object({
            fileId: string(),
            timestamp: number(),
            reason: optional(string())
        })
    },

    INTENT_FILE_UPLOAD_CANCEL: {
        version: 1,
        type: 'intent',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Cancel an in-flight file upload',

        schema: object({
            fileId: string(),
            timestamp: number(),
            reason: optional(string())
        })
    },

    INTENT_FILE_UPLOAD_RETRY: {
        version: 1,
        type: 'intent',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Retry a failed file upload',

        schema: object({
            fileId: string(),
            timestamp: number(),
            reason: optional(string())
        })
    },

    FILE_UPLOAD_STARTED: {
        version: 1,
        type: 'event',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File upload has started',

        schema: object({
            fileId: string(),
            fileName: string(),
            fileSize: number(),
            fileType: string(),
            timestamp: number()
        })
    },

    FILE_UPLOAD_PROGRESS: {
        version: 1,
        type: 'event',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File upload progress update',

        schema: object({
            fileId: string(),
            progress: number(),
            loaded: number(),
            total: number(),
            timestamp: number()
        })
    },

    FILE_UPLOAD_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File upload completed successfully',

        schema: object({
            fileId: string(),
            fileName: string(),
            fileSize: number(),
            fileType: string(),
            previewUrl: optional(string()),
            result: object(),
            timestamp: number()
        })
    },

    FILE_UPLOAD_FAILED: {
        version: 1,
        type: 'event',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File upload failed',

        schema: object({
            fileId: string(),
            fileName: string(),
            error: size(string(), 1, 400),
            timestamp: number()
        })
    },

    FILE_UPLOAD_PAUSED: {
        version: 1,
        type: 'event',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'File upload paused and checkpoint persisted',

        schema: object({
            fileId: string(),
            progress: number(),
            loaded: number(),
            total: number(),
            timestamp: number(),
            reason: optional(string())
        })
    },

    FILE_UPLOAD_RESUMED: {
        version: 1,
        type: 'event',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'File upload resumed from a checkpoint',

        schema: object({
            fileId: string(),
            progress: number(),
            loaded: number(),
            total: number(),
            timestamp: number(),
            reason: optional(string())
        })
    },

    FILE_UPLOAD_CANCELLED: {
        version: 1,
        type: 'event',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'File upload cancelled and cleaned up',

        schema: object({
            fileId: string(),
            timestamp: number(),
            reason: optional(string())
        })
    },

    FILE_UPLOAD_RETRIED: {
        version: 1,
        type: 'event',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'File upload retry requested',

        schema: object({
            fileId: string(),
            timestamp: number(),
            attempt: number(),
            reason: optional(string())
        })
    },

    FILE_REMOVED: {
        version: 1,
        type: 'event',
        owner: 'file-upload',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File removed from upload state',

        schema: object({
            fileId: string(),
            timestamp: number()
        })
    }
};

