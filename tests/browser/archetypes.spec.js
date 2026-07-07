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

  test('sort toggles aria-sort when clicking column header', async ({ page }) => {
    const nameHeader = page.locator('#grid-container .csma-datagrid__header-cell').first();
    // Initial: none
    await expect(nameHeader).toHaveAttribute('aria-sort', 'none');

    // Click header: ascending
    await nameHeader.click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    // Click again: descending
    await nameHeader.click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');

    // Click again: cleared
    await nameHeader.click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'none');
  });

  test('sort by age descending puts oldest first', async ({ page }) => {
    const ageHeader = page.locator('#grid-container .csma-datagrid__header-cell').nth(1); // Age = 2nd column
    // Click twice for descending
    await ageHeader.click();
    await ageHeader.click();

    // Hank (45) should be first row, first cell (name column)
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
    await expect(preCode.first()).toContainText('hello csma');
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
    await page.waitForTimeout(300);

    const viewer = page.locator('#viewer-container .csma-viewer');
    await expect(viewer).toHaveAttribute('data-state', 'empty');

    const emptyMsg = viewer.locator('.csma-viewer__state[data-state="empty"]');
    await expect(emptyMsg).toBeVisible();
  });

  test('error state shows error with retry', async ({ page }) => {
    // Manually set error state via DOM
    await page.evaluate(() => {
      const v = document.querySelector('#viewer-container .csma-viewer');
      if (v) v.dataset.state = 'error';
    });

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
    await expect(content).toContainText('Plain text content');
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


test.describe('Stats Dashboard Archetype', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/demo/archetypes-demo.html`);
    await page.waitForSelector('.csma-stats');
    await page.waitForTimeout(1500); // wait for fetch
  });

  test('renders stat cards', async ({ page }) => {
    const cards = page.locator('#stats-container .csma-stats__card');
    expect(await cards.count()).toBe(4);
  });

  test('card labels are visible', async ({ page }) => {
    const labels = page.locator('#stats-container .csma-stats__card-label');
    expect(await labels.count()).toBe(4);
    await expect(labels.first()).toContainText('Total Items');
  });

  test('card values populate after fetch', async ({ page }) => {
    const values = page.locator('#stats-container .csma-stats__card-value');
    await expect(values.first()).not.toBeEmpty();
  });

  test('trend indicators render with direction', async ({ page }) => {
    const trends = page.locator('#stats-container .csma-stats__card-trend');
    const count = await trends.count();
    expect(count).toBeGreaterThan(0);

    // At least one should have data-direction
    const first = trends.first();
    const dir = await first.getAttribute('data-direction');
    expect(['up', 'down', 'neutral']).toContain(dir);
  });

  test('error state shows retry button', async ({ page }) => {
    // Manually set error state via DOM
    await page.evaluate(() => {
      const s = document.querySelector('#stats-container .csma-stats');
      if (s) s.dataset.state = 'error';
    });

    const retry = page.locator('#stats-container .csma-stats__state-retry');
    await expect(retry).toBeVisible();
  });

  test('destroy removes dashboard from DOM', async ({ page }) => {
    await page.evaluate(() => window.__stats.destroy());
    const stats = page.locator('#stats-container .csma-stats');
    await expect(stats).toHaveCount(0);
  });
});

test.describe('Editor Builder Archetype', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/demo/archetypes-demo.html`);
    await page.waitForSelector('.csma-editor');
  });

  test('renders fields from definitions', async ({ page }) => {
    const fields = page.locator('#editor-container .csma-editor__field');
    expect(await fields.count()).toBe(5); // name, email, role, bio, notify
  });

  test('text input accepts typing', async ({ page }) => {
    const input = page.locator('#editor-container #field-name');
    await input.fill('Test User');
    await expect(input).toHaveValue('Test User');
  });

  test('select field has options', async ({ page }) => {
    const select = page.locator('#editor-container #field-role');
    const options = await select.locator('option').allTextContents();
    expect(options).toContain('Engineer');
    expect(options).toContain('Designer');
  });

  test('toggle field is clickable', async ({ page }) => {
    const toggle = page.locator('#editor-container .csma-editor__toggle input').first();
    const wasChecked = await toggle.isChecked();
    await toggle.check();
    await expect(toggle).toBeChecked();
  });

  test('pre-fill values populates fields', async ({ page }) => {
    await page.click('#eb-set-values');

    const nameInput = page.locator('#editor-container #field-name');
    await expect(nameInput).toHaveValue('Alice');

    const emailInput = page.locator('#editor-container #field-email');
    await expect(emailInput).toHaveValue('alice@example.com');

    const toggle = page.locator('#editor-container .csma-editor__toggle input').last();
    await expect(toggle).toBeChecked();
  });

  test('validation shows error for required fields', async ({ page }) => {
    // Clear name and try to submit
    const nameInput = page.locator('#editor-container #field-name');
    await nameInput.fill('');

    await page.click('#eb-submit');

    const error = page.locator('#editor-container .csma-editor__error').first();
    await expect(error).toBeVisible();
    await expect(error).toContainText('required');
  });

  test('reset clears form to initial values', async ({ page }) => {
    const nameInput = page.locator('#editor-container #field-name');
    await nameInput.fill('Changed');
    await page.click('#eb-reset');
    await expect(nameInput).toHaveValue('');
  });

  test('destroy removes editor from DOM', async ({ page }) => {
    await page.evaluate(() => window.__editor.destroy());
    const editor = page.locator('#editor-container .csma-editor');
    await expect(editor).toHaveCount(0);
  });
});

