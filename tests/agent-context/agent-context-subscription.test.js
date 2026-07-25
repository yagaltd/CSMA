import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { Contracts } from '../../src/runtime/Contracts.js';
import { ServiceManager } from '../../src/runtime/ServiceManager.js';
import { SerializerRegistry } from '../../src/runtime/SerializerRegistry.js';
import { AgentContextService } from '../../src/modules/agent-context/services/AgentContextService.js';
import { AgentContextContracts } from '../../src/modules/agent-context/contracts/agent-context-contracts.js';
import { object, string, optional, any } from '../../src/runtime/validation/index.js';

// History module ships its own HISTORY_OP_RECORDED contract in production.
// For these tests we register a stub matching the tightened canonical shape
// (entry required, store routing inside entry.meta.store) so eventBus.publish
// does not silently drop the event as an unknown-event security violation.
const HISTORY_OP_RECORDED_STUB = {
    version: 1,
    type: 'event',
    owner: 'history',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'test stub for history op recorded',
    schema: object({
        entry: object({
            id: string(),
            intent: string(),
            meta: optional(any())
        })
    })
};

// Helper: build a canonical history event with a store routing hint.
function historyEvent(store, intent = 'test:op') {
    return { entry: { id: `evt-${Math.random().toString(36).slice(2)}`, intent, meta: { store } } };
}

function buildSubscriptionCore() {
    const eventBus = new EventBus();
    eventBus.contracts = {
        ...Contracts,
        ...AgentContextContracts,
        HISTORY_OP_RECORDED: HISTORY_OP_RECORDED_STUB
    };
    const serviceManager = new ServiceManager(eventBus);
    const serializerRegistry = new SerializerRegistry({ eventBus });
    serviceManager.register('serializerRegistry', serializerRegistry, {
        version: '1.0.0'
    });
    const agentContext = new AgentContextService(eventBus);
    agentContext.init({ serializerRegistry, serviceManager });
    return { eventBus, serviceManager, serializerRegistry, agentContext };
}

describe('AgentContextService subscription', () => {
    let eventBus;
    let serviceManager;
    let serializerRegistry;
    let agentContext;

    beforeEach(() => {
        ({ eventBus, serviceManager, serializerRegistry, agentContext } = buildSubscriptionCore());
    });

    it('throws when history module not available', () => {
        expect(() => agentContext.subscribe({ store: 'maps' }, () => {}))
            .toThrow(/history module/);
    });

    it('accepts subscription when history service is registered', () => {
        const fakeHistory = { getAll: () => [] };
        serviceManager.register('history', fakeHistory, { version: '1.0.0' });
        // Reset cached null.
        agentContext._history = null;
        const unsubscribe = agentContext.subscribe({ store: 'maps' }, () => {});
        expect(typeof unsubscribe).toBe('function');
        unsubscribe();
    });

    it('delivers updated serialization on HISTORY_OP_RECORDED', async () => {
        const fakeHistory = { getAll: () => [] };
        serviceManager.register('history', fakeHistory, { version: '1.0.0' });
        agentContext._history = null;

        const calls = [];
        const unsubscribe = agentContext.subscribe(
            { store: 'maps', format: 'markdown' },
            (response) => calls.push(response)
        );

        // Publish a fake history event for the matching store.
        eventBus.publish('HISTORY_OP_RECORDED', historyEvent('maps', 'mindmap:addNode'));

        // Allow async get() to resolve.
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(calls.length).toBe(1);
        expect(calls[0].format).toBe('markdown');
        expect(calls[0].text).toContain('## maps');

        unsubscribe();
    });

    it('unsubscribe stops delivery', async () => {
        const fakeHistory = { getAll: () => [] };
        serviceManager.register('history', fakeHistory, { version: '1.0.0' });
        agentContext._history = null;

        const calls = [];
        const unsubscribe = agentContext.subscribe(
            { store: 'maps' },
            (response) => calls.push(response)
        );

        unsubscribe();

        eventBus.publish('HISTORY_OP_RECORDED', historyEvent('maps'));
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(calls.length).toBe(0);
    });

    it('wildcard store matches any history event', async () => {
        const fakeHistory = { getAll: () => [] };
        serviceManager.register('history', fakeHistory, { version: '1.0.0' });
        agentContext._history = null;

        const calls = [];
        const unsubscribe = agentContext.subscribe(
            { store: '*' },
            (response) => calls.push(response)
        );

        eventBus.publish('HISTORY_OP_RECORDED', historyEvent('anything'));
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(calls.length).toBeGreaterThanOrEqual(1);
        unsubscribe();
    });

    it('history ops on other stores do not deliver', async () => {
        const fakeHistory = { getAll: () => [] };
        serviceManager.register('history', fakeHistory, { version: '1.0.0' });
        agentContext._history = null;

        const calls = [];
        const unsubscribe = agentContext.subscribe(
            { store: 'maps' },
            (response) => calls.push(response)
        );

        eventBus.publish('HISTORY_OP_RECORDED', historyEvent('cart'));
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(calls.length).toBe(0);
        unsubscribe();
    });
});
