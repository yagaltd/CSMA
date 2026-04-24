import { test, expect } from '@playwright/test';

test('registers /sw.js and reloads the demo shell offline', async ({ page, context }) => {
  await page.goto('/demo/');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Todo App' })).toBeVisible();
  await expect(page.locator('[data-todo-app]')).toBeVisible();

  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker?.ready;
    return Boolean(registration?.active);
  });

  const serviceWorkerUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL || null;
  });

  expect(serviceWorkerUrl).toContain('/sw.js');

  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Todo App' })).toBeVisible();
  await expect(page.locator('[data-todo-app]')).toBeVisible();

  await context.setOffline(false);
});
