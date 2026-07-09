import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { createRuntimeState, syncWindowRuntime } from '../src/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../src/runtime/features.js';
import { FeatureFlagsService } from '../src/modules/feature-flags/index.js';
import { ContentPrefetchService } from '../src/modules/content-prefetch/index.js';
import { CmsContentService } from '../src/modules/cms-content/index.js';
import { CatalogService } from '../src/modules/catalog/index.js';
import { FeatureFlagsContracts } from '../src/modules/feature-flags/contracts/feature-flags-contracts.js';
import { ContentPrefetchContracts } from '../src/modules/content-prefetch/contracts/content-prefetch-contracts.js';
import { CmsContentContracts } from '../src/modules/cms-content/contracts/cms-content-contracts.js';
import { CatalogContracts } from '../src/modules/catalog/contracts/catalog-contracts.js';

function bus(...moduleContracts) {
  const eventBus = new EventBus();
  eventBus.contracts = Object.assign({}, Contracts, ...moduleContracts);
  return eventBus;
}

describe('wave 1 frontend modules', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('feature-flags manages explicit client flags and validates contracts', async () => {
    const eventBus = bus(FeatureFlagsContracts);
    const service = new FeatureFlagsService(eventBus);
    const changes = [];
    eventBus.subscribe('FEATURE_FLAG_CHANGED', (payload) => changes.push(payload));
    service.init({ defaults: { beta: false } });

    expect(service.isEnabled('beta')).toBe(false);
    await eventBus.publish('INTENT_FEATURE_FLAG_SET', { key: 'beta', enabled: true, timestamp: Date.now() });

    expect(service.isEnabled('beta')).toBe(true);
    expect(changes[0].key).toBe('beta');
    const invalidResult = await eventBus.publish('INTENT_FEATURE_FLAG_SET', { key: 'bad', enabled: true, extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);

    service.destroy();
    await eventBus.publish('INTENT_FEATURE_FLAG_SET', { key: 'beta', enabled: false, timestamp: Date.now() });
    expect(service.isEnabled('beta')).toBe(true);
  });

  it('content-prefetch loads manifests and caches route resources', async () => {
    const eventBus = bus(ContentPrefetchContracts);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ title: 'Home' }) });
    const service = new ContentPrefetchService(eventBus);
    service.init({ manifest: { '/': '/content/home.json' }, fetcher });

    const data = await service.prefetchRoute('/');

    expect(fetcher).toHaveBeenCalledWith('/content/home.json', { credentials: 'same-origin' });
    expect(data.title).toBe('Home');
    expect(service.get('/').title).toBe('Home');
    const invalidResult = await eventBus.publish('INTENT_CONTENT_PREFETCH_ROUTE', { route: '/', extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('cms-content normalizes structured documents without rendering unsafe HTML', async () => {
    const eventBus = bus(CmsContentContracts);
    const service = new CmsContentService(eventBus);
    service.init({ documents: [{ id: 'home', title: 'Home', blocks: [{ type: 'hero', text: 'Hi' }] }] });

    const doc = await service.load('home');

    expect(doc).toMatchObject({ id: 'home', type: 'page', title: 'Home' });
    expect(doc.blocks).toHaveLength(1);
    const invalidResult = await eventBus.publish('INTENT_CMS_CONTENT_LOAD', { id: 'home', extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('catalog tracks items, facets, filters, and selection client-side only', async () => {
    const eventBus = bus(CatalogContracts);
    const service = new CatalogService(eventBus);
    service.init({ items: [
      { id: 'p1', title: 'Bag', type: 'product', categories: ['bags'], availability: 'in-stock' },
      { id: 'p2', title: 'Hat', type: 'product', categories: ['hats'], availability: 'sold-out' }
    ] });

    service.setFilters({ availability: 'in-stock' });
    expect(service.getFilteredItems().map((item) => item.id)).toEqual(['p1']);
    expect(service.selectItem('p1').title).toBe('Bag');
    expect(service.facets.categories).toContain('bags');
    const invalidResult = await eventBus.publish('INTENT_CATALOG_FILTER', { filters: {}, extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('loads wave 1 modules only behind explicit feature flags', async () => {
    const state = createRuntimeState();
    syncWindowRuntime(state, { securityPolicy: { profile: 'development', globals: { exposeInternals: true } } });

    await loadOptionalFeatures(state, {
      FEATURES: {
        FEATURE_FLAGS: true,
        CONTENT_PREFETCH: true,
        CMS_CONTENT: true,
        CATALOG_MODULE: true
      },
      runtimeConfig: {
        securityProfile: 'development',
        featureFlags: { defaults: { preview: true } },
        catalog: { items: [{ id: 'sku-1', title: 'Item' }] }
      }
    });

    expect(state.moduleManager.isModuleLoaded('feature-flags')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('content-prefetch')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('cms-content')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('catalog')).toBe(true);
    expect(window.csma.featureFlags.isEnabled('preview')).toBe(true);
    expect(window.csma.catalog.items).toHaveLength(1);

    await state.moduleManager.destroy();
  });
});
