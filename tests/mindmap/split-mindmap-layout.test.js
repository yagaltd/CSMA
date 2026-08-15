import { describe, it, expect, beforeEach } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';
import { MindmapLayout } from '../../src/modules/mindmap/services/MindmapLayout.js';

/**
 * MindmapLayout — layout-direction + layout/connector convenience sections
 * extracted from MindmapService.js (Phase 6 split). Engine behavior is
 * covered by layout-engine.test.js / render.test.js (unchanged); this file
 * pins the mixin wiring and a layout smoke. NOTE: it deliberately avoids the
 * SIDE-direction code paths that carry the pre-existing layout-engine
 * failures.
 */

function makeEventBus() {
  return { subscribe() {}, unsubscribe() {}, publish() {} };
}

describe('MindmapLayout (split piece)', () => {
  let svc;
  let mapId;

  beforeEach(async () => {
    svc = new MindmapService(makeEventBus());
    svc.init({ storage: null });
    mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    await svc.addBranch(root.id, 'b1');
    await svc.addBranch(root.id, 'b2');
  });

  it('is mixed onto MindmapService.prototype', () => {
    expect(MindmapService.prototype.setLayoutDirection).toBe(MindmapLayout.setLayoutDirection);
    expect(MindmapService.prototype.getLayoutDirection).toBe(MindmapLayout.getLayoutDirection);
    expect(MindmapService.prototype.layout).toBe(MindmapLayout.layout);
    expect(MindmapService.prototype.connectorPaths).toBe(MindmapLayout.connectorPaths);
  });

  it('layout returns nodes + links for the active map', () => {
    const { nodes, links } = svc.layout(mapId);
    expect(nodes.length).toBe(3); // root + 2 branches
    expect(links.length).toBe(2);
    expect(nodes[0].kind).toBe('root');
  });

  it('connectorPaths returns one path per link', () => {
    const paths = svc.connectorPaths(mapId);
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(typeof p.d).toBe('string');
      expect(p.d.startsWith('M')).toBe(true);
    }
  });

  it('setLayoutDirection persists and getLayoutDirection reads it back', async () => {
    expect(svc.getLayoutDirection(mapId)).toBe(1); // default right
    await svc.setLayoutDirection(3, { mapId });
    expect(svc.getLayoutDirection(mapId)).toBe(3);
    await expect(svc.setLayoutDirection(9, { mapId })).rejects.toThrow(/direction must be/);
  });
});
