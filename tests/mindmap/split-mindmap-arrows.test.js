import { describe, it, expect, beforeEach } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';
import { MindmapArrows } from '../../src/modules/mindmap/services/MindmapArrows.js';

/**
 * MindmapArrows — cross-link arrow section extracted from MindmapService.js
 * (Phase 6 split). This file pins the mixin wiring and arrow CRUD smoke.
 */

function makeEventBus() {
  const published = [];
  return {
    published,
    subscribe() {},
    unsubscribe() {},
    publish(name, payload) {
      published.push({ name, payload });
    }
  };
}

describe('MindmapArrows (split piece)', () => {
  let svc;
  let mapId;

  beforeEach(async () => {
    svc = new MindmapService(makeEventBus());
    svc.init({ storage: null });
    mapId = await svc.createMap('m');
  });

  it('is mixed onto MindmapService.prototype', () => {
    expect(MindmapService.prototype.getArrows).toBe(MindmapArrows.getArrows);
    expect(MindmapService.prototype.addArrow).toBe(MindmapArrows.addArrow);
    expect(MindmapService.prototype.removeArrow).toBe(MindmapArrows.removeArrow);
    expect(MindmapService.prototype.updateArrow).toBe(MindmapArrows.updateArrow);
    expect(MindmapService.prototype.arrowPaths).toBe(MindmapArrows.arrowPaths);
    expect(MindmapService.prototype.requestFocus).toBe(MindmapArrows.requestFocus);
  });

  it('add/get/update/remove arrow round-trip', async () => {
    const root = svc._getMap(mapId).root;
    const a = await svc.addBranch(root.id, 'a');
    const b = await svc.addBranch(root.id, 'b');
    const arrow = await svc.addArrow(a.id, b.id);
    expect(arrow.from).toBe(a.id);
    expect(svc.getArrows(mapId)).toHaveLength(1);
    await svc.updateArrow(arrow.id, { label: 'relates' });
    expect(svc.getArrows(mapId)[0].label).toBe('relates');
    await svc.removeArrow(arrow.id);
    expect(svc.getArrows(mapId)).toHaveLength(0);
  });

  it('rejects a self-arrow and structural tree edges', async () => {
    const root = svc._getMap(mapId).root;
    const a = await svc.addBranch(root.id, 'a');
    await expect(svc.addArrow(a.id, a.id)).rejects.toThrow(/itself/);
    await expect(svc.addArrow(root.id, a.id)).rejects.toThrow(/structural tree edge/);
  });
});
