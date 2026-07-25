import { describe, it, expect, beforeEach } from 'vitest';
import { MindmapService, makeBranch, makeLeaf } from '../../src/modules/mindmap/services/MindmapService.js';

/**
 * Minimal EventBus stub that supports publish + subscribe so the service
 * can fire events without the full CSMA runtime. Tests assert on the
 * captured events.
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

/**
 * Minimal history stub. Real HistoryService is exercised in undo-redo.test.js.
 */
function makeHistoryStub() {
  const entries = [];
  const listeners = { undone: [], redone: [] };
  return {
    entries,
    record(intent, payload) {
      const entry = { id: `e${entries.length + 1}`, intent, payload, status: 'recorded' };
      entries.unshift(entry);
      return entry;
    },
    undo() {
      const e = entries.find((x) => x.status === 'recorded');
      if (!e) return null;
      e.status = 'undone';
      for (const fn of listeners.undone) fn({ entry: { id: e.id, intent: e.intent }, cursor: 'c' });
      return e;
    },
    redo() {
      const e = entries.find((x) => x.status === 'undone');
      if (!e) return null;
      e.status = 'redone';
      for (const fn of listeners.redone) fn({ entry: { id: e.id, intent: e.intent }, cursor: 'c' });
      return e;
    },
    canUndo() { return entries.some((e) => e.status === 'recorded'); },
    canRedo() { return entries.some((e) => e.status === 'undone'); },
    getEntry(id) { return entries.find((e) => e.id === id) || null; },
    getAll() { return [...entries]; },
    onUndone(fn) { listeners.undone.push(fn); },
    onRedone(fn) { listeners.redone.push(fn); }
  };
}

describe('MindmapService', () => {
  let svc;
  let bus;
  let history;

  beforeEach(async () => {
    bus = makeEventBus();
    history = makeHistoryStub();
    // Wire history undo/redo callbacks to the service's expected subscription points.
    svc = new MindmapService(bus);
    svc.init({ storage: null, history });
    // Bridge stub events to bus subscribers the service registered for.
    history.onUndone((p) => bus.publish('HISTORY_OP_UNDONE', p));
    history.onRedone((p) => bus.publish('HISTORY_OP_REDONE', p));
  });

  it('creates a map and fires MINDMAP_MAP_CREATED', async () => {
    const mapId = await svc.createMap('My map');
    expect(mapId).toMatch(/^map_/);
    const created = bus.published.find((e) => e.name === 'MINDMAP_MAP_CREATED');
    expect(created).toBeTruthy();
    expect(created.payload.mapId).toBe(mapId);
    expect(created.payload.name).toBe('My map');
  });

  it('rejects operations on a missing active map', async () => {
    await expect(svc.addBranch('x', 'topic')).rejects.toThrowError(/no active map/);
  });

  it('addBranch + addLeaf fire MINDMAP_NODE_ADDED with schemaType', async () => {
    const mapId = await svc.createMap('m');
    const map = svc._getMap(mapId);
    const branch = await svc.addBranch(map.root.id, 'e2e-test', { tag: 'phase' });
    expect(branch.schemaType).toBe('mindmap/branch');
    expect(branch.tag).toBe('phase');

    const leaf = await svc.addLeaf(branch.id, 'write tests');
    expect(leaf.schemaType).toBe('mindmap/leaf');

    const adds = bus.published.filter((e) => e.name === 'MINDMAP_NODE_ADDED');
    expect(adds).toHaveLength(2);
    expect(adds[0].payload.node.schemaType).toBe('mindmap/branch');
    expect(adds[1].payload.node.schemaType).toBe('mindmap/leaf');
  });

  it('updateStatus updates node and emits MINDMAP_NODE_UPDATED with previousStatus', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b');
    bus.published.length = 0;
    await svc.updateStatus(branch.id, 'in_progress');
    const updated = bus.published.find((e) => e.name === 'MINDMAP_NODE_UPDATED');
    expect(updated).toBeTruthy();
    expect(updated.payload.nodeId).toBe(branch.id);
    expect(updated.payload.changes.status).toBe('in_progress');
    expect(updated.payload.previousStatus).toBe('pending');
  });

  it('removeNode cascades children and emits MINDMAP_NODE_REMOVED', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b');
    await svc.addLeaf(branch.id, 'l1');
    await svc.addLeaf(branch.id, 'l2');
    bus.published.length = 0;
    const result = await svc.removeNode(branch.id);
    expect(result.cascaded).toHaveLength(3); // branch + 2 leaves
    const removed = bus.published.find((e) => e.name === 'MINDMAP_NODE_REMOVED');
    expect(removed.payload.cascaded).toHaveLength(3);
  });

  it('removeNode rejects removing the root', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    await expect(svc.removeNode(root.id)).rejects.toThrowError(/root/);
  });

  it('addLeaf to a leaf rejects with an error', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b');
    const leaf = await svc.addLeaf(branch.id, 'l');
    await expect(svc.addLeaf(leaf.id, 'x')).rejects.toThrowError(/leaf/);
  });

  it('collapse fires both MINDMAP_COLLAPSED and MINDMAP_STRUCTURE_CHANGED', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b');
    bus.published.length = 0;
    await svc.collapse(branch.id, true);
    const collapsed = bus.published.find((e) => e.name === 'MINDMAP_COLLAPSED');
    const structured = bus.published.find((e) => e.name === 'MINDMAP_STRUCTURE_CHANGED');
    expect(collapsed.payload.collapsed).toBe(true);
    expect(structured.payload.operation).toBe('collapse');
  });

  it('collapse on a leaf rejects', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b');
    const leaf = await svc.addLeaf(branch.id, 'l');
    await expect(svc.collapse(leaf.id, true)).rejects.toThrowError(/branch/);
  });

  it('recomputes branch counts after status update', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b');
    const l1 = await svc.addLeaf(branch.id, 'l1');
    const l2 = await svc.addLeaf(branch.id, 'l2');
    await svc.updateStatus(l1.id, 'done');
    await svc.updateStatus(l2.id, 'done');
    const updated = svc.findNode(branch.id);
    expect(updated.metadata.leafCount).toBe(2);
    expect(updated.metadata.doneCount).toBe(2);
  });

  it('getSubtree respects maxDepth', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const b1 = await svc.addBranch(root.id, 'b1');
    const b2 = await svc.addBranch(b1.id, 'b2');
    await svc.addLeaf(b2.id, 'leaf');
    const sub0 = svc.getSubtree(b1.id, { maxDepth: 0 });
    expect(sub0.children).toHaveLength(0);
    const sub1 = svc.getSubtree(b1.id, { maxDepth: 1 });
    expect(sub1.children).toHaveLength(1);
    expect(sub1.children[0].children).toHaveLength(0);
  });

  it('history records every mutation under intent "mindmap"', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    await svc.addBranch(root.id, 'b');
    expect(history.entries.filter((e) => e.intent === 'mindmap').length).toBeGreaterThanOrEqual(1);
  });
});
