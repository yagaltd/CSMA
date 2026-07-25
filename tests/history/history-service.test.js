import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { HistoryService } from '../../src/modules/history/services/HistoryService.js';

/**
 * HistoryService core: record / undo / redo / query / cursor.
 * Uses the in-memory store fallback (no IndexedDB in jsdom by default).
 */
describe('HistoryService', () => {
    let eventBus;
    let history;

    beforeEach(async () => {
        eventBus = new EventBus();
        history = new HistoryService(eventBus);
        // Force the memory backend by overriding IndexedDB global absence.
        await history.init({ broadcast: false });
    });

    describe('record', () => {
        it('appends an entry and publishes HISTORY_OP_RECORDED', () => {
            const events = [];
            eventBus.subscribe('HISTORY_OP_RECORDED', (payload) => events.push(payload));

            const entry = history.record('mindmap:addNode', { id: 'n1' });

            expect(entry.id).toBeTruthy();
            expect(entry.intent).toBe('mindmap:addNode');
            expect(entry.status).toBe('recorded');
            expect(entry.meta.channels).toEqual(['global']);
            expect(events).toHaveLength(1);
            expect(events[0].entry.id).toBe(entry.id);
        });

        it('assigns monotonically advancing clocks', () => {
            const a = history.record('op:a', {});
            const b = history.record('op:b', {});
            expect(b.meta.clock).toBeGreaterThan(a.meta.clock);
        });

        it('carries undo descriptor when provided', () => {
            const entry = history.record('cart:add', { sku: 'X' }, {
                undo: { intent: 'cart:remove', payload: { sku: 'X' } }
            });
            expect(entry.meta.undo).toEqual({
                intent: 'cart:remove',
                payload: { sku: 'X' }
            });
        });
    });

    describe('undo / redo', () => {
        it('cannot undo or redo on empty log', () => {
            expect(history.canUndo()).toBe(false);
            expect(history.canRedo()).toBe(false);
            expect(history.undo()).toBeNull();
            expect(history.redo()).toBeNull();
        });

        it('undoes the most recent entry and emits HISTORY_OP_UNDONE', () => {
            const events = [];
            eventBus.subscribe('HISTORY_OP_UNDONE', (payload) => events.push(payload));

            history.record('op:a', {});
            const b = history.record('op:b', {});

            expect(history.canUndo()).toBe(true);
            const undone = history.undo();
            expect(undone.id).toBe(b.id);
            expect(undone.status).toBe('undone');
            expect(events).toHaveLength(1);
            expect(events[0].entry.id).toBe(b.id);
            expect(events[0].cursor).toBe(history.cursor);
        });

        it('cannot undo past zero entries', () => {
            history.record('op:a', {});
            history.record('op:b', {});
            history.undo({ steps: 5 });
            // Both undone but no further.
            expect(history.getAll().filter(e => e.status === 'undone')).toHaveLength(2);
            expect(history.canUndo()).toBe(false);
            expect(history.undo()).toBeNull();
        });

        it('redoes a previously undone entry', () => {
            const events = [];
            eventBus.subscribe('HISTORY_OP_REDONE', (payload) => events.push(payload));

            history.record('op:a', {});
            const b = history.record('op:b', {});

            history.undo();
            expect(history.canRedo()).toBe(true);

            const redone = history.redo();
            expect(redone.id).toBe(b.id);
            expect(redone.status).toBe('redone');
            expect(events).toHaveLength(1);
            expect(events[0].entry.id).toBe(b.id);
        });

        it('cannot redo when nothing is undone', () => {
            history.record('op:a', {});
            expect(history.canRedo()).toBe(false);
            expect(history.redo()).toBeNull();
        });

        it('multi-step undo equals N single undos', () => {
            history.record('op:a', {});
            history.record('op:b', {});
            history.record('op:c', {});

            const undoneMulti = history.undo({ steps: 3 });
            const allMulti = history.getAll().map(e => ({ id: e.id, status: e.status }));

            // Reset and try single-step
            history.redo({ steps: 3 });
            history.undo();
            history.undo();
            history.undo();
            const allSingle = history.getAll().map(e => ({ id: e.id, status: e.status }));

            expect(allMulti).toEqual(allSingle);
        });

        it('record after undo clears the redo frontier', () => {
            history.record('op:a', {});
            history.record('op:b', {});
            history.undo();
            expect(history.canRedo()).toBe(true);

            // New record branch — redo should no longer be available.
            history.record('op:c', {});
            expect(history.canRedo()).toBe(false);
        });
    });

    describe('query', () => {
        it('getAll returns a defensive copy', () => {
            history.record('op:a', {});
            const all1 = history.getAll();
            const all2 = history.getAll();
            expect(all1).not.toBe(all2);
            expect(all1).toEqual(all2);
        });

        it('getSince returns entries newer than the cursor', () => {
            const a = history.record('op:a', {});
            const b = history.record('op:b', {});
            history.record('op:c', {});

            // Cursor = b → entries newer than b = [c] (which is at index 0 in newest-first order).
            const since = history.getSince(b.id);
            expect(since).toHaveLength(1);
            expect(since[0].intent).toBe('op:c');
        });

        it('getSince with null cursor returns all', () => {
            history.record('op:a', {});
            history.record('op:b', {});
            expect(history.getSince(null)).toHaveLength(2);
        });

        it('hasEntry reports membership', () => {
            const entry = history.record('op:a', {});
            expect(history.hasEntry(entry.id)).toBe(true);
            expect(history.hasEntry('does-not-exist')).toBe(false);
        });

        it('cursor advances as new entries land', () => {
            expect(history.cursor).toBe('');
            const a = history.record('op:a', {});
            expect(history.cursor).toBe(a.id);
            const b = history.record('op:b', {});
            expect(history.cursor).toBe(b.id);
        });
    });

    describe('removeEntry', () => {
        it('drops an entry and adjusts undo depth if needed', () => {
            const a = history.record('op:a', {});
            const b = history.record('op:b', {});
            history.undo(); // b is now undone, _undoDepth = 1
            expect(history.canRedo()).toBe(true);

            history.removeEntry(b.id);
            expect(history.hasEntry(b.id)).toBe(false);
            expect(history.canRedo()).toBe(false);
        });

        it('returns false for unknown id', () => {
            expect(history.removeEntry('nope')).toBe(false);
        });
    });

    describe('clock getter', () => {
        it('returns the internal clock value without recursion', () => {
            const before = history.clock;
            history.record('op:a', {});
            expect(history.clock).toBeGreaterThan(before);
        });
    });
});
