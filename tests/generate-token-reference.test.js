import { describe, expect, it } from 'vitest';

import { collectTokenReference } from '../tooling/scripts/generate-token-reference.js';

describe('generate-token-reference', () => {
  it('flattens design tokens into an AI-friendly reference', async () => {
    const reference = await collectTokenReference({
      generatedAt: '2026-04-10T00:00:00.000Z'
    });

    expect(reference.generatedAt).toBe('2026-04-10T00:00:00.000Z');
    expect(reference.totalTokens).toBeGreaterThan(20);
    expect(reference.categories.primitives).toBeGreaterThan(0);
    expect(reference.categories.themes).toBeGreaterThan(0);

    const spacing = reference.tokens.find((token) => token.path === 'primitives.spacing.sm');
    expect(spacing.cssVar).toBe('--space-sm');

    const buttonRadius = reference.tokens.find((token) => token.path === 'components.button.radius');
    expect(buttonRadius.cssVar).toBe('--button-radius');

    const lightBackground = reference.tokens.find((token) => token.path === 'themes.light.colors.background');
    expect(lightBackground.cssVar).toBe('--background');
  });
});
