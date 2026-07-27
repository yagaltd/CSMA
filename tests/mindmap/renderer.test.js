/**
 * @vitest-environment jsdom
 *
 * Unit test for the CSMA-native renderer (MindmapRenderer.renderMindmapNodes).
 * Uses a stub service so the test is deterministic and independent of
 * LayoutEngine's DOM-measurement path (which needs a real browser). The
 * end-to-end mountSurface + real layout path is covered by
 * tests/ai-ui/module-surfaces.test.js.
 */
import { describe, it, expect } from 'vitest';
import { renderMindmapNodes } from '../../src/modules/mindmap/ui/MindmapRenderer.js';

const NODES = [
  { id: 'root', kind: 'root', x: 0, y: 0, w: 160, h: 40, status: 'in_progress', topic: 'Root' },
  { id: 'b1', kind: 'branch', x: 200, y: 0, w: 160, h: 40, status: 'pending', topic: 'Phase', tag: 'phase', expanded: true },
  { id: 'l1', kind: 'leaf', x: 400, y: -20, w: 120, h: 32, status: 'done', topic: 'Leaf A', bottleneck: 'risky' },
  { id: 'l2', kind: 'leaf', x: 400, y: 20, w: 120, h: 32, status: 'blocked', topic: 'Leaf B' },
];

const LINKS = [
  { d: 'M 160 20 L 200 20', link: { to: 'b1', kind: 'main' } },
  { d: 'M 360 10 L 400 -10', link: { to: 'l1', kind: 'sub' } },
  { d: 'M 360 30 L 400 30', link: { to: 'l2', kind: 'sub' } },
];

const FULL = {
  root: { topic: 'Root', status: 'in_progress', children: [{ children: [] }] },
  b1: { topic: 'Phase', status: 'pending', tag: 'phase', expanded: true, children: [{}, {}], childCount: 2, doneCount: 1 },
  l1: { topic: 'Leaf A', status: 'done', metadata: { bottleneck: 'risky' }, children: [] },
  l2: { topic: 'Leaf B', status: 'blocked', children: [] },
};

const stubService = {
  layout: () => ({ nodes: NODES, links: LINKS }),
  connectorPaths: () => LINKS,
  findNode: (id) => FULL[id] || {},
};

describe('MindmapRenderer — adaptive mind-node', () => {
  it('emits one adaptive mind-node per node + connector-line paths', () => {
    const nodeLayer = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    const res = renderMindmapNodes(nodeLayer, svg, stubService, 'm', {});

    expect(res.nodeCount).toBe(4);
    expect(res.connectorCount).toBe(3);
    expect(nodeLayer.querySelectorAll('.mind-node').length).toBe(4);
    expect(svg.querySelectorAll('path.connector-line').length).toBe(3);

    // branch + root have children → data-has-children; leaves do not
    expect(nodeLayer.querySelectorAll('[data-has-children="true"]').length).toBe(2);
    expect(nodeLayer.querySelectorAll('.mind-node:not([data-has-children])').length).toBe(2);
    const branch = nodeLayer.querySelector('[data-has-children="true"][data-kind="branch"]');
    expect(branch).toBeTruthy();
    expect(branch.dataset.kind).toBe('branch');

    // root is prominent, leaves are compact — same component, state-driven
    expect(nodeLayer.querySelector('[data-kind="root"]')).toBeTruthy();

    // position is layout, not visual state
    const first = nodeLayer.querySelector('.mind-node');
    expect(first.style.position).toBe('absolute');
    expect(first.style.left).toBe('0px');

    // status + bottleneck surface as data-* (CSS does the styling)
    expect(nodeLayer.querySelector('.mind-node[data-status="done"][data-bottleneck="risky"]')).toBeTruthy();
    expect(nodeLayer.querySelector('.mind-node[data-status="blocked"]')).toBeTruthy();

    // connectors carry status + child linkage
    const c = svg.querySelector('path.connector-line');
    expect(c.getAttribute('data-status')).toBeTruthy();
    expect(c.getAttribute('data-child-id')).toBeTruthy();
    expect(c.getAttribute('data-link-kind')).toBeTruthy();
  });

  it('calls onToggleCollapse when a branch collapse button is pressed', async () => {
    const nodeLayer = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    let toggled = null;
    renderMindmapNodes(nodeLayer, svg, stubService, 'm', {
      onToggleCollapse: async (id, next) => { toggled = { id, next }; },
    });
    const btn = nodeLayer.querySelector('[data-has-children="true"][data-kind="branch"] .mind-node__collapse');
    expect(btn).toBeTruthy();
    btn.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    // pointerdown handler is async; allow microtask to flush
    await new Promise((r) => setTimeout(r, 0));
    expect(toggled).not.toBeNull();
    expect(toggled.id).toBe('b1');
    expect(toggled.next).toBe(true); // branch is expanded (collapsed=false) → handler passes !collapsed = true
  });
});
