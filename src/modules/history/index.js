import { HistoryService } from './services/HistoryService.js';
import { HistoryContracts } from './contracts/history-contracts.js';

/**
 * history module — generic do/undo/redo + append-only operation log.
 *
 * Extracted from optimistic-sync's ActionLogService. Sync-agnostic: owns the
 * log only. Consumers layer their own concerns on top (optimistic-sync adds
 * acked/failed/pending tracking via SyncStateTracker; slides adds undo UI;
 * visual-editor may migrate its Transaction engine onto this later).
 *
 * Dependencies: storage (IDB primitive, used indirectly via HistoryStore).
 */
export const manifest = {
    id: 'history',
    name: 'History',
    version: '1.0.0',
    description: 'Generic do/undo/redo operation log with IDB persistence and multi-tab broadcast',
    dependencies: [],
    services: ['history'],
    bundleSize: '~5KB',
    contracts: Object.keys(HistoryContracts)
};

export const services = {
    history: HistoryService
};

export const contracts = HistoryContracts;
