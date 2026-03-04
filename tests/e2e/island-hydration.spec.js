import { test, expect } from '@playwright/test';

test.describe('Island hydration', () => {
  test('hydration occurs after island enters viewport', async ({ page }) => {
    page.on('console', (msg) => console.log(`[browser] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => console.error('[browser] pageerror:', err.message));

    await page.goto('/pages/test/hydration.html');

    await page.waitForFunction(() => window.csma?.staticRender?.initialized === true);

    const island = page.locator('[data-island="hydration-test"]');
    await expect(island).not.toHaveAttribute('data-hydrated', 'true');

    await island.scrollIntoViewIfNeeded();

    await page.waitForFunction(() => {
      const node = document.querySelector('[data-island="hydration-test"]');
      return node?.dataset.hydrated === 'true';
    });

    await expect(island).toHaveAttribute('data-hydrated', 'true');
  });

  test('island rehydrates after backend invalidation', async ({ page, request }) => {
    await page.goto('/pages/products/index.html');
    await page.waitForFunction(() => window.csma?.staticRender?.initialized === true);
    await page.waitForFunction(() => Boolean(window.csma?.eventBus));
    await page.waitForFunction(() => Boolean(window.csma?.optimisticTransport?.eventSource));
    expect(await page.evaluate(() => window.serviceManager?.eventBus === window.csma.eventBus)).toBeTruthy();

    await page.evaluate(() => {
      window.__islandInvalidations = 0;
      window.__rawInvalidateEvents = 0;
      window.__islandPublishCount = 0;
      if (!window.__patchedIslandPublish) {
        const originalPublish = window.csma.eventBus.publish.bind(window.csma.eventBus);
        window.csma.eventBus.publish = (name, payload) => {
          if (name === 'ISLAND_INVALIDATED') {
            window.__islandPublishCount += 1;
          }
          return originalPublish(name, payload);
        };
        window.__patchedIslandPublish = true;
      }
      window.csma.optimisticTransport.eventSource.addEventListener('island.invalidate', () => {
        window.__rawInvalidateEvents += 1;
      });
      window.csma.eventBus.subscribe('ISLAND_INVALIDATED', () => {
        window.__islandInvalidations += 1;
      });
    });

    // sanity-check subscription wiring
    await page.evaluate(() => {
      window.csma.eventBus.publishSync('ISLAND_INVALIDATED', {
        islandId: 'product-inventory',
        parameters: {},
        timestamp: Date.now()
      });
    });
    const sanityCount = await page.evaluate(() => window.__islandInvalidations);
    expect(sanityCount).toBeGreaterThan(0);
    await page.evaluate(() => {
      window.__islandInvalidations = 0;
    });

    const firstIsland = page.locator('[data-island="product-inventory"][data-product-id="SKU-001"]').first();
    await firstIsland.scrollIntoViewIfNeeded();

    await page.waitForFunction((selector) => {
      const node = document.querySelector(selector);
      return node?.dataset.hydrated === 'true' && Boolean(node.dataset.hydratedAt);
    }, '[data-island="product-inventory"][data-product-id="SKU-001"]');

    const initialHydratedAt = await firstIsland.getAttribute('data-hydrated-at');

    const response = await request.post('http://127.0.0.1:5050/islands/inventory/SKU-001', {
      data: { quantity: Math.floor(Math.random() * 100), reason: 'e2e-test' }
    });
    if (!response.ok()) {
      throw new Error(`Inventory update failed: ${response.status()} ${await response.text()}`);
    }

    await page.waitForFunction(() => window.__rawInvalidateEvents > 0);
    await page.waitForFunction(() => window.__islandPublishCount > 0);
    await page.waitForFunction(() => window.__islandInvalidations > 0);
    await expect.poll(async () => firstIsland.getAttribute('data-hydrated-at'), { timeout: 10_000 }).not.toBe(initialHydratedAt);
  });

  test('product detail pipeline hydrates via static shell and invalidation loop', async ({ page, request }) => {
    await page.goto('/pages/products/detail.html');
    await page.waitForFunction(() => window.csma?.staticRender?.initialized === true);
    await page.waitForFunction(() => Boolean(window.csma?.optimisticTransport?.eventSource));

    await page.evaluate(() => {
      window.__detailInvalidateEvents = 0;
      window.__detailHydrations = 0;
      window.csma.optimisticTransport.eventSource.addEventListener('island.invalidate', () => {
        window.__detailInvalidateEvents += 1;
      });
      window.csma.eventBus.subscribe('ISLAND_INVALIDATED', () => {
        window.__detailHydrations += 1;
      });
    });

    const inventoryIsland = page.locator('[data-island="product-inventory"][data-product-id="SKU-001"]').first();
    await page.waitForFunction((selector) => {
      const node = document.querySelector(selector);
      return node?.dataset.hydrated === 'true' && Boolean(node.dataset.hydratedAt);
    }, '[data-island="product-inventory"][data-product-id="SKU-001"]');

    const initialStamp = await inventoryIsland.getAttribute('data-hydrated-at');
    const mutate = await request.post('http://127.0.0.1:5050/islands/inventory/SKU-001', {
      data: { quantity: Math.floor(Math.random() * 100), reason: 'detail-e2e' }
    });
    if (!mutate.ok()) {
      throw new Error(`Inventory mutation failed: ${mutate.status()} ${await mutate.text()}`);
    }

    await page.waitForFunction(() => window.__detailInvalidateEvents > 0);
    await page.waitForFunction(() => window.__detailHydrations > 0);
    await expect.poll(async () => inventoryIsland.getAttribute('data-hydrated-at'), { timeout: 10_000 }).not.toBe(initialStamp);
  });
});
