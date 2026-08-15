import { describe, it, expect, beforeEach } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';
import { MindmapSerialization } from '../../src/modules/mindmap/services/MindmapSerialization.js';

/**
 * MindmapSerialization — markdown/ascii/json export extracted from
 * MindmapService.js (Phase 6 split). Round-trip fidelity is covered by
 * markdown-codec.test.js; this file pins the mixin wiring + a smoke of all
 * three formats through the service.
 */

function makeEventBus() {
  return { subscribe() {}, unsubscribe() {}, publish() {} };
}

describe('MindmapSerialization (split piece)', () => {
  let svc;
  let mapId;

  beforeEach(async () => {
    svc = new MindmapService(makeEventBus());
    svc.init({ storage: null });
    mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const b = await svc.addBranch(root.id, 'features');
    await svc.addLeaf(b.id, 'export formats');
  });

  it('is mixed onto MindmapService.prototype', () => {
    expect(MindmapService.prototype.toMarkdown).toBe(MindmapSerialization.toMarkdown);
    expect(MindmapService.prototype.toAscii).toBe(MindmapSerialization.toAscii);
    expect(MindmapService.prototype.toMinimalJson).toBe(MindmapSerialization.toMinimalJson);
  });

  it('exports all three formats', () => {
    const md = svc.toMarkdown(mapId);
    expect(md).toContain('features');
    const ascii = svc.toAscii(mapId);
    expect(ascii).toContain('export formats');
    const json = svc.toMinimalJson(mapId);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
  });

  it('returns empty/null when no map exists', () => {
    const empty = new MindmapService(makeEventBus());
    empty.init({ storage: null });
    expect(empty.toMarkdown()).toBe('');
    expect(empty.toAscii()).toBe('');
    expect(empty.toMinimalJson()).toBeNull();
  });
});
