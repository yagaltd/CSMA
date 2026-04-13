import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import EventBus from '../library/runtime/EventBus.js';
import { Contracts } from '../library/runtime/Contracts.js';
import { CheckoutService } from '../library/modules/checkout/services/CheckoutService.js';

const CHECKOUT_SEED = 20260413;
const CHECKOUT_RUNS = 150;
const TAX_RATE = 0.07;

function computeTotals(items) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = Number((subtotal * TAX_RATE).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));
    return { subtotal, tax, total };
}

function sortedKeys(mapLike) {
    return [...mapLike.keys()].sort();
}

function createCheckoutHarness() {
    const eventBus = new EventBus();
    eventBus.contracts = { ...Contracts };

    const completionLog = [];
    eventBus.subscribe('CHECKOUT_COMPLETED', (payload) => completionLog.push(payload));

    const formService = {
        registerForm: vi.fn(),
        getFormState: vi.fn((formId) => ({
            values: {
                email: `${formId}@example.com`,
                name: 'Ada',
                address: '42 Loop',
                paymentMethod: 'card'
            }
        })),
        resetForm: vi.fn()
    };

    const syncQueue = { enqueue: vi.fn() };
    const submitHandler = vi.fn(async ({ checkoutId }) => ({
        orderId: `${checkoutId}-order`
    }));

    const service = new CheckoutService(eventBus, {
        formService,
        syncQueue,
        submitHandler
    });
    service.init({ formService, syncQueueService: syncQueue, submitHandler });

    return {
        model: {
            sessions: new Map(),
            completionCounts: new Map()
        },
        real: {
            service,
            syncQueue,
            completionLog
        }
    };
}

function assertCheckoutState(model, real) {
    const { service, syncQueue, completionLog } = real;

    expect(sortedKeys(service.sessions)).toEqual(sortedKeys(model.sessions));

    for (const [checkoutId, expected] of model.sessions.entries()) {
        const session = service.sessions.get(checkoutId);
        expect(session).toBeTruthy();
        expect(session.id).toBe(checkoutId);
        expect(session.status).toBe(expected.status);
        expect(session.items).toEqual(expected.items);
        expect(session.totals).toEqual(computeTotals(expected.items));
    }

    const actualCompletionCounts = new Map();
    for (const payload of completionLog) {
        actualCompletionCounts.set(
            payload.checkoutId,
            (actualCompletionCounts.get(payload.checkoutId) || 0) + 1
        );
    }

    expect([...actualCompletionCounts.entries()].sort()).toEqual(
        [...model.completionCounts.entries()].sort()
    );

    const queuedCheckoutIds = [...model.sessions.values()]
        .filter((session) => session.status === 'queued')
        .map((session) => session.id)
        .sort();
    const queuedCallIds = syncQueue.enqueue.mock.calls
        .map(([entry]) => entry.payload.checkoutId)
        .sort();
    expect(queuedCallIds).toEqual(queuedCheckoutIds);
}

class StartCommand {
    constructor(checkoutId, items) {
        this.checkoutId = checkoutId;
        this.items = items;
    }

    toString() {
        return `start(${this.checkoutId})`;
    }

    check(m) {
        return !m.sessions.has(this.checkoutId);
    }

    async run(m, r) {
        const returnedId = r.service.startSession({
            checkoutId: this.checkoutId,
            items: this.items
        });

        expect(returnedId).toBe(this.checkoutId);
        m.sessions.set(this.checkoutId, {
            id: this.checkoutId,
            items: this.items,
            status: 'idle'
        });

        assertCheckoutState(m, r);
    }
}

class SubmitDirectCommand {
    constructor(checkoutId) {
        this.checkoutId = checkoutId;
    }

    toString() {
        return `submitDirect(${this.checkoutId})`;
    }

    check(m) {
        return m.sessions.get(this.checkoutId)?.status === 'idle';
    }

    async run(m, r) {
        const result = await r.service.submit({
            checkoutId: this.checkoutId,
            strategy: 'direct'
        });

        expect(result.success).toBe(true);
        expect(result.orderId).toBe(`${this.checkoutId}-order`);

        const session = m.sessions.get(this.checkoutId);
        session.status = 'completed';
        m.completionCounts.set(this.checkoutId, (m.completionCounts.get(this.checkoutId) || 0) + 1);

        await Promise.resolve();
        assertCheckoutState(m, r);
    }
}

class SubmitQueueCommand {
    constructor(checkoutId) {
        this.checkoutId = checkoutId;
    }

    toString() {
        return `submitQueue(${this.checkoutId})`;
    }

    check(m) {
        return m.sessions.get(this.checkoutId)?.status === 'idle';
    }

    async run(m, r) {
        const result = await r.service.submit({
            checkoutId: this.checkoutId,
            strategy: 'queue'
        });

        expect(result.success).toBe(true);
        expect(result.queued).toBe(true);

        const session = m.sessions.get(this.checkoutId);
        session.status = 'queued';

        await Promise.resolve();
        assertCheckoutState(m, r);
    }
}

class ResetCommand {
    constructor(checkoutId) {
        this.checkoutId = checkoutId;
    }

    toString() {
        return `reset(${this.checkoutId})`;
    }

    check(m) {
        return m.sessions.has(this.checkoutId);
    }

    async run(m, r) {
        r.service.reset({ checkoutId: this.checkoutId });
        m.sessions.delete(this.checkoutId);
        m.completionCounts.delete(this.checkoutId);

        await Promise.resolve();
        assertCheckoutState(m, r);
    }
}

describe('CheckoutService property tests', () => {
    let commandArbitraries;

    beforeEach(() => {
        const itemArbitrary = fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            price: fc.integer({ min: 0, max: 5000 }),
            quantity: fc.integer({ min: 1, max: 5 })
        });

        commandArbitraries = [
            fc
                .record({
                    checkoutId: fc.uuid(),
                    items: fc.array(itemArbitrary, { minLength: 1, maxLength: 5 })
                })
                .map(({ checkoutId, items }) => new StartCommand(checkoutId, items)),
            fc.uuid().map((checkoutId) => new SubmitDirectCommand(checkoutId)),
            fc.uuid().map((checkoutId) => new SubmitQueueCommand(checkoutId)),
            fc.uuid().map((checkoutId) => new ResetCommand(checkoutId))
        ];
    });

    it('maintains totals and lifecycle invariants across generated checkout workflows', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.commands(commandArbitraries, { maxCommands: 30 }),
                async (commands) => {
                    await fc.asyncModelRun(() => createCheckoutHarness(), commands);
                }
            ),
            {
                seed: CHECKOUT_SEED,
                numRuns: CHECKOUT_RUNS,
                endOnFailure: true
            }
        );
    });
});
