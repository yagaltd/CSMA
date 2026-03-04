import { SyncQueueService } from './services/SyncQueueService.js';

export const manifest = {
    name: 'Sync Queue',
    version: '1.0.0',
    description: 'Offline-first job queue that flushes when network is available',
    dependencies: ['networkStatus'],
    bundleSize: '+3KB',
    contracts: [
        'INTENT_SYNC_QUEUE_ENQUEUE',
        'SYNC_QUEUE_ENQUEUED',
        'SYNC_QUEUE_FLUSHED',
        'SYNC_QUEUE_ERROR'
    ]
};

export const services = {
    syncQueue: SyncQueueService
};

export function createSyncQueue(eventBus, options = {}) {
    const service = new SyncQueueService(eventBus, options);
    service.init(options);
    return service;
}
