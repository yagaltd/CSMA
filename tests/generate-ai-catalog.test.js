import { describe, expect, it } from 'vitest';

import { collectComponentCatalog } from '../tooling/scripts/generate-ai-catalog.js';

describe('generate-ai-catalog', () => {
  it('builds a catalog from enabled component manifests', async () => {
    const catalog = await collectComponentCatalog({
      generatedAt: '2026-04-09T00:00:00.000Z'
    });

    expect(catalog.version).toBe('1.0.0');
    expect(catalog.generatedAt).toBe('2026-04-09T00:00:00.000Z');
    expect(catalog.source).toBe('library/ui/components/*/manifest.json');
    expect(catalog.totalComponents).toBeGreaterThanOrEqual(4);
    expect(catalog.categories).toContain('CSS-Only');
    expect(catalog.categories).toContain('Interactive');

    const button = catalog.components.find((component) => component.alias === 'button');
    expect(button).toMatchObject({
      name: 'button',
      type: 'I',
      category: 'Interactive',
      preferred: true,
      manifestPath: 'library/ui/components/button/manifest.json'
    });
    expect(button.propsSchema.variant).toBe('string');
    expect(button.render.kind).toBe('button');

    const toast = catalog.components.find((component) => component.alias === 'toast');
    expect(toast).toMatchObject({
      name: 'toast',
      type: 'II',
      manifestPath: 'library/ui/components/toast/manifest.json'
    });
    expect(toast.dependencies.runtime).toContain('EventBus');
    expect(toast.contracts.subscribed).toContain('INTENT_TOAST_SHOW');
    expect(toast.contracts.published).toContain('TOAST_SHOWN');
  });
});
