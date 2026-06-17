import { describe, it, expect, vi } from 'vitest';
import { createRuntimeState, syncWindowRuntime } from '../src/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../src/runtime/features.js';
import { CartService } from '../src/modules/cart/index.js';
import { FeatureFlagsService } from '../src/modules/feature-flags/index.js';
import { EdgeSearchService } from '../src/modules/edge-search/index.js';
import { PaymentAdaptersService } from '../src/modules/payment-adapters/index.js';

describe('standard SSMA/gateway seams for vertical modules', () => {
  it('resolves default companion endpoints through runtimeConfig.ssma.baseUrl', async () => {
    const state = createRuntimeState();
    syncWindowRuntime(state, { securityPolicy: { profile: 'development', globals: { exposeInternals: true } } });

    await loadOptionalFeatures(state, {
      FEATURES: {
        FEATURE_FLAGS: true,
        CONTENT_PREFETCH: true,
        CMS_CONTENT: true,
        CATALOG_MODULE: true,
        CART_MODULE: true,
        PAYMENT_ADAPTERS: true,
        REVIEWS_MODULE: true,
        AB_TESTING: true,
        PERMISSIONS_UI: true,
        CHARTS_MODULE: true,
        ADMIN_AUDIT_LOG: true,
        IMPORT_EXPORT: true,
        COMMENTS_MODULE: true,
        CONTENT_WORKFLOW: true,
        EDGE_SEARCH: true
      },
      runtimeConfig: {
        securityProfile: 'development',
        ssma: { baseUrl: 'https://api.example.test' }
      }
    });

    expect(window.csma.featureFlags.endpoint).toBe('https://api.example.test/flags/client-config');
    expect(window.csma.contentPrefetch.endpoint).toBe('https://api.example.test/content/manifest');
    expect(window.csma.cmsContent.endpoint).toBe('https://api.example.test/content');
    expect(window.csma.catalog.endpoint).toBe('https://api.example.test/catalog/items');
    expect(window.csma.cart.validateEndpoint).toBe('https://api.example.test/cart/validate');
    expect(window.csma.paymentAdapters.sessionEndpoint).toBe('https://api.example.test/checkout/session');
    expect(window.csma.reviews.endpoint).toBe('https://api.example.test/reviews');
    expect(window.csma.abTesting.assignEndpoint).toBe('https://api.example.test/experiments/assign');
    expect(window.csma.permissionsUI.endpoint).toBe('https://api.example.test/permissions/effective');
    expect(window.csma.charts.endpoint).toBe('https://api.example.test/metrics/query');
    expect(window.csma.adminAuditLog.endpoint).toBe('https://api.example.test/admin/audit-log');
    expect(window.csma.importExport.previewEndpoint).toBe('https://api.example.test/imports/preview');
    expect(window.csma.comments.endpoint).toBe('https://api.example.test/comments');
    expect(window.csma.contentWorkflow.endpoint).toBe('https://api.example.test/workflow/items');
    expect(window.csma.edgeSearch.endpoint).toBe('https://api.example.test/search');

    await state.moduleManager.destroy();
  });

  it('keeps local mode when no SSMA baseUrl or explicit endpoint is configured', async () => {
    const state = createRuntimeState();
    syncWindowRuntime(state, { securityPolicy: { profile: 'development', globals: { exposeInternals: true } } });

    await loadOptionalFeatures(state, {
      FEATURES: { FEATURE_FLAGS: true, CART_MODULE: true, EDGE_SEARCH: true },
      runtimeConfig: { securityProfile: 'development' }
    });

    expect(window.csma.featureFlags.endpoint).toBeNull();
    expect(window.csma.cart.validateEndpoint).toBeNull();
    expect(window.csma.edgeSearch.endpoint).toBeNull();

    await state.moduleManager.destroy();
  });

  it('uses gateway adapter methods when endpoints are configured', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ flags: { beta: true } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, total: 42 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'session-1', clientSecret: 'redacted-server-value' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'doc-1', title: 'Result' }] }) });

    const flags = new FeatureFlagsService(null);
    flags.init({ endpoint: '/flags/client-config', fetcher });
    await flags.refresh();
    expect(flags.isEnabled('beta')).toBe(true);

    const cart = new CartService(null);
    cart.init({ endpoint: '/cart/validate', fetcher });
    cart.addItem({ id: 'sku-1', price: 21, quantity: 2 });
    await expect(cart.validate()).resolves.toMatchObject({ ok: true, total: 42 });

    const payments = new PaymentAdaptersService(null);
    payments.init({ endpoint: '/checkout/session', fetcher });
    await expect(payments.createSession({ amount: 42 })).resolves.toMatchObject({ id: 'session-1' });

    const search = new EdgeSearchService(null);
    search.init({ endpoint: '/search', fetcher });
    await expect(search.query('result')).resolves.toEqual([{ id: 'doc-1', title: 'Result' }]);

    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
