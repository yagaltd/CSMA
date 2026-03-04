import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { DataTableService } from '../src/modules/data-table/services/DataTableService.js';

describe('DataTableService', () => {
    let eventBus;
    let service;
    let updates;
    let fetcher;

    beforeEach(() => {
        eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        updates = [];
        eventBus.subscribe('DATA_TABLE_UPDATED', (payload) => updates.push(payload));

        fetcher = vi.fn(async () => ({ data: [{ id: 1 }, { id: 2 }], total: 2 }));
        service = new DataTableService(eventBus, { fetcher });
        service.init({ fetcher });
    });

    it('loads table data via fetcher and publishes updates', async () => {
        await service.load({ tableId: 'users', endpoint: '/users' });
        expect(fetcher).toHaveBeenCalledOnce();
        expect(updates).toHaveLength(1);
        expect(updates[0].rows).toHaveLength(2);
    });
});
