import { test, expect } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Console-error guard: every demo/showcase page and every component demo page
// must load with zero console errors, zero page errors, and zero failed
// requests (4xx/5xx). Keep this green — demos are copyable reference material.

const DEMO_PAGES = [
  '/demo/index.html',
  '/demo/archetypes-demo.html',
  '/demo/newsletter-dashboard.html',
  '/demo/slides.html',
  '/demo/typeset-demo.html',
  '/demo/visual-editor-comments/index.html',
  '/showcase/token-showcase.html',
];

const COMPONENT_DIR = path.resolve('src/ui/components');
const COMPONENT_PAGES = readdirSync(COMPONENT_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => `/src/ui/components/${e.name}/${e.name}.demo.html`);

// Guard pages whose demo file does not exist on disk (e.g.
// src/ui/components/chat and drawing are plan-only stubs). A missing page
// would 404 (vite fallback) and fail for the wrong reason.
const PAGES = [...DEMO_PAGES, ...COMPONENT_PAGES].filter((pagePath) =>
  existsSync(path.resolve(pagePath.slice(1)))
);

for (const pagePath of PAGES) {
  test(`no console errors on ${pagePath}`, async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('requestfailed', (req) => {
      const url = req.url();
      // Ignore the sync relay WebSocket when no relay server is running;
      // the demo is opt-in (?relay=1) and degrades gracefully (see demo-sync.js).
      if (!url.startsWith('ws://')) failedRequests.push(`${req.failure()?.errorText || 'failed'}: ${url}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) failedRequests.push(`${res.status()}: ${res.url()}`);
    });

    const response = await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `HTTP ${response?.status()} for ${pagePath}`).toBeLessThan(400);
    await page.waitForTimeout(2500);

    expect(
      [...consoleErrors, ...pageErrors, ...failedRequests],
      `console/page/network errors on ${pagePath}`
    ).toEqual([]);
  });
}
