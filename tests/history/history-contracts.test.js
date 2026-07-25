import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { Contracts as CoreContracts } from '../../src/runtime/Contracts.js';
import { HistoryContracts } from '../../src/modules/history/contracts/history-contracts.js';
import { HistoryService } from '../../src/modules/history/services/HistoryService.js';

/**
 * History contracts — payload validation for each HISTORY_* event.
 */
describe('history contracts', () => {
    let eventBus;
    let history;

    beforeEach(async () => {
        eventBus = new EventBus();
        eventBus.contracts = { ...CoreContracts, ...HistoryContracts };
        history = new HistoryService(eventBus);
        await history.init({ broadcast: false });
    });

    it('accepts the canonical HISTORY_OP_RECORDED shape published by HistoryService', () => {
        const events = [];
        eventBus.subscribe('HISTORY_OP_RECORDED', (p) => events.push(p));
        history.record('op:a', { x: 1 });
        expect(events).toHaveLength(1);
    });

    it('accepts a minimal store-routing shape on HISTORY_OP_RECORDED', () => {
        // agent-context and other consumers may publish a routing hint without
        // the full entry object. The contract must accept this for testing
        // and bridging scenarios.
        const events = [];
        eventBus.subscribe('HISTORY_OP_RECORDED', (p) => events.push(p));
        expect(() => eventBus.publish('HISTORY_OP_RECORDED', { store: 'maps' }))
            .not.toThrow();
        expect(events).toHaveLength(1);
    });

    it('accepts HISTORY_OP_UNDONE payload', () => {
        const events = [];
        eventBus.subscribe('HISTORY_OP_UNDONE', (p) => events.push(p));
        history.record('op:a', {});
        history.undo();
        expect(events).toHaveLength(1);
        expect(events[0].cursor).toBe(history.cursor);
    });

    it('accepts HISTORY_OP_REDONE payload', () => {
        const events = [];
        eventBus.subscribe('HISTORY_OP_REDONE', (p) => events.push(p));
        history.record('op:a', {});
        history.undo();
        history.redo();
        expect(events).toHaveLength(1);
    });

    it('emits HISTORY_LOG_READY on init with count', () => {
        const events = [];
        const localBus = new EventBus();
        localBus.contracts = { ...CoreContracts, ...HistoryContracts };
        localBus.subscribe('HISTORY_LOG_READY', (p) => events.push(p));
        const h = new HistoryService(localBus);
        return h.init({ broadcast: false }).then(() => {
            expect(events).toHaveLength(1);
            expect(events[0].count).toBe(0);
        });
    });

    it('silently drops HISTORY_OP_UNDONE with malformed payload (missing entry)', () => {
        // EventBus contract violations are reported via SECURITY events and the
        // offending publish returns [] (silent drop). It does not throw.
        const delivered = [];
        eventBus.subscribe('HISTORY_OP_UNDONE', (p) => delivered.push(p));
        eventBus.publish('HISTORY_OP_UNDONE', {});
        expect(delivered).toHaveLength(0);
    });

    it('silently drops HISTORY_LOG_READY with missing count', () => {
        const delivered = [];
        eventBus.subscribe('HISTORY_LOG_READY', (p) => delivered.push(p));
        eventBus.publish('HISTORY_LOG_READY', {});
        expect(delivered).toHaveLength(0);
    });
});
