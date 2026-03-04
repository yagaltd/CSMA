import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { analyzeRoutes } from '../../scripts/build/analyze-routes.js';

describe('analyzeRoutes', () => {
  it('classifies sample templates under src/pages', async () => {
    const pagesDir = path.resolve(__dirname, '../../src/pages');
    const routes = await analyzeRoutes({ pagesDir });
    expect(routes.length).toBeGreaterThan(0);
    const productsRoute = routes.find((entry) => entry.route === '/products');
    expect(productsRoute?.classification?.type).toBeDefined();
    const aboutRoute = routes.find((entry) => entry.route === '/about');
    expect(aboutRoute?.classification?.type).toBe('static');
  });
});
