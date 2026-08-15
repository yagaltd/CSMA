import { describe, it, expect, beforeEach } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';
import { MindmapSearch } from '../../src/modules/mindmap/services/MindmapSearch.js';

/**
 * MindmapSearch — search section extracted from MindmapService.js
 * (Phase 6 split). Scoring/filter details are covered by search.test.js
 * (unchanged); this file pins the mixin wiring and a basic lookup smoke.
 */

function makeEventBus() {
  return { subscribe() {}, unsubscribe() {}, publish() {} };
}

describe('MindmapSearch (split piece)', () => {
  let svc;
  let mapId;

  beforeEach(async () => {
    svc = new MindmapService(makeEventBus());
    svc.init({ storage: null });
    mapId = await svc.createMap('m');
  });

  it('is mixed onto MindmapService.prototype', () => {
    expect(MindmapService.prototype.search).toBe(MindmapSearch.search);
  });

  it('finds a leaf by topic through the service', async () => {
    const root = svc._getMap(mapId).root;
    const b = await svc.addBranch(root.id, 'workstream');
    await svc.addLeaf(b.id, 'write the split plan');
    const results = svc.search('split plan');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.topic.includes('split plan'))).toBe(true);
  });

  it('returns [] when no map is active', () => {
    const empty = new MindmapService(makeEventBus());
    empty.init({ storage: null });
    expect(empty.search('anything')).toEqual([]);
  });
});
