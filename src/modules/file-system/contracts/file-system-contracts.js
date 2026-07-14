import { object, string, number, enums, optional, size, array } from '../../../runtime/validation/index.js';

export const FileSystemContracts = {
    FILE_STORED: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when a file is stored',

        schema: object({
            id: string(),
            metadata: object({
                title: size(string(), 1, 240),
                category: optional(string()),
                tags: optional(array(string())),
                mimeType: string()
            }),
            size: number(),
            mimeType: string(),
            storedAt: number()
        })
    },

    FILE_RETRIEVED: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when a file is retrieved for reading',

        schema: object({
            id: string(),
            accessTime: number()
        })
    },

    FILE_DELETED: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when a file is removed',

        schema: object({
            id: string(),
            deletedAt: number()
        })
    },

    FILE_SYSTEM_ERROR: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when file system operations fail',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['store', 'retrieve', 'delete', 'search', 'stream'])
        })
    },

    // ===================================================================
    // Local file access events (browser File System Access API)
    // ===================================================================

    LOCAL_FILE_PICKED: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when user picks files via the browser file picker',
        schema: object({
            count: number(),
            types: array(string()),
            pickedAt: number()
        })
    },

    LOCAL_DIRECTORY_PICKED: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when user picks a directory',
        schema: object({
            rootId: string(),
            name: string(),
            permission: enums(['granted', 'prompt', 'denied']),
            pickedAt: number()
        })
    },

    LOCAL_SAVE_FILE_PICKED: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when user picks a save file location',
        schema: object({
            id: string(),
            name: string(),
            permission: enums(['granted', 'prompt', 'denied']),
            pickedAt: number()
        })
    },

    LOCAL_DIRECTORY_LISTED: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a directory listing completes',
        schema: object({
            rootId: string(),
            path: array(string()),
            count: number(),
            listedAt: number()
        })
    },

    LOCAL_FILE_READ: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a local file is read',
        schema: object({
            id: string(),
            name: string(),
            size: number(),
            mimeType: string(),
            readAt: number()
        })
    },

    LOCAL_FILE_WRITTEN: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when content is written to a local file',
        schema: object({
            id: string(),
            name: string(),
            size: number(),
            writtenAt: number()
        })
    },

    LOCAL_PERMISSION_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when handle permission state changes',
        schema: object({
            id: string(),
            name: string(),
            permission: enums(['granted', 'prompt', 'denied']),
            mode: enums(['read', 'readwrite']),
            changedAt: number()
        })
    },

    LOCAL_FILE_ACCESS_ERROR: {
        version: 1,
        type: 'event',
        owner: 'file-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a local file access operation fails',
        schema: object({
            error: string(),
            operation: enums(['pick-file', 'pick-directory', 'pick-save-file', 'list-directory', 'read-file', 'write-file', 'permission']),
            timestamp: optional(number())
        })
    }
};
