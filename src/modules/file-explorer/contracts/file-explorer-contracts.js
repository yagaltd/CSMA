import { object, string, number, optional, array, enums, boolean } from '../../../runtime/validation/index.js';

export const FileExplorerContracts = {
    DIRECTORY_OPENED: {
        version: 1,
        type: 'event',
        owner: 'file-explorer',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a directory is opened via the picker',

        schema: object({
            rootId: string(),
            rootName: string(),
            entryCount: number(),
            openedAt: number()
        })
    },

    DIRECTORY_EXPANDED: {
        version: 1,
        type: 'event',
        owner: 'file-explorer',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a directory node is expanded in the tree',

        schema: object({
            path: array(string()),
            entryCount: number(),
            expandedAt: number()
        })
    },

    DIRECTORY_COLLAPSED: {
        version: 1,
        type: 'event',
        owner: 'file-explorer',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a directory node is collapsed in the tree',

        schema: object({
            path: array(string()),
            collapsedAt: number()
        })
    },

    SELECTION_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'file-explorer',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when the selected entry changes',

        schema: object({
            name: string(),
            kind: enums(['file', 'directory']),
            path: array(string()),
            changedAt: number()
        })
    },

    FILE_OPENED: {
        version: 1,
        type: 'event',
        owner: 'file-explorer',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a file is opened for preview/tile',

        schema: object({
            fileName: string(),
            mimeType: string(),
            size: optional(number()),
            truncated: boolean(),
            path: array(string()),
            openedAt: number()
        })
    },

    FILE_EXPLORER_ERROR: {
        version: 1,
        type: 'event',
        owner: 'file-explorer',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when an error occurs during file explorer operations',

        schema: object({
            error: string(),
            operation: string(),
            timestamp: number()
        })
    }
};
