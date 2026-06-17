import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { createRuntimeState, syncWindowRuntime } from '../src/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../src/runtime/features.js';
import { CartService } from '../src/modules/cart/index.js';
import { PaymentAdaptersService } from '../src/modules/payment-adapters/index.js';
import { ReviewsService } from '../src/modules/reviews/index.js';
import { AbTestingService } from '../src/modules/ab-testing/index.js';

function bus() { const eventBus = new EventBus(); eventBus.contracts = Contracts; return eventBus; }

describe('wave 2 frontend modules', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('cart manages local optimistic cart state and rejects invalid payload keys', async () => {
    const eventBus = bus();
    const service = new CartService(eventBus);
    service.init({ currency: 'EUR' });

    await eventBus.publish('INTENT_CART_ADD_ITEM', { item: { id: 'sku-1', title: 'Bag', price: 20, quantity: 2 }, timestamp: Date.now() });

    expect(service.getSummary()).toMatchObject({ count: 2, subtotal: 40, currency: 'EUR' });
    const invalidResult = await eventBus.publish('INTENT_CART_ADD_ITEM', { item: { id: 'sku-2' }, extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
    await eventBus.publish('INTENT_CART_CLEAR', { timestamp: Date.now() });
    expect(service.getItems()).toHaveLength(1);
  });

  it('payment-adapters registers client adapters without owning authoritative confirmation', async () => {
    const eventBus = bus();
    const service = new PaymentAdaptersService(eventBus);
    service.init({ adapters: [{ id: 'stripe', label: 'Stripe', capabilities: ['redirect'] }] });

    const flow = await service.startFlow('stripe', { amount: 1200, currency: 'USD', clientSecret: 'not-stored' });

    expect(flow).toMatchObject({ adapterId: 'stripe', status: 'started', clientSecretPresent: true });
    expect(flow.clientSecret).toBeUndefined();
    const invalidResult = await eventBus.publish('INTENT_PAYMENT_FLOW_START', { id: 'stripe', extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('reviews keeps optimistic review state and summaries client-side', async () => {
    const eventBus = bus();
    const service = new ReviewsService(eventBus);
    service.init({ reviews: [{ id: 'r1', targetId: 'p1', rating: 5 }] });

    service.submit({ targetId: 'p1', rating: 3, body: 'Pending' });

    expect(service.getSummary('p1')).toMatchObject({ count: 2, average: 4 });
    const invalidResult = await eventBus.publish('INTENT_REVIEW_SUBMIT', { item: { targetId: 'p1' }, extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('ab-testing creates deterministic local fallback assignments and exposure events', async () => {
    const eventBus = bus();
    const service = new AbTestingService(eventBus);
    service.init({ seed: 'test', experiments: { hero: { variants: ['a', 'b'] } } });

    const first = service.assign('hero', { userId: 'u1' });
    const second = service.assign('hero', { userId: 'u1' });
    const exposure = service.expose('hero');

    expect(second).toEqual(first);
    expect(exposure.experimentId).toBe('hero');
    const invalidResult = await eventBus.publish('INTENT_AB_TEST_ASSIGN', { key: 'hero', extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('loads wave 2 modules only behind explicit feature flags', async () => {
    const state = createRuntimeState();
    syncWindowRuntime(state, { securityPolicy: { profile: 'development', globals: { exposeInternals: true } } });

    await loadOptionalFeatures(state, {
      FEATURES: { CART_MODULE: true, PAYMENT_ADAPTERS: true, REVIEWS_MODULE: true, AB_TESTING: true },
      runtimeConfig: {
        securityProfile: 'development',
        cart: { currency: 'USD' },
        paymentAdapters: { adapters: [{ id: 'demo-pay' }] },
        abTesting: { experiments: { banner: { variants: ['control', 'alt'] } } }
      }
    });

    expect(state.moduleManager.isModuleLoaded('cart')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('payment-adapters')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('reviews')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('ab-testing')).toBe(true);
    expect(window.csma.paymentAdapters.adapters.has('demo-pay')).toBe(true);

    await state.moduleManager.destroy();
  });
});
