import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { CheckoutService } from '../src/modules/checkout/services/CheckoutService.js';

describe('CheckoutService', () => {
    let eventBus;
    let formService;
    let syncQueue;
    let service;
    let completions;

    beforeEach(() => {
        eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        completions = [];
        eventBus.subscribe('CHECKOUT_COMPLETED', (payload) => completions.push(payload));

        formService = {
            registerForm: vi.fn(),
            getFormState: vi.fn(() => ({ values: { email: 'ada@example.com', name: 'Ada', address: '42 Loop', paymentMethod: 'card' } })),
            resetForm: vi.fn()
        };

        syncQueue = { enqueue: vi.fn() };

        service = new CheckoutService(eventBus, { formService, syncQueue });
        service.init({ formService, syncQueueService: syncQueue });
    });

    it('calculates totals and processes direct submission', async () => {
        const checkoutId = service.startSession({
            checkoutId: 'chk-1',
            items: [{ id: 'p1', name: 'Item', price: 20, quantity: 2 }]
        });

        await service.submit({ checkoutId });
        expect(completions).toHaveLength(1);
        expect(completions[0].checkoutId).toBe(checkoutId);
    });

    it('enqueues checkout when strategy is queue', async () => {
        service.startSession({ checkoutId: 'chk-2', items: [] });
        await service.submit({ checkoutId: 'chk-2', strategy: 'queue' });
        expect(syncQueue.enqueue).toHaveBeenCalledOnce();
    });

    it('signs checkout payloads when no authenticated session exists', async () => {
        const authService = { isAuthenticated: vi.fn(() => false) };
        const integrityEnvelope = { intent: 'CHECKOUT_SUBMIT_CHK', nonce: 'abc', signature: 'sig', timestamp: Date.now(), expiresAt: Date.now() + 1000 };
        const hmacService = { signPayload: vi.fn().mockResolvedValue(integrityEnvelope) };

        service = new CheckoutService(eventBus, { formService, syncQueue, authService, hmacService });
        service.init({ formService, syncQueueService: syncQueue, authService, hmacService });

        service.startSession({ checkoutId: 'chk-3', items: [] });
        const result = await service.submit({ checkoutId: 'chk-3' });

        expect(result.integrity).toEqual(integrityEnvelope);
        expect(hmacService.signPayload).toHaveBeenCalled();
    });
});
