import { test, expect } from '@playwright/test';

async function preparePage(page, theme) {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('csma-theme', selectedTheme);
    document.documentElement.dataset.theme = selectedTheme;
  }, theme);

  await page.setViewportSize({ width: 1440, height: 1400 });
}

test.describe('UI preview visual baselines', () => {
  test('component summary matches light baseline', async ({ page }) => {
    await preparePage(page, 'light');
    await page.goto('/examples/ui-preview/component-summary.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toHaveScreenshot('component-summary-light.png', {
      animations: 'disabled',
      caret: 'hide'
    });
  });

  test('component summary matches dark baseline', async ({ page }) => {
    await preparePage(page, 'dark');
    await page.goto('/examples/ui-preview/component-summary.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toHaveScreenshot('component-summary-dark.png', {
      animations: 'disabled',
      caret: 'hide'
    });
  });

  test('auth shell preview matches light baseline', async ({ page }) => {
    await preparePage(page, 'light');
    await page.goto('/examples/ui-preview/login-form-preview.html');
    await page.waitForSelector('#auth-shell-preview .card');
    await expect(page.locator('main')).toHaveScreenshot('auth-shell-preview-light.png', {
      animations: 'disabled',
      caret: 'hide'
    });
  });

  test('auth shell preview matches dark baseline', async ({ page }) => {
    await preparePage(page, 'dark');
    await page.goto('/examples/ui-preview/login-form-preview.html');
    await page.waitForSelector('#auth-shell-preview .card');
    await expect(page.locator('main')).toHaveScreenshot('auth-shell-preview-dark.png', {
      animations: 'disabled',
      caret: 'hide'
    });
  });
});
