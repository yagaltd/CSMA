import { ActionLogService } from './services/ActionLogService.js';
import { OptimisticSyncService } from './services/OptimisticSyncService.js';
import { SyncTransportService } from './services/SyncTransportService.js';

export const manifest = {
    name: 'Optimistic Sync',
    version: '1.0.0',
    description: 'Local-first action log with optimistic syncing to SSMA',
    dependencies: ['leader'],
    bundleSize: '+4KB',
    contracts: [
        'OPTIMISTIC_ACTION_RECORDED',
        'OPTIMISTIC_ACTION_ACKED',
        'OPTIMISTIC_ACTION_FAILED'
    ]
};

export const services = {
    actionLog: ActionLogService,
    optimisticSync: OptimisticSyncService,
    optimisticTransport: SyncTransportService
};
