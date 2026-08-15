import { object, string, any } from '../../../runtime/validation/index.js';

/**
 * Storage module — EventBus contracts.
 *
 * The Storage service publishes a lifecycle event for every IndexedDB
 * mutation it performs. `id` fields accept any key type because IndexedDB
 * keys can be strings (explicit keyPath values) or numbers (autoIncrement).
 */

export const StorageContracts = {
    STORAGE_READY: {
        version: 1,
        type: 'event',
        owner: 'storage-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the IndexedDB connection opens successfully',
        schema: object({
            dbName: string()
        })
    },

    STORAGE_ADDED: {
        version: 1,
        type: 'event',
        owner: 'storage-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when an item is added to an object store',
        schema: object({
            storeName: string(),
            id: any()
        })
    },

    STORAGE_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'storage-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when an item is updated (put) in an object store',
        schema: object({
            storeName: string(),
            id: any()
        })
    },

    STORAGE_DELETED: {
        version: 1,
        type: 'event',
        owner: 'storage-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when an item is deleted from an object store',
        schema: object({
            storeName: string(),
            id: any()
        })
    },

    STORAGE_CLEARED: {
        version: 1,
        type: 'event',
        owner: 'storage-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when all items are cleared from an object store',
        schema: object({
            storeName: string()
        })
    }
};
