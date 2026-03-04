import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionLogService } from '../src/modules/optimistic-sync/services/ActionLogService.js';
import { OptimisticSyncService } from '../src/modules/optimistic-sync/services/OptimisticSyncService.js';

class MockBroadcastChannel {
    constructor(name) {
        this.name = name;
        this.listeners = new Set();
        if (!MockBroadcastChannel.registries.has(name)) {
            MockBroadcastChannel.registries.set(name, new Set());
        }
        MockBroadcastChannel.registries.get(name).add(this);
    }

    addEventListener(type, handler) {
        if (type === 'message') {
            this.listeners.add(handler);
        }
    }

    removeEventListener(type, handler) {
        if (type === 'message') {
            this.listeners.delete(handler);
        }
    }

    postMessage(payload) {
        const peers = MockBroadcastChannel.registries.get(this.name) || new Set();
        peers.forEach((channel) => {
            channel.listeners.forEach((listener) => listener({ data: payload }));
        });
    }

    close() {
        const peers = MockBroadcastChannel.registries.get(this.name);
        if (peers) {
            peers.delete(this);
        }
        this.listeners.clear();
    }
}

MockBroadcastChannel.registries = new Map();
MockBroadcastChannel.reset = function resetMockChannels() {
    MockBroadcastChannel.registries = new Map();
};

if (typeof globalThis.BroadcastChannel === 'undefined') {
    globalThis.BroadcastChannel = MockBroadcastChannel;
}

class TestEventBus {
    constructor() {
        this.listeners = new Map();
    }

    subscribe(eventName, handler) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        const handlers = this.listeners.get(eventName);
        handlers.push(handler);
        return () => {
            const index = handlers.indexOf(handler);
            if (index > -1) handlers.splice(index, 1);
        };
    }

    publish(eventName, payload) {
        const handlers = this.listeners.get(eventName) || [];
        handlers.forEach(handler => handler(payload));
    }
}

class MemoryActionStore {
    constructor() {
        this.items = new Map();
        this.supportsStorageEvents = false;
    }

    init() {
        return Promise.resolve();
    }

    async getAll() {
        return Array.from(this.items.values());
    }

    async put(entry) {
        this.items.set(entry.id, entry);
    }

    async delete(id) {
        this.items.delete(id);
    }

    async clear() {
        this.items.clear();
    }
}

describe('ActionLogService', () => {
    let eventBus;

    beforeEach(() => {
        MockBroadcastChannel.reset();
        eventBus = new TestEventBus();
    });

    it('records and acknowledges actions', async () => {
        const service = new ActionLogService(eventBus);
        await service.init({ store: new MemoryActionStore(), window: null });

        const entry = service.record('INTENT_TEST', { foo: 'bar' });
        expect(service.getPending()).toHaveLength(1);
        expect(entry.intent).toBe('INTENT_TEST');

        service.markAcked(entry.id);
        expect(service.getPending()).toHaveLength(0);
    });

    it('persists reducer and crdt metadata when provided', async () => {
        const service = new ActionLogService(eventBus);
        await service.init({ store: new MemoryActionStore(), window: null });

        const entry = service.record(
            'INTENT_META',
            { quantity: 5 },
            {
                actionCreator: 'inventory.set',
                reducer: 'inventory.quantity',
                actor: 'tab-1',
                crdt: { type: 'lww-register', key: 'inventory:sku-1', value: 5 }
            }
        );

        expect(entry.meta.actionCreator).toBe('inventory.set');
        expect(entry.meta.reducer).toBe('inventory.quantity');
        expect(entry.meta.actor).toBe('tab-1');
        expect(entry.meta.crdt).toEqual(
            expect.objectContaining({ type: 'lww-register', key: 'inventory:sku-1', value: 5 })
        );
    });
});

