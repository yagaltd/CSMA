import { describe, it, expect, beforeEach } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';

function makeEventBus() {
  const subscribers = new Map();
  return {
    subscribe(name, fn) {
      if (!subscribers.has(name)) subscribers.set(name, []);
      subscribers.get(name).push(fn);
    },
    unsubscribe() {},
    publish(name, payload) {
      const arr = subscribers.get(name);
      if (arr) for (const fn of arr) fn(payload);
    }
  };
}

describe('mindmap drag-drop validation (moveNode)', () => {
  let svc;
  let mapId;
  let root;
  let b1;
  let b2;
  let leaf;

  beforeEach(async () => {
    const bus = makeEventBus();
    svc = new MindmapService(bus);
    svc.init({ storage: null });
    mapId = await svc.createMap('m');
    root = svc._getMap(mapId).root;
    b1 = await svc.addBranch(root.id, 'b1');
    b2 = await svc.addBranch(root.id, 'b2');
    leaf = await svc.addLeaf(b1.id, 'l1');
  });

  it('moves a leaf between branches at end position', async () => {
    const moved = await svc.moveNode(leaf.id, b2.id);
    expect(moved.id).toBe(leaf.id);
    expect(svc.findNode(leaf.id)).toBeTruthy();
    // b2 now contains the leaf
    const b2fresh = svc.findNode(b2.id);
    expect(b2fresh.children.map((c) => c.id)).toContain(leaf.id);
    // b1 no longer contains it
    const b1fresh = svc.findNode(b1.id);
    expect(b1fresh.children.map((c) => c.id)).not.toContain(leaf.id);
  });

  it('moves a node to a specific index', async () => {
    const l2 = await svc.addLeaf(b2.id, 'l2');
    const l3 = await svc.addLeaf(b2.id, 'l3');
    // Move l3 to index 0 of b2
    await svc.moveNode(l3.id, b2.id, 0);
    const fresh = svc.findNode(b2.id);
    expect(fresh.children[0].id).toBe(l3.id);
    expect(fresh.children[1].id).toBe(l2.id);
  });

  it('rejects moving root', async () => {
    await expect(svc.moveNode(root.id, b1.id)).rejects.toThrowError(/root/);
  });

  it('rejects moving into a leaf', async () => {
    await expect(svc.moveNode(b1.id, leaf.id)).rejects.toThrowError(/leaf/);
  });

  it('rejects moving a node into its own descendant', async () => {
    // b1 has a leaf; trying to move b1 into that leaf should fail (also because leaf)
    // But the proper cycle check: move b1 into b2 when b2 is a child of b1.
    const subBranch = await svc.addBranch(b1.id, 'sub');
    // subBranch is now a child of b1. Try moving b1 into subBranch → cycle.
    await expect(svc.moveNode(b1.id, subBranch.id)).rejects.toThrowError(/cycle|descendant|itself/);
  });

  it('moveNode fires MINDMAP_NODE_MOVED with fromParent + toParent', async () => {
    const events = [];
    const bus = svc.eventBus;
    bus.subscribe('MINDMAP_NODE_MOVED', (p) => events.push(p));
    await svc.moveNode(leaf.id, b2.id);
    expect(events).toHaveLength(1);
    expect(events[0].fromParent).toBe(b1.id);
    expect(events[0].toParent).toBe(b2.id);
  });
});
