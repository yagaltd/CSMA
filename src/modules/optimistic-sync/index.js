import { OptimisticSyncService } from './services/OptimisticSyncService.js';
import { SyncTransportService } from './services/SyncTransportService.js';
import { OptimisticSyncContracts } from './contracts/optimistic-sync-contracts.js';

/**
 * optimistic-sync module — local-first intent log with optimistic syncing to SSMA.
 *
 * Built on the generic `history` module. The ActionLogService that used to
 * live here has been extracted into history; this module now layers
 * acked/failed/pending tracking (via SyncStateTracker) and transport
 * (via SyncTransportService) on top of the generic log.
 *
 * Migration note (Wave 1 hard cut):
 * - `services.actionLog` export removed — downstream callers should obtain
 *   the history service via `serviceManager.get('history')` instead.
 * - `dependencies: ['leader', 'history']` — history must load first.
 * - OptimisticSyncService.init now takes `{ historyService, leaderService,
 *   networkStatusService, transportService }` (was `actionLogService`).
 */
export const manifest = {
    id: 'optimistic-sync',
    name: 'Optimistic Sync',
    version: '1.1.0',
    description: 'Local-first intent log with optimistic syncing to SSMA. Built on the generic history module; this module layers acked/failed/pending tracking and transport on top.',
    dependencies: ['leader', 'history'],
    services: ['optimisticSync', 'optimisticTransport'],
    bundleSize: '+4KB',
    contracts: [
        'OPTIMISTIC_ACTION_RECORDED',
        'OPTIMISTIC_ACTION_INGESTED',
        'OPTIMISTIC_ACTION_ACKED',
        'OPTIMISTIC_ACTION_FAILED',
        'OPTIMISTIC_ACTION_DROPPED',
        'OPTIMISTIC_ACTION_UPDATED',
        'OPTIMISTIC_CRDT_STATE_CHANGED',
        'OPTIMISTIC_TRANSPORT_STATE',
        'OPTIMISTIC_TRANSPORT_ACK',
        'OPTIMISTIC_TRANSPORT_REPLAY',
        'OPTIMISTIC_INVALIDATION',
        'OPTIMISTIC_SERVER_REWORK',
        'CHANNEL_SERVER_EVENT',
        'CHANNEL_SERVER_SNAPSHOT',
        'CHANNEL_SERVER_INVALIDATE',
        'CHANNEL_SERVER_REPLAY',
        'CHANNEL_ACCESS_DENIED',
        'CHANNEL_COMMAND_RESULT',
        'ISLAND_INVALIDATED'
    ]
};

export const services = {
    optimisticSync: OptimisticSyncService,
    optimisticTransport: SyncTransportService
};

export const contracts = OptimisticSyncContracts;
