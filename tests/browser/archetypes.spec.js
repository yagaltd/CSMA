import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('Data Grid Archetype', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/demo/archetypes-demo.html`);
    await page.waitForSelector('.csma-datagrid');
    // Wait for all grids to render
    await page.waitForSelector('.csma-datagrid__row');
  });

  // ─── Rendering ──────────────────────────────────────

  test('renders rows and columns', async ({ page }) => {
    const rows = page.locator('#grid-container .csma-datagrid__row');
    await expect(rows.first()).toBeVisible();

    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Header cells should be present
    const headerCells = page.locator('#grid-container .csma-datagrid__header-cell');
    await expect(headerCells.first()).toBeVisible();
    expect(await headerCells.count()).toBe(3); // name, age, role
  });

  test('renders correct column labels', async ({ page }) => {
    const headers = page.locator('#grid-container .csma-datagrid__header-cell');
    const labels = await headers.allTextContents();
    expect(labels[0]).toContain('Name');
    expect(labels[1]).toContain('Age');
    expect(labels[2]).toContain('Role');
  });

  test('rows have correct role attributes', async ({ page }) => {
    const root = page.locator('#grid-container .csma-datagrid');
    await expect(root).toHaveAttribute('role', 'grid');

    const firstRow = page.locator('#grid-container .csma-datagrid__row').first();
    await expect(firstRow).toHaveAttribute('role', 'row');
  });

  // ─── Sorting ─────────────────────────────────────────

  test('clicking sort button sorts by name ascending', async ({ page }) => {
    await page.click('#dg-sort-name');

    // First visible cell after sort should be "Alice"
    const firstCell = page.locator('#grid-container .csma-datagrid__row').first()
      .locator('.csma-datagrid__cell').first();
    await expect(firstCell).toContainText('Alice');
  });

  test('sort sets correct aria-sort attribute', async ({ page }) => {
    await page.click('#dg-sort-name');

    const nameHeader = page.locator('#grid-container .csma-datagrid__header-cell').first();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    // Click the column header directly to toggle
    await nameHeader.click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  });

  test('sort by age descending puts oldest first', async ({ page }) => {
    await page.click('#dg-sort-age');

    // Hank is 45, should be first
    const firstCell = page.locator('#grid-container .csma-datagrid__row').first()
      .locator('.csma-datagrid__cell').first();
    await expect(firstCell).toContainText('Hank');
  });

  // ─── States ──────────────────────────────────────────

  test('loading state sets data-state="loading"', async ({ page }) => {
    await page.click('#dg-loading');

    const grid = page.locator('#grid-container .csma-datagrid');
    await expect(grid).toHaveAttribute('data-state', 'loading');

    // Loading state element should be attached to the DOM
    const loadingState = grid.locator('.csma-datagrid__state[data-state="loading"]');
    await expect(loadingState).toBeAttached();
  });

  test('empty state shows empty message', async ({ page }) => {
    await page.click('#dg-empty');

    const grid = page.locator('#grid-container .csma-datagrid');
    await expect(grid).toHaveAttribute('data-state', 'empty');

    const emptyMsg = grid.locator('.csma-datagrid__state[data-state="empty"]');
    await expect(emptyMsg).toBeVisible();
  });

  test('error state shows error message with retry button', async ({ page }) => {
    await page.click('#dg-error');

    const grid = page.locator('#grid-container .csma-datagrid');
    await expect(grid).toHaveAttribute('data-state', 'error');

    const retryBtn = grid.locator('.csma-datagrid__state-retry');
    await expect(retryBtn).toBeVisible();
    await expect(retryBtn).toHaveText('Retry');
  });

  // ─── Update ──────────────────────────────────────────

  test('update replaces rows with new data', async ({ page }) => {
    await page.click('#dg-update');

    const firstCell = page.locator('#grid-container .csma-datagrid__row').first()
      .locator('.csma-datagrid__cell').first();
    await expect(firstCell).toContainText('New Alice');

    const rows = page.locator('#grid-container .csma-datagrid__row');
    expect(await rows.count()).toBe(2);
  });

  // ─── Selection ───────────────────────────────────────

  test('selectable grid shows checkboxes', async ({ page }) => {
    const checkboxes = page.locator('#grid-selectable-container .csma-datagrid__checkbox');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking checkbox selects row and logs selection', async ({ page }) => {
    const checkbox = page.locator('#grid-selectable-container .csma-datagrid__checkbox').first();
    await checkbox.check();

    // Row should have aria-selected
    const row = page.locator('#grid-selectable-container .csma-datagrid__row').first();
    await expect(row).toHaveAttribute('aria-selected', 'true');

    // Log should show selection
    const log = page.locator('#grid-selectable-log');
    await expect(log).not.toBeEmpty();
  });

  test('multi-select allows selecting multiple rows', async ({ page }) => {
    // Use the public API to select rows programmatically (avoids pointer-event layout issues)
    await page.evaluate(() => {
      window.__gridSel.setSelected([1, 2]);
    });

    const selected = page.locator('#grid-selectable-container .csma-datagrid__row[aria-selected="true"]');
    expect(await selected.count()).toBe(2);
  });

  // ─── Keyboard Navigation ─────────────────────────────

  test('Home key scrolls to first row', async ({ page }) => {
    const grid = page.locator('#grid-container .csma-datagrid');
    await grid.focus();
    await grid.press('End');
    await page.waitForTimeout(100);

    // Press Home to go back to first
    await grid.press('Home');
    await page.waitForTimeout(100);

    // First row should be visible
    const firstRow = page.locator('#grid-container .csma-datagrid__row').first();
    await expect(firstRow).toBeVisible();
  });

  // ─── Resize Handles ──────────────────────────────────

  test('resizable grid shows resize handles', async ({ page }) => {
    const handles = page.locator('#grid-container .csma-datagrid__resize-handle');
    const count = await handles.count();
    expect(count).toBeGreaterThan(0);
  });

  // ─── Cleanup ─────────────────────────────────────────

  test('destroy removes grid from DOM', async ({ page }) => {
    await page.evaluate(() => {
      window.__grid.destroy();
    });

    const grid = page.locator('#grid-container .csma-datagrid');
    await expect(grid).toHaveCount(0);
  });
});

test.describe('Viewer Archetype', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/demo/archetypes-demo.html`);
    await page.waitForSelector('.csma-viewer');
  });

  // ─── Markdown Rendering ──────────────────────────────

  test('renders markdown headings', async ({ page }) => {
    const content = page.locator('#viewer-container .csma-viewer__content');

    const h1 = content.locator('h1');
    await expect(h1).toHaveText('Hello World');

    const h2 = content.locator('h2');
    await expect(h2.first()).toHaveText('Features');
  });

  test('renders markdown bold and italic', async ({ page }) => {
    const content = page.locator('#viewer-container .csma-viewer__content');

    const strong = content.locator('strong');
    await expect(strong.first()).toHaveText('markdown');

    const em = content.locator('em');
    await expect(em.first()).toHaveText('italic');
  });

  test('renders markdown inline code', async ({ page }) => {
    const content = page.locator('#viewer-container .csma-viewer__content');
    const code = content.locator('code').filter({ hasText: 'inline code' });
    await expect(code.first()).toHaveText('inline code');
  });

  test('renders markdown links', async ({ page }) => {
    const content = page.locator('#viewer-container .csma-viewer__content');
    const link = content.locator('a');
    await expect(link.first()).toHaveAttribute('href', 'https://example.com');
  });

  test('renders markdown blockquotes', async ({ page }) => {
    const content = page.locator('#viewer-container .csma-viewer__content');
    const blockquote = content.locator('blockquote');
    await expect(blockquote.first()).toBeVisible();
  });

  test('renders markdown code blocks', async ({ page }) => {
    const content = page.locator('#viewer-container .csma-viewer__content');
    const pre = content.locator('pre');
    await expect(pre.first()).toBeVisible();
    const preCode = pre.locator('code');
    await expect(preCode.first()).toContainText("console.log('hello')");
  });

  // ─── States ──────────────────────────────────────────

  test('loading state shows loading overlay', async ({ page }) => {
    await page.click('#vw-loading');

    const viewer = page.locator('#viewer-container .csma-viewer');
    await expect(viewer).toHaveAttribute('data-state', 'loading');

    // Loading state element should be attached to the DOM
    const loadingState = viewer.locator('.csma-viewer__state[data-state="loading"]');
    await expect(loadingState).toBeAttached();
  });

  test('empty state shows empty message', async ({ page }) => {
    await page.click('#vw-empty');

    const viewer = page.locator('#viewer-container .csma-viewer');
    await expect(viewer).toHaveAttribute('data-state', 'empty');

    const emptyMsg = viewer.locator('.csma-viewer__state[data-state="empty"]');
    await expect(emptyMsg).toBeVisible();
    await expect(emptyMsg).toContainText('No content to display');
  });

  test('error state shows error with retry', async ({ page }) => {
    await page.click('#vw-error');

    const viewer = page.locator('#viewer-container .csma-viewer');
    await expect(viewer).toHaveAttribute('data-state', 'error');

    const retryBtn = viewer.locator('.csma-viewer__state-retry');
    await expect(retryBtn).toBeVisible();
  });

  // ─── Update Content ──────────────────────────────────

  test('update replaces markdown content', async ({ page }) => {
    await page.click('#vw-update-md');

    const content = page.locator('#viewer-container .csma-viewer__content');
    const h2 = content.locator('h2');
    await expect(h2).toHaveText('Updated');
  });

  test('update renders HTML from API shape', async ({ page }) => {
    await page.click('#vw-update-html');

    const content = page.locator('#viewer-container .csma-viewer__content');
    const h2 = content.locator('h2');
    await expect(h2).toHaveText('HTML Content');
  });

  // ─── Plain Text Viewer ───────────────────────────────

  test('plain text viewer renders text content', async ({ page }) => {
    const content = page.locator('#viewer-plain-container .csma-viewer__content');
    await expect(content).toContainText('Plain text content. No markdown rendering applied.');
  });

  // ─── Cleanup ─────────────────────────────────────────

  test('destroy removes viewer from DOM', async ({ page }) => {
    await page.evaluate(() => {
      window.__viewerPlain.destroy();
    });

    const viewer = page.locator('#viewer-plain-container .csma-viewer');
    await expect(viewer).toHaveCount(0);
  });
});
