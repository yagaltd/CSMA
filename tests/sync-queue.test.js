import './helpers/storage-polyfill.js';
import { describe, it, expect, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { SyncQueueService } from '../src/modules/sync-queue/services/SyncQueueService.js';

describe('SyncQueueService', () => {
    it('flushes queued jobs when network is online', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        const flushed = [];
        eventBus.subscribe('SYNC_QUEUE_FLUSHED', (payload) => flushed.push(payload));

        const networkStatus = { online: false };
        const processor = vi.fn(async () => undefined);
        const service = new SyncQueueService(eventBus, {
            storage: null,
            networkStatus,
            processors: { TEST: processor }
        });

        service.init({ networkStatusService: networkStatus });
        service.enqueue({ type: 'TEST', payload: { value: 1 } });
        expect(processor).not.toHaveBeenCalled();

        networkStatus.online = true;
        await service.flush();

        expect(processor).toHaveBeenCalledOnce();
        expect(flushed[0].count).toBe(1);
    });
});
