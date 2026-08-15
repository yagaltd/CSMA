import { describe, it, expect } from 'vitest';
import {
  MindmapService,
  makeBranch,
  makeLeaf,
  makeRoot,
  SCHEMA_BRANCH,
  SCHEMA_LEAF
} from '../../src/modules/mindmap/services/MindmapService.js';
import { generateId, now } from '../../src/modules/mindmap/services/MindmapNode.js';

/**
 * MindmapNode — factories + schema constants extracted from
 * MindmapService.js (Phase 6 split). The parent test
 * (mindmap-service.test.js) imports makeBranch/makeLeaf from the facade;
 * this file pins the extracted module's own surface.
 */

describe('MindmapNode (split piece)', () => {
  it('exports schema constants via the facade re-export', () => {
    expect(SCHEMA_BRANCH).toBe('mindmap/branch');
    expect(SCHEMA_LEAF).toBe('mindmap/leaf');
  });

  it('makeRoot builds a synthetic root', () => {
    const root = makeRoot('plan');
    expect(root.id.startsWith('root_')).toBe(true);
    expect(root.topic).toBe('plan');
    expect(root.schemaType).toBe(SCHEMA_BRANCH);
    expect(root.children).toEqual([]);
  });

  it('makeBranch/makeLeaf carry schema type + metadata', () => {
    const b = makeBranch('branch', { tag: 'phase' });
    expect(b.schemaType).toBe(SCHEMA_BRANCH);
    expect(b.tag).toBe('phase');
    expect(b.metadata.leafCount).toBe(0);
    const l = makeLeaf('leaf', { bottleneck: 'api' });
    expect(l.schemaType).toBe(SCHEMA_LEAF);
    expect(l.metadata.bottleneck).toBe('api');
  });

  it('generateId prefixes + now returns a number', () => {
    expect(generateId('map').startsWith('map_')).toBe(true);
    expect(typeof now()).toBe('number');
  });
});