describe('OptimisticSyncService', () => {
    let eventBus;

    beforeEach(() => {
        MockBroadcastChannel.reset();
        eventBus = new TestEventBus();
    });

    it('flushes pending actions when leader and online', async () => {
        const actionLog = new ActionLogService(eventBus);
        await actionLog.init({ store: new MemoryActionStore(), window: null });
        const leader = { isLeader: () => true };
        const optimisticSync = new OptimisticSyncService(eventBus);
        await optimisticSync.init({
            actionLogService: actionLog,
            leaderService: leader,
            networkStatusService: { online: true }
        });

        const flushSpy = vi.fn(async () => {});
        optimisticSync.registerIntent('INTENT_SAVE', {
            flush: flushSpy
        });

        eventBus.publish('INTENT_SAVE', { message: 'hello' });
        await optimisticSync.flushPending();

        expect(flushSpy).toHaveBeenCalledTimes(1);
        expect(actionLog.getPending()).toHaveLength(0);
    });

    it('waits for leadership before flushing', async () => {
        const actionLog = new ActionLogService(eventBus);
        await actionLog.init({ store: new MemoryActionStore(), window: null });
        let isLeader = false;
        const leader = { isLeader: () => isLeader };
        const optimisticSync = new OptimisticSyncService(eventBus);
        await optimisticSync.init({
            actionLogService: actionLog,
            leaderService: leader,
            networkStatusService: { online: true }
        });
        const flushSpy = vi.fn(async () => {});
        optimisticSync.registerIntent('INTENT_SAVE', {
            flush: flushSpy
        });

        eventBus.publish('INTENT_SAVE', { value: 1 });
        await optimisticSync.flushPending();
        expect(flushSpy).not.toHaveBeenCalled();
        expect(actionLog.getPending()).toHaveLength(1);

        isLeader = true;
        await optimisticSync.flushPending();
        expect(flushSpy).toHaveBeenCalledTimes(1);
        expect(actionLog.getPending()).toHaveLength(0);
    });

    it('invokes resolveConflict to retry with updated payload', async () => {
        const actionLog = new ActionLogService(eventBus);
        await actionLog.init({ store: new MemoryActionStore(), window: null });
        const leader = { isLeader: () => true };
        const optimisticSync = new OptimisticSyncService(eventBus);
        await optimisticSync.init({
            actionLogService: actionLog,
            leaderService: leader,
            networkStatusService: { online: true }
        });

        const flushSpy = vi
            .fn()
            .mockRejectedValueOnce({ code: 'CONFLICT' })
            .mockResolvedValueOnce({ version: 2 });

        const resolveConflict = vi.fn(async () => ({
            retryPayload: { value: 'updated' },
            delayMs: 0
        }));

        optimisticSync.registerIntent('INTENT_CONFLICT', {
            flush: flushSpy,
            resolveConflict
        });

        eventBus.publish('INTENT_CONFLICT', { value: 'initial' });
        await optimisticSync.flushPending();

        expect(resolveConflict).toHaveBeenCalledTimes(1);
        expect(flushSpy).toHaveBeenCalledTimes(2);
        expect(actionLog.getPending()).toHaveLength(0);
    });

    it('uses transport service when no explicit flush provided', async () => {
        const actionLog = new ActionLogService(eventBus);
        await actionLog.init({ store: new MemoryActionStore(), window: null });
        const leader = { isLeader: () => true };
        const transport = {
            sendIntent: vi.fn(async () => ({ status: 'acked' }))
        };

        const optimisticSync = new OptimisticSyncService(eventBus);
        await optimisticSync.init({
            actionLogService: actionLog,
            leaderService: leader,
            transportService: transport,
            networkStatusService: { online: true }
        });

        optimisticSync.registerIntent('INTENT_AUTO', {
            applyLocal: () => {}
        });

        eventBus.publish('INTENT_AUTO', { foo: 'bar' });
        await optimisticSync.flushPending();

        expect(transport.sendIntent).toHaveBeenCalledTimes(1);
        expect(actionLog.getPending()).toHaveLength(0);
    });

    it('prepares undo payloads and reacts to server rework events', async () => {
        const actionLog = new ActionLogService(eventBus);
        await actionLog.init({ store: new MemoryActionStore(), window: null });
        const leader = { isLeader: () => true };
        const optimisticSync = new OptimisticSyncService(eventBus);
        await optimisticSync.init({
            actionLogService: actionLog,
            leaderService: leader,
            networkStatusService: { online: true }
        });

        const onRework = vi.fn();

        optimisticSync.registerIntent('INTENT_CREATE', {
            flush: vi.fn(async () => ({})),
            prepareUndo: (payload) => ({ intent: 'INTENT_REMOVE', payload: { id: payload.id } }),
            onRework
        });

        optimisticSync.registerIntent('INTENT_REMOVE', {
            flush: vi.fn(async () => ({})),
            applyLocal: vi.fn()
        });

        eventBus.publish('INTENT_CREATE', { id: 'item-1', label: 'Item' });
        const entry = actionLog.getAll()[0];
        expect(entry.meta.undo.intent).toBe('INTENT_REMOVE');
        expect(entry.meta.undo.payload).toEqual({ id: 'item-1' });

        const publishSpy = vi.spyOn(eventBus, 'publish');

        eventBus.publish('OPTIMISTIC_SERVER_REWORK', {
            intents: [
                {
                    id: entry.id,
                    intent: 'INTENT_CREATE',
                    undo: { intent: 'INTENT_REMOVE', payload: { id: 'item-1' } },
                    payload: { id: 'item-1' }
                }
            ]
        });

        expect(onRework).toHaveBeenCalledTimes(1);
        expect(publishSpy).toHaveBeenCalledWith('INTENT_REMOVE', { id: 'item-1' });
        publishSpy.mockRestore();
    });

    it('routes follower intents to leader via proxy channel', async () => {
        const leaderBus = new TestEventBus();
        const followerBus = new TestEventBus();

        const leaderActionLog = new ActionLogService(leaderBus);
        await leaderActionLog.init({ store: new MemoryActionStore(), window: null });
        const followerActionLog = new ActionLogService(followerBus);
        await followerActionLog.init({ store: new MemoryActionStore(), window: null });

        const leaderIdentity = { isLeader: () => true, getTabId: () => 'leader-tab' };
        const followerIdentity = { isLeader: () => false, getTabId: () => 'follower-tab' };

        const leaderSync = new OptimisticSyncService(leaderBus);
        await leaderSync.init({
            actionLogService: leaderActionLog,
            leaderService: leaderIdentity,
            networkStatusService: { online: true }
        });
        const flushSpy = vi.fn(async () => {});
        leaderSync.registerIntent('INTENT_PROXY', { flush: flushSpy });

        const followerSync = new OptimisticSyncService(followerBus);
        await followerSync.init({
            actionLogService: followerActionLog,
            leaderService: followerIdentity,
            networkStatusService: { online: true }
        });
        followerSync.registerIntent('INTENT_PROXY', { flush: vi.fn() });

        followerBus.publish('INTENT_PROXY', { foo: 'from-follower' });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(flushSpy).toHaveBeenCalledTimes(1);
        expect(leaderActionLog.getPending()).toHaveLength(0);
    });

    it('attaches CRDT metadata and emits resolved LWW state', async () => {
        const actionLog = new ActionLogService(eventBus);
        await actionLog.init({ store: new MemoryActionStore(), window: null });
        const leader = { isLeader: () => true, getTabId: () => 'leader-tab' };
        const optimisticSync = new OptimisticSyncService(eventBus);
        await optimisticSync.init({
            actionLogService: actionLog,
            leaderService: leader,
            networkStatusService: { online: true }
        });

        const publishSpy = vi.spyOn(eventBus, 'publish');

        optimisticSync.registerIntent('INVENTORY_SET', {
            flush: vi.fn(async () => ({})),
            actionCreator: 'inventory.setQuantity',
            reducerId: 'inventory.quantity',
            crdt: {
                type: 'lww-register',
                key: (payload) => `inventory:${payload.id}`,
                value: (payload) => payload.quantity
            }
        });

        eventBus.publish('INVENTORY_SET', { id: 'sku-1', quantity: 10 });
        const entry = actionLog.getPending()[0];
        expect(entry.meta.reducer).toBe('inventory.quantity');
        expect(entry.meta.actionCreator).toBe('inventory.setQuantity');
        expect(entry.meta.crdt).toEqual(
            expect.objectContaining({ type: 'lww-register', key: 'inventory:sku-1', value: 10 })
        );

        expect(optimisticSync.getReducerState('inventory.quantity', 'inventory:sku-1')).toBe(10);
        const crdtEvents = publishSpy.mock.calls.filter(([eventName]) => eventName === 'OPTIMISTIC_CRDT_STATE_CHANGED');
        expect(crdtEvents.length).toBeGreaterThan(0);
        publishSpy.mockRestore();
    });

    it('merges remote counter intents deterministically', async () => {
        const actionLog = new ActionLogService(eventBus);
        await actionLog.init({ store: new MemoryActionStore(), window: null });
        const leader = { isLeader: () => true, getTabId: () => 'leader-tab' };
        const optimisticSync = new OptimisticSyncService(eventBus);
        await optimisticSync.init({
            actionLogService: actionLog,
            leaderService: leader,
            networkStatusService: { online: true }
        });

        optimisticSync.registerIntent('INVENTORY_INCREMENT', {
            flush: vi.fn(async () => ({})),
            reducerId: 'inventory.quantity',
            crdt: {
                type: 'g-counter',
                key: (payload) => `inventory:${payload.id}`,
                delta: (payload) => payload.delta
            }
        });

        const remoteEntry = {
            id: 'remote-1',
            intent: 'INVENTORY_INCREMENT',
            payload: { id: 'sku-1', delta: 2 },
            meta: {
                clock: Date.now(),
                reasons: ['channel:global'],
                channels: ['global'],
                reducer: 'inventory.quantity',
                actor: 'remote-tab',
                crdt: {
                    type: 'g-counter',
                    key: 'inventory:sku-1',
                    delta: 2,
                    reducer: 'inventory.quantity',
                    actor: 'remote-tab'
                }
            }
        };

        eventBus.publish('CHANNEL_SERVER_INVALIDATE', { intents: [remoteEntry], reason: 'intent-flush' });
        expect(optimisticSync.getReducerState('inventory.quantity', 'inventory:sku-1')).toBe(2);

        eventBus.publish('CHANNEL_SERVER_INVALIDATE', { intents: [remoteEntry], reason: 'intent-flush' });
        expect(optimisticSync.getReducerState('inventory.quantity', 'inventory:sku-1')).toBe(2);
    });
});
