import { describe, expect, it } from 'vitest';

import { collectComponentReference } from '../tooling/scripts/generate-component-reference.js';
import { toolingGeneratedPath } from '../tooling/scripts/generated-paths.js';

describe('generate-component-reference', () => {
  it('builds a machine-readable component reference from manifests and css', async () => {
    const reference = await collectComponentReference({
      generatedAt: '2026-04-10T00:00:00.000Z'
    });

    expect(reference.generatedAt).toBe('2026-04-10T00:00:00.000Z');
    expect(reference.totalComponents).toBeGreaterThanOrEqual(7);

    const button = reference.components.find((component) => component.id === 'button');
    expect(button.visualRole).toBe('control');
    expect(button.variants).toEqual(expect.arrayContaining(['primary', 'secondary', 'ghost', 'destructive']));
    expect(button.sizes).toEqual(expect.arrayContaining(['sm', 'lg']));
    expect(button.states).toEqual(expect.arrayContaining(['hover', 'focus-visible', 'active', 'disabled', 'loading']));
    expect(button.tokensUsed).toContain('button-radius');

    const card = reference.components.find((component) => component.id === 'card');
    expect(card.tones).toContain('subtle');
    expect(card.visualRole).toBe('container');
  });

  it('uses tooling/generated for shared component references', () => {
    expect(toolingGeneratedPath('component-reference.json').replaceAll('\\', '/')).toMatch(/tooling\/generated\/component-reference\.json$/);
  });
});
