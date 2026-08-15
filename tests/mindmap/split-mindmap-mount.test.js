/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';
import { MindmapMount } from '../../src/modules/mindmap/services/MindmapMount.js';

/**
 * MindmapMount — aiui surface mounting extracted from MindmapService.js
 * (Phase 6 split). Full interaction coverage lives in the Wave 2/3 browser
 * work; this file pins the mixin wiring and a mount/unmount smoke.
 */

function makeEventBus() {
  const subscribers = new Map();
  return {
    subscribe(name, fn) {
      if (!subscribers.has(name)) subscribers.set(name, []);
      subscribers.get(name).push(fn);
      return () => {};
    },
    unsubscribe() {},
    publish() {}
  };
}

describe('MindmapMount (split piece)', () => {
  let svc;
  let container;
  let mapId;

  beforeEach(async () => {
    svc = new MindmapService(makeEventBus());
    svc.init({ storage: null });
    mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    await svc.addBranch(root.id, 'b1');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('is mixed onto MindmapService.prototype', () => {
    expect(MindmapService.prototype.mountSurface).toBe(MindmapMount.mountSurface);
  });

  it('mounts the mindmap-canvas surface and returns a cleanup api', () => {
    const api = svc.mountSurface('mindmap-canvas', container, { mapId });
    expect(typeof api).toBe('function');
    expect(typeof api.render).toBe('function');
    expect(typeof api.destroy).toBe('function');
    const canvas = container.querySelector('.mm-canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.getAttribute('data-surface')).toBe('mindmap-canvas');
    // one mind-node per NodeObj (root + 1 branch)
    const nodes = container.querySelectorAll('[data-node-id]');
    expect(nodes.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects unknown surfaces', () => {
    expect(() => svc.mountSurface('nope', container)).toThrow(/unknown surface/);
  });

  it('destroy() empties the container', () => {
    const api = svc.mountSurface('mindmap-canvas', container, { mapId });
    expect(container.querySelector('.mm-canvas')).toBeTruthy();
    api.destroy();
    expect(container.querySelector('.mm-canvas')).toBeNull();
  });
});
