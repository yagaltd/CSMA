/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';

function makeEventBus() {
  const subscribers = new Map();
  return {
    subscribe(name, fn) {
      if (!subscribers.has(name)) subscribers.set(name, []);
      subscribers.get(name).push(fn);
    },
    unsubscribe(name, fn) {
      const arr = subscribers.get(name);
      if (arr) subscribers.set(name, arr.filter((f) => f !== fn));
    },
    publish(name, payload) {
      const arr = subscribers.get(name);
      if (arr) for (const fn of arr) fn(payload);
    }
  };
}

describe('mindmap render helpers (jsdom)', () => {
  let svc;
  let container;

  beforeEach(async () => {
    const bus = makeEventBus();
    svc = new MindmapService(bus);
    svc.init({ storage: null });
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('layout returns one node per NodeObj in the tree', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    await svc.addBranch(root.id, 'b1');
    await svc.addBranch(root.id, 'b2');
    const { nodes, links } = svc.layout(mapId);
    expect(nodes.length).toBe(3); // root + 2 branches
    expect(links.length).toBe(2);
  });

  it('connectorPaths returns SVG d strings for every link', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    await svc.addBranch(root.id, 'b1');
    const paths = svc.connectorPaths(mapId);
    expect(paths.length).toBe(1);
    expect(typeof paths[0].d).toBe('string');
    expect(paths[0].d.startsWith('M ')).toBe(true);
  });

  it('mounting components manually: branch-node element reflects data-status', async () => {
    // Simulates what ai-ui would do: create a DOM element with the right attributes.
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b1', { tag: 'phase' });
    await svc.updateStatus(branch.id, 'in_progress');

    const el = document.createElement('div');
    el.className = 'branch-node';
    el.dataset.status = branch.status;
    el.dataset.tag = branch.tag;
    el.dataset.nodeId = branch.id;
    container.appendChild(el);

    const rendered = container.querySelector(`[data-node-id="${branch.id}"]`);
    expect(rendered).toBeTruthy();
    expect(rendered.dataset.status).toBe('in_progress');
    expect(rendered.dataset.tag).toBe('phase');
  });

  it('after removeNode the layout no longer includes the removed id', async () => {
    const mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const branch = await svc.addBranch(root.id, 'b1');
    const before = svc.layout(mapId);
    expect(before.nodes.map((n) => n.id)).toContain(branch.id);
    await svc.removeNode(branch.id);
    const after = svc.layout(mapId);
    expect(after.nodes.map((n) => n.id)).not.toContain(branch.id);
  });
});
