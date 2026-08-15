/**
 * CSMA file-upload contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, optional } from '../validation/index.js';

export const FileUploadContracts = {
    // File Upload Events
    INTENT_FILE_UPLOAD: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to upload a file',

        schema: object({
            file: object(),
            timestamp: number()
        })
    },

    FILE_UPLOAD_STARTED: {
        version: 1,
        type: 'event',
        owner: 'file-upload-service',
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
        owner: 'file-upload-service',
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
        owner: 'file-upload-service',
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
        owner: 'file-upload-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File upload failed',

        schema: object({
            fileId: string(),
            fileName: string(),
            error: string(),
            timestamp: number()
        })
    },

    FILE_REMOVED: {
        version: 1,
        type: 'event',
        owner: 'file-upload-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File removed from upload queue',

        schema: object({
            fileId: string(),
            timestamp: number()
        })
    },
};