test.describe('Config Panel Archetype', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/demo/archetypes-demo.html`);
    await page.waitForSelector('.csma-config');
  });

  test('renders sections', async ({ page }) => {
    const sections = page.locator('#config-container .csma-config__section');
    expect(await sections.count()).toBe(3);
  });

  test('section headers are visible', async ({ page }) => {
    const header = page.locator('#config-container .csma-config__section-header').first();
    await expect(header).toContainText('Appearance');
  });

  test('collapsed section hides body', async ({ page }) => {
    const advSection = page.locator('#config-container .csma-config__section').last();
    await expect(advSection).toHaveAttribute('aria-expanded', 'false');

    const body = advSection.locator('.csma-config__section-body');
    await expect(body).toBeHidden();
  });

  test('click section header toggles expand', async ({ page }) => {
    const advHeader = page.locator('#config-container .csma-config__section-header').last();
    await advHeader.click();

    const advSection = page.locator('#config-container .csma-config__section').last();
    await expect(advSection).toHaveAttribute('aria-expanded', 'true');
  });

  test('slider control renders', async ({ page }) => {
    const slider = page.locator('#config-container .csma-config__slider input[type="range"]');
    await expect(slider.first()).toBeVisible();
  });

  test('toggle control is interactive', async ({ page }) => {
    const toggle = page.locator('#config-container .csma-config__toggle input').first();
    await toggle.check();
    await expect(toggle).toBeChecked();
  });

  test('setValues updates controls', async ({ page }) => {
    await page.click('#cp-set-values');

    // Theme select should be "Dark"
    const themeSelect = page.locator('#config-container .csma-config__select').first();
    await expect(themeSelect).toHaveValue('Dark');

    // Animations toggle should be off
    const animToggle = page.locator('#config-container .csma-config__toggle input').first();
    await expect(animToggle).not.toBeChecked();
  });

  test('getValues returns current state', async ({ page }) => {
    await page.click('#cp-get-values');
    const log = page.locator('#config-log');
    await expect(log).not.toBeEmpty();
  });

  test('destroy removes panel from DOM', async ({ page }) => {
    await page.evaluate(() => window.__config.destroy());
    const panel = page.locator('#config-container .csma-config');
    await expect(panel).toHaveCount(0);
  });
});


test.describe('Media Browser Archetype', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/demo/archetypes-demo.html`);
    await page.waitForSelector('.csma-media');
  });

  test('renders thumbnail grid', async ({ page }) => {
    const items = page.locator('#media-container .csma-media__item');
    expect(await items.count()).toBeGreaterThanOrEqual(6);
  });

  test('search input exists', async ({ page }) => {
    const search = page.locator('#media-container .csma-media__search');
    await expect(search).toBeVisible();
  });

  test('sort dropdown exists', async ({ page }) => {
    const sort = page.locator('#media-container .csma-media__sort');
    await expect(sort).toBeVisible();
  });

  test('search filters items', async ({ page }) => {
    const search = page.locator('#media-container .csma-media__search');
    await search.fill('Sunset');
    await page.waitForTimeout(300);

    const items = page.locator('#media-container .csma-media__item');
    expect(await items.count()).toBe(1);
  });

  test('clicking item selects it', async ({ page }) => {
    const item = page.locator('#media-container .csma-media__item').first();
    await item.click();

    await expect(item).toHaveAttribute('aria-selected', 'true');
  });

  test('destroy removes browser from DOM', async ({ page }) => {
    await page.evaluate(() => window.__media.destroy());
    const media = page.locator('#media-container .csma-media');
    await expect(media).toHaveCount(0);
  });
});

