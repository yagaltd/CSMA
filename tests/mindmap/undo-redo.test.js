import { describe, it, expect, beforeEach } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';
import { HistoryService } from '../../src/modules/history/services/HistoryService.js';

/**
 * Use the REAL HistoryService so we exercise the actual undo/redo path
 * + the service's _onHistoryReversed subscription.
 */

function makeEventBus() {
  const subscribers = new Map();
  const published = [];
  return {
    published,
    subscribe(name, fn) {
      if (!subscribers.has(name)) subscribers.set(name, []);
      subscribers.get(name).push(fn);
    },
    unsubscribe(name, fn) {
      const arr = subscribers.get(name);
      if (arr) subscribers.set(name, arr.filter((f) => f !== fn));
    },
    publish(name, payload) {
      published.push({ name, payload });
      const arr = subscribers.get(name);
      if (arr) for (const fn of arr) fn(payload);
    }
  };
}

describe('mindmap undo/redo via real HistoryService', () => {
  let svc;
  let bus;
  let history;

  beforeEach(async () => {
    bus = makeEventBus();
    history = new HistoryService(bus);
    // Memory store (no IDB): pass no store, the HistoryStore falls back.
    await history.init({ store: { init: async () => {}, getAll: async () => [], put: async () => {}, clear: async () => {} } });
    svc = new MindmapService(bus);
    svc.init({ storage: null, history });
  });

  it('addBranch → undo removes the branch', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b1');
    expect(svc.findNode(branch.id)).toBeTruthy();
    expect(svc.canUndo()).toBe(true);

    await svc.undo();
    expect(svc.findNode(branch.id)).toBeNull();
  });

  it('redo re-applies the undone addBranch', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b1');
    await svc.undo();
    expect(svc.canRedo()).toBe(true);
    const result = await svc.redo();
    expect(result).toBeTruthy();
    expect(svc.findNode(branch.id)).toBeTruthy();
  });

  it('10-op sequence: undo to start, redo to end, tree matches', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branches = [];
    for (let i = 0; i < 5; i += 1) {
      branches.push(await svc.addBranch(root.id, `b${i}`));
    }
    for (let i = 0; i < 5; i += 1) {
      await svc.updateStatus(branches[i].id, 'done');
    }
    const snapshot = JSON.stringify(svc._getMap(mapId).root, (key, value) => (key === 'updatedAt' ? undefined : value));

    // Undo everything (10 ops + createMap may or may not count; loop until canUndo is false).
    let safety = 50;
    while (svc.canUndo() && safety > 0) { await svc.undo(); safety -= 1; }

    // Redo everything.
    safety = 50;
    while (svc.canRedo() && safety > 0) { await svc.redo(); safety -= 1; }

    const after = JSON.stringify(svc._getMap(mapId).root, (key, value) => (key === 'updatedAt' ? undefined : value));
    expect(after).toEqual(snapshot);
  });

  it('updateStatus undo reverts to previous status', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b');
    await svc.updateStatus(branch.id, 'done');
    expect(svc.findNode(branch.id).status).toBe('done');
    await svc.undo();
    expect(svc.findNode(branch.id).status).toBe('pending');
  });

  it('collapse undo restores previous expanded state', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b');
    expect(branch.expanded).toBe(true);
    await svc.collapse(branch.id, true);
    expect(svc.findNode(branch.id).expanded).toBe(false);
    await svc.undo();
    expect(svc.findNode(branch.id).expanded).toBe(true);
  });

  it('removeNode undo restores the subtree', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b');
    await svc.addLeaf(branch.id, 'l1');
    await svc.addLeaf(branch.id, 'l2');
    await svc.removeNode(branch.id);
    expect(svc.findNode(branch.id)).toBeNull();
    await svc.undo();
    const restored = svc.findNode(branch.id);
    expect(restored).toBeTruthy();
    expect(restored.children.length).toBe(2);
  });
});
