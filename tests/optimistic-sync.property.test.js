import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ActionLogService } from '../library/modules/optimistic-sync/services/ActionLogService.js';
import { OptimisticSyncService } from '../library/modules/optimistic-sync/services/OptimisticSyncService.js';

const OPTIMISTIC_SEED = 20260414;
const OPTIMISTIC_RUNS = 100;

class PropertyEventBus {
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
            if (index > -1) {
                handlers.splice(index, 1);
            }
        };
    }

    publish(eventName, payload) {
        const handlers = this.listeners.get(eventName) || [];
        handlers.forEach((handler) => handler(payload));
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

async function createOptimisticHarness() {
    const eventBus = new PropertyEventBus();
    const actionLog = new ActionLogService(eventBus);
    await actionLog.init({ store: new MemoryActionStore(), window: null });

    const leaderState = { value: false };
    const networkState = { online: false };
    const flushCalls = [];

    const optimisticSync = new OptimisticSyncService(eventBus);
    await optimisticSync.init({
        actionLogService: actionLog,
        leaderService: {
            isLeader: () => leaderState.value,
            getTabId: () => 'leader-tab'
        },
        networkStatusService: networkState
    });
    optimisticSync.proxyChannel = null;
    optimisticSync.proxyStorage = null;

    optimisticSync.registerIntent('INTENT_SAVE', {
        flush: async (payload) => {
            flushCalls.push(payload.id);
            return { status: 'acked' };
        }
    });

    return {
        model: {
            leader: false,
            online: false,
            published: new Set(),
            pending: new Set(),
            acked: new Set(),
            flushCounts: new Map()
        },
        real: {
            eventBus,
            actionLog,
            optimisticSync,
            leaderState,
            networkState,
            flushCalls
        }
    };
}

function assertOptimisticState(model, real) {
    const pendingIds = real.actionLog.getPending().map((entry) => entry.payload.id).sort();
    expect(pendingIds).toEqual([...model.pending].sort());

    for (const payloadId of real.flushCalls) {
        expect(model.published.has(payloadId)).toBe(true);
    }

    const actualFlushCounts = new Map();
    for (const payloadId of real.flushCalls) {
        actualFlushCounts.set(payloadId, (actualFlushCounts.get(payloadId) || 0) + 1);
    }

    expect([...actualFlushCounts.entries()].sort()).toEqual(
        [...model.flushCounts.entries()].sort()
    );

    for (const count of actualFlushCounts.values()) {
        expect(count).toBe(1);
    }

    expect(model.acked.size + model.pending.size).toBe(model.published.size);
}

async function settleOptimistic(model, real) {
    await real.optimisticSync.flushPending();

    if (model.leader && model.online) {
        for (const payloadId of [...model.pending]) {
            model.pending.delete(payloadId);
            model.acked.add(payloadId);
            model.flushCounts.set(payloadId, (model.flushCounts.get(payloadId) || 0) + 1);
        }
    }

    assertOptimisticState(model, real);
}

class PublishIntentCommand {
    constructor(id, value) {
        this.id = id;
        this.value = value;
    }

    toString() {
        return `publishIntent(${this.id})`;
    }

    check(m) {
        return !m.published.has(this.id);
    }

    async run(m, r) {
        r.eventBus.publish('INTENT_SAVE', { id: this.id, value: this.value });
        m.published.add(this.id);
        m.pending.add(this.id);
        await settleOptimistic(m, r);
    }
}

class SetLeaderCommand {
    constructor(nextLeader) {
        this.nextLeader = nextLeader;
    }

    toString() {
        return `setLeader(${this.nextLeader})`;
    }

    check() {
        return true;
    }

    async run(m, r) {
        m.leader = this.nextLeader;
        r.leaderState.value = this.nextLeader;
        r.eventBus.publish('LEADER_STATE_CHANGED', { role: this.nextLeader ? 'leader' : 'follower' });
        await settleOptimistic(m, r);
    }
}

class SetOnlineCommand {
    constructor(nextOnline) {
        this.nextOnline = nextOnline;
    }

    toString() {
        return `setOnline(${this.nextOnline})`;
    }

    check() {
        return true;
    }

    async run(m, r) {
        m.online = this.nextOnline;
        r.networkState.online = this.nextOnline;
        r.eventBus.publish('NETWORK_STATUS_CHANGED', { online: this.nextOnline });
        await settleOptimistic(m, r);
    }
}

describe('OptimisticSyncService property tests', () => {
    it('only flushes published intents once when leadership and connectivity allow it', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.commands(
                    [
                        fc.uuid().chain((id) =>
                            fc.integer({ min: 0, max: 1000 }).map((value) => new PublishIntentCommand(id, value))
                        ),
                        fc.boolean().map((nextLeader) => new SetLeaderCommand(nextLeader)),
                        fc.boolean().map((nextOnline) => new SetOnlineCommand(nextOnline))
                    ],
                    { maxCommands: 40 }
                ),
                async (commands) => {
                    await fc.asyncModelRun(() => createOptimisticHarness(), commands);
                }
            ),
            {
                seed: OPTIMISTIC_SEED,
                numRuns: OPTIMISTIC_RUNS,
                endOnFailure: true
            }
        );
    });
});
