import { describe, expect, it } from 'vitest';

import { buildArchetypePreviewPayload, collectArchetypes, validateArchetypeCollection } from '../tooling/scripts/archetype-utils.js';

describe('archetype-utils', () => {
  it('collects and validates the current archetype set', () => {
    const collection = collectArchetypes();
    const findings = validateArchetypeCollection(collection, {
      knownComponents: ['badge', 'button', 'card', 'field', 'input', 'theme-toggle', 'toast']
    });

    expect(collection.layouts.map(({ archetype }) => archetype.id)).toContain('auth-shell');
    expect(collection.content.map(({ archetype }) => archetype.id)).toEqual(expect.arrayContaining(['contact-form', 'login-form']));
    expect(findings).toEqual([]);
  });

  it('builds preview payloads with layout registry compatibility', () => {
    const payload = buildArchetypePreviewPayload(collectArchetypes(), '2026-04-10T00:00:00.000Z');

    expect(payload.generatedAt).toBe('2026-04-10T00:00:00.000Z');
    expect(payload.layout.id).toBe('auth-shell');
    expect(payload.layouts['auth-shell'].kind).toBe('layout-archetype');
    expect(payload.contentArchetypes['login-form'].targetRegion).toBe('main');
  });
});
