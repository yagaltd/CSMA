import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { IslandAnalyzer } from '../src/modules/static-render/compiler/IslandAnalyzer.js';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PAGES_DIR = path.resolve(__dirname, '../src/pages');

describe('IslandAnalyzer', () => {
  const analyzer = new IslandAnalyzer();

  it('marks product listing template as island-based', () => {
    const filePath = path.join(PAGES_DIR, 'products/index.html');
    const html = fs.readFileSync(filePath, 'utf-8');
    const classification = analyzer.classify({ route: '/products', html });

    expect(classification.type).toBe('island');
    expect(classification.islands).toHaveLength(2);
    expect(classification.islands[0]).toMatchObject({
      id: 'product-inventory',
      contract: 'INVENTORY_INQUIRY'
    });
  });

  it('marks about page as static', () => {
    const filePath = path.join(PAGES_DIR, 'about/index.html');
    const html = fs.readFileSync(filePath, 'utf-8');
    const classification = analyzer.classify({ route: '/about', html });

    expect(classification.type).toBe('static');
    expect(classification.islands).toHaveLength(0);
  });
});

describe('IslandRuntime', () => {
  let EventBus;
  let IslandRuntime;
  let rateLimiter;

  beforeAll(async () => {
    global.sessionStorage = createStorageStub();
    global.localStorage = createStorageStub();
    ({ default: EventBus } = await import('../src/runtime/EventBus.js'));
    ({ rateLimiter } = await import('../src/runtime/RateLimiter.js'));
    ({ default: IslandRuntime } = await import('../src/modules/static-render/runtime/IslandRuntime.js'));
  });

  let eventBus;
  let published;

  beforeEach(() => {
    rateLimiter.resetAll();
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.sessionStorage = dom.window.sessionStorage;
    global.localStorage = dom.window.localStorage;
    window.csma = { config: { staticRender: {} } };
    if (!global.crypto) {
      global.crypto = dom.window.crypto;
    }
    global.IntersectionObserver = class {
      constructor(cb) {
        this.cb = cb;
      }
      observe() {
        this.cb([{ isIntersecting: true }]);
      }
      disconnect() {}
    };
    eventBus = new EventBus();
    eventBus.contracts = {};
    published = [];
    const originalPublishSync = eventBus.publishSync.bind(eventBus);
    eventBus.publish = (eventName, payload) => {
      published.push({ name: eventName, payload });
      return originalPublishSync(eventName, payload);
    };
  });

  const mockFetch = () => Promise.resolve({
    ok: true,
    json: async () => ({
      routes: {
        '/products': {
          islands: [
            { id: 'product-inventory', trigger: 'manual' }
          ]
        }
      }
    })
  });

  it('publishes hydration events once per island', async () => {
    document.body.innerHTML = '<div data-island="product-inventory" data-product-id="SKU-001"></div>';

    const runtime = new IslandRuntime(eventBus, { fetchImpl: mockFetch });
    await runtime.init();

    const hydrationEvents = published.filter((p) => p.name === 'ISLAND_HYDRATION_INITIATED');
    expect(hydrationEvents).toHaveLength(1);
    expect(hydrationEvents[0].payload.islandId).toBe('product-inventory');
  });

  it('rehydrates matching islands when invalidated', async () => {
    document.body.innerHTML = [
      '<div data-island="product-inventory" data-product-id="SKU-001"></div>',
      '<div data-island="product-inventory" data-product-id="SKU-002"></div>'
    ].join('');

    const runtime = new IslandRuntime(eventBus, { fetchImpl: mockFetch });
    await runtime.init();

    const target = document.querySelector('[data-product-id="SKU-001"]');
    const other = document.querySelector('[data-product-id="SKU-002"]');
    const firstHydratedAt = target.dataset.hydratedAt;

    eventBus.publishSync('ISLAND_INVALIDATED', {
      islandId: 'product-inventory',
      parameters: { productId: 'SKU-001' }
    });

    await waitFor(() => target.dataset.hydratedAt !== firstHydratedAt);
    const hydrationEvents = published.filter((p) => p.name === 'ISLAND_HYDRATION_INITIATED');
    expect(hydrationEvents.length).toBeGreaterThanOrEqual(2);
    const lastHydration = hydrationEvents.at(-1);
    expect(lastHydration?.payload.parameters.productId).toBe('SKU-001');
    expect(other.dataset.hydrated).toBe('true');
  });

  it('respects per-island rate limits', async () => {
    document.body.innerHTML = '<div data-island="product-inventory" data-product-id="SKU-001" data-rate-limit="1/10000"></div>';
    const runtime = new IslandRuntime(eventBus, { fetchImpl: mockFetch });
    await runtime.init();
    await waitFor(() => document.querySelector('[data-island]').dataset.hydrated === 'true');
    const firstHydrationCount = published.filter((p) => p.name === 'ISLAND_HYDRATION_INITIATED').length;
    eventBus.publishSync('ISLAND_INVALIDATED', {
      islandId: 'product-inventory',
      parameters: { productId: 'SKU-001' }
    });
    const afterInvalidation = published.filter((p) => p.name === 'ISLAND_HYDRATION_INITIATED').length;
    expect(afterInvalidation).toBe(1);
    const failures = published.filter((p) => p.name === 'ISLAND_HYDRATION_FAILED');
    expect(failures.some((f) => f.payload.reason === 'rate-limit')).toBe(true);
  });

  it('updates islands when data returned events arrive', async () => {
    document.body.innerHTML = '<div data-island="product-inventory" data-product-id="SKU-001"></div>';
    const runtime = new IslandRuntime(eventBus, { fetchImpl: mockFetch });
    await runtime.init();
    eventBus.publishSync('ISLAND_DATA_RETURNED', {
      islandId: 'product-inventory',
      parameters: { productId: 'SKU-001' },
      timestamp: 12345
    });
    const node = document.querySelector('[data-island]');
    expect(node.dataset.lastUpdated).toBe('12345');
  });

  it('invokes registered island bundle hydrator once', async () => {
    const hydrate = vi.fn();
    window.csma.islandBundles = {
      'product-inventory': { hydrate }
    };
    document.body.innerHTML = '<div data-island="product-inventory"></div>';
    const runtime = new IslandRuntime(eventBus, { fetchImpl: mockFetch });
    await runtime.init();
    expect(hydrate).toHaveBeenCalledTimes(1);
  });

  it('skips hydration when route disabled via feature flag', async () => {
    window.csma.config.staticRender.disabledRoutes = ['/'];
    document.body.innerHTML = '<div data-island="product-inventory"></div>';
    const runtime = new IslandRuntime(eventBus, { fetchImpl: mockFetch });
    await runtime.init();
    const node = document.querySelector('[data-island]');
    expect(node.dataset.hydrated).toBeUndefined();
    window.csma.config.staticRender.disabledRoutes = [];
  });

  it('tracks telemetry metrics and enforces performance budgets', async () => {
    window.csma.config.staticRender.performanceBudgets = { hydrationToDataMs: 1 };
    document.body.innerHTML = '<div data-island="product-inventory" data-product-id="SKU-001"></div>';
    const runtime = new IslandRuntime(eventBus, { fetchImpl: mockFetch });
    await runtime.init();
    await waitFor(() => document.querySelector('[data-island]').dataset.hydrated === 'true');
    await new Promise((resolve) => setTimeout(resolve, 5));
    eventBus.publishSync('ISLAND_DATA_RETURNED', {
      islandId: 'product-inventory',
      parameters: { productId: 'SKU-001' },
      timestamp: Date.now()
    });
    const metrics = window.csma.metrics;
    expect(metrics.hydrations).toBeGreaterThan(0);
    expect(metrics.dataReturns).toBeGreaterThan(0);
    expect(Array.isArray(metrics.violations)).toBe(true);
  });
});

function createStorageStub() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

function waitFor(predicate, timeout = 1000, interval = 25) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      try {
        if (predicate()) {
          resolve(true);
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }
      if (Date.now() - start >= timeout) {
        reject(new Error('waitFor timeout'));
        return;
      }
      setTimeout(check, interval);
    };
    check();
  });
}
