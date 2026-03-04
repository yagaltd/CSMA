import { object, string, number, optional, size, enums } from '../../../runtime/validation/index.js';

export const SyncQueueContracts = {
    INTENT_SYNC_QUEUE_ENQUEUE: {
        version: 1,
        type: 'intent',
        owner: 'sync-queue',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Enqueue a job for background sync',

        schema: object({
            id: optional(string()),
            type: string(),
            payload: object(),
            timestamp: number()
        })
    },

    SYNC_QUEUE_ENQUEUED: {
        version: 1,
        type: 'event',
        owner: 'sync-queue',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when a job is queued',

        schema: object({
            id: string(),
            type: string()
        })
    },

    SYNC_QUEUE_FLUSHED: {
        version: 1,
        type: 'event',
        owner: 'sync-queue',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published after queued jobs run successfully',

        schema: object({
            count: number(),
            lastId: optional(string())
        })
    },

    SYNC_QUEUE_ERROR: {
        version: 1,
        type: 'event',
        owner: 'sync-queue',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when queue processing fails',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['enqueue', 'flush'])
        })
    }
};