test.describe('Nav Tabs Archetype', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/demo/archetypes-demo.html`);
    await page.waitForSelector('.csma-navtabs');
  });

  test('renders tabs', async ({ page }) => {
    const tabs = page.locator('#navtabs-container [role="tab"]');
    expect(await tabs.count()).toBe(6);
  });

  test('first tab is active', async ({ page }) => {
    const firstTab = page.locator('#navtabs-container [role="tab"]').first();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking tab activates it', async ({ page }) => {
    const thirdTab = page.locator('#navtabs-container [role="tab"]').nth(2);
    await thirdTab.click();

    await expect(thirdTab).toHaveAttribute('aria-selected', 'true');
  });

  test('badge count renders', async ({ page }) => {
    const badge = page.locator('#navtabs-container .csma-navtabs__tab-badge').first();
    await expect(badge).toHaveText('5');
  });

  test('close button exists on tabs', async ({ page }) => {
    const closeBtn = page.locator('#navtabs-container .csma-navtabs__close').first();
    await expect(closeBtn).toBeAttached();
  });

  test('destroy removes tabs from DOM', async ({ page }) => {
    await page.evaluate(() => window.__navtabs.destroy());
    const tabs = page.locator('#navtabs-container .csma-navtabs');
    await expect(tabs).toHaveCount(0);
  });
});

test.describe('Overlay Manager Archetype', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/demo/archetypes-demo.html`);
    await page.waitForSelector('body');
  });

  test('openModal shows overlay', async ({ page }) => {
    await page.click('#om-modal');

    const modal = page.locator('.csma-overlay-modal');
    await expect(modal).toBeVisible();

    const title = modal.locator('.csma-overlay-header');
    await expect(title).toContainText('Modal Title');
  });

  test('Escape closes modal', async ({ page }) => {
    await page.click('#om-modal');
    await page.waitForSelector('.csma-overlay-modal');

    await page.keyboard.press('Escape');
    await expect(page.locator('.csma-overlay-modal')).toHaveCount(0);
  });

  test('openDrawer shows side panel', async ({ page }) => {
    await page.click('#om-drawer');

    const drawer = page.locator('.csma-overlay-drawer');
    await expect(drawer).toBeVisible();
    await expect(page.locator('.csma-overlay-header')).toContainText('Settings');
  });

  test('openPopover appears near anchor', async ({ page }) => {
    await page.click('#om-popover');

    const popover = page.locator('.csma-overlay-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('Edit');
  });

  test('openLightbox shows image', async ({ page }) => {
    await page.click('#om-lightbox');

    const lightbox = page.locator('.csma-overlay-lightbox');
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator('img')).toBeAttached();
  });

  test('closeAll clears all overlays', async ({ page }) => {
    await page.click('#om-drawer');
    await page.waitForSelector('.csma-overlay-drawer');

    await page.evaluate(() => window.__overlays.closeAll());

    await expect(page.locator('.csma-overlay-drawer')).toHaveCount(0);
  });
});
