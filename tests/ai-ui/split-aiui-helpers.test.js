import { describe, it, expect } from 'vitest';
import {
  SAFE_TAGS,
  SAFE_ATTRIBUTES,
  KNOWN_STATE_ATTRS,
  isPlainObject,
  cloneDefinition,
  normalizeCatalogEntry,
  ownerFromPayload
} from '../../src/modules/ai-ui/services/AIUIHelpers.js';

/**
 * AIUIHelpers — constants + pure helpers extracted from
 * AIUIComposerService.js (Phase 6 split).
 */

describe('AIUIHelpers (split piece)', () => {
  it('keeps the security allowlists', () => {
    expect(SAFE_TAGS.has('div')).toBe(true);
    expect(SAFE_TAGS.has('svg')).toBe(true);
    expect(SAFE_TAGS.has('script')).toBe(false);
    expect(SAFE_ATTRIBUTES.has('href')).toBe(true);
    expect(KNOWN_STATE_ATTRS.has('data-state')).toBe(true);
  });

  it('isPlainObject discriminates objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject('x')).toBe(false);
  });

  it('cloneDefinition deep-copies', () => {
    const def = { id: 'x', render: { kind: 'element', tag: 'div' } };
    const copy = cloneDefinition(def);
    copy.render.tag = 'span';
    expect(def.render.tag).toBe('div');
  });

  it('normalizeCatalogEntry validates and fills defaults', () => {
    const entry = normalizeCatalogEntry({ id: 'a-button', render: { kind: 'button' } });
    expect(entry.id).toBe('a-button');
    expect(entry.alias).toBe('a-button');
    expect(entry.propsSchema).toEqual({});
    expect(entry.slots).toEqual({});
    expect(entry.allowedChildren).toEqual([]);
    expect(() => normalizeCatalogEntry({ render: {} })).toThrow(/requires an id/);
  });

  it('ownerFromPayload falls back for unknown modules', () => {
    expect(ownerFromPayload({ id: 'mod' })).toBe('mod');
    expect(ownerFromPayload({ manifest: { id: 'manifest-mod' } })).toBe('manifest-mod');
    expect(ownerFromPayload(null)).toBe('unknown-module');
  });
});
