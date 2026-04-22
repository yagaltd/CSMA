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
    }
};
