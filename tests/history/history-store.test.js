import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryStore } from '../../src/modules/history/services/HistoryStore.js';

/**
 * HistoryStore — IDB round-trip + memory fallback + clear.
 * jsdom lacks IndexedDB; the store auto-falls back to MemoryHistoryBackend.
 */
describe('HistoryStore', () => {
    let store;

    beforeEach(async () => {
        store = new HistoryStore({ dbName: 'test-history', storeName: 'ops' });
        await store.init();
    });

    it('falls back to memory backend when IndexedDB is unavailable', () => {
        expect(store.supportsStorageEvents).toBe(false);
    });

    it('persists and retrieves entries', async () => {
        const entry = {
            id: 'e1',
            intent: 'op:a',
            payload: { x: 1 },
            status: 'recorded',
            createdAt: 1000,
            updatedAt: 1000
        };
        await store.put(entry);
        const all = await store.getAll();
        expect(all).toHaveLength(1);
        expect(all[0]).toEqual(entry);
    });

    it('overwrites an entry on put with same id', async () => {
        await store.put({ id: 'e1', intent: 'op:a', status: 'recorded', createdAt: 1, updatedAt: 1 });
        await store.put({ id: 'e1', intent: 'op:a', status: 'undone', createdAt: 1, updatedAt: 2 });
        const all = await store.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].status).toBe('undone');
    });

    it('deletes by id', async () => {
        await store.put({ id: 'e1', intent: 'op:a', status: 'recorded', createdAt: 1, updatedAt: 1 });
        await store.put({ id: 'e2', intent: 'op:b', status: 'recorded', createdAt: 2, updatedAt: 2 });
        await store.delete('e1');
        const all = await store.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe('e2');
    });

    it('clears all entries', async () => {
        await store.put({ id: 'e1', intent: 'op:a', status: 'recorded', createdAt: 1, updatedAt: 1 });
        await store.put({ id: 'e2', intent: 'op:b', status: 'recorded', createdAt: 2, updatedAt: 2 });
        await store.clear();
        expect(await store.getAll()).toHaveLength(0);
    });

    it('returns newest-first order from getAll', async () => {
        await store.put({ id: 'old', intent: 'op:a', status: 'recorded', createdAt: 100, updatedAt: 100 });
        await store.put({ id: 'new', intent: 'op:b', status: 'recorded', createdAt: 200, updatedAt: 200 });
        const all = await store.getAll();
        expect(all[0].id).toBe('new');
        expect(all[1].id).toBe('old');
    });
});
