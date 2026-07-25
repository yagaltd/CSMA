import { describe, it, expect } from 'vitest';
import { layout, DIRECTION, SIDE_LEFT, SIDE_RIGHT } from '../../src/modules/mindmap/services/LayoutEngine.js';

function leaf(id, topic, status = 'pending') {
  return { id, topic, schemaType: 'mindmap/leaf', status, children: [] };
}
function branch(id, topic, children = [], direction = undefined, status = 'pending') {
  return { id, topic, schemaType: 'mindmap/branch', status, children, expanded: true, direction };
}

describe('LayoutEngine', () => {
  it('rejects a missing root', () => {
    expect(() => layout(null)).toThrowError(/root/);
  });

  it('places a single root at origin', () => {
    const root = branch('r', 'root', []);
    const { nodes, links, bounds } = layout(root);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('r');
    expect(nodes[0].x).toBe(0);
    expect(nodes[0].y).toBe(0);
    expect(links).toHaveLength(0);
    expect(bounds.w).toBeGreaterThan(0);
  });

  it('places three branches with SIDE direction and balances left/right', () => {
    const root = branch('r', 'root', [
      branch('a', 'A'),
      branch('b', 'B'),
      branch('c', 'C')
    ]);
    const { nodes, links } = layout(root);
    // root + 3 branches
    expect(nodes).toHaveLength(4);
    expect(links).toHaveLength(3);
    expect(links.every((l) => l.kind === 'main')).toBe(true);
    // Balance favours RIGHT on ties: expect 1 LEFT + 2 RIGHT.
    const leftCount = nodes.filter((n) => n.id !== 'r' && n.direction === SIDE_LEFT).length;
    const rightCount = nodes.filter((n) => n.id !== 'r' && n.direction === SIDE_RIGHT).length;
    expect(leftCount).toBe(1);
    expect(rightCount).toBe(2);
  });

  it('produces non-overlapping rectangles within each column (2D)', () => {
    const root = branch('r', 'root', [
      branch('a', 'A', [leaf('a1', 'a1'), leaf('a2', 'a2'), leaf('a3', 'a3')]),
      branch('b', 'B', [leaf('b1', 'b1'), leaf('b2', 'b2')])
    ]);
    const { nodes } = layout(root);
    // Group nodes by their x column; siblings within a column must not overlap vertically.
    const byColumn = new Map();
    for (const n of nodes) {
      const key = Math.round(n.x);
      if (!byColumn.has(key)) byColumn.set(key, []);
      byColumn.get(key).push(n);
    }
    for (const [, group] of byColumn) {
      const sorted = [...group].sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i].y).toBeGreaterThanOrEqual(sorted[i - 1].y + sorted[i - 1].h);
      }
    }
  });

  it('emits sub links between non-root parents and children', () => {
    const root = branch('r', 'root', [
      branch('a', 'A', [leaf('a1', 'a1')])
    ]);
    const { links } = layout(root);
    const kinds = links.map((l) => l.kind).sort();
    expect(kinds).toEqual(['main', 'sub']);
  });

  it('honours explicit child direction', () => {
    const root = branch('r', 'root', [
      branch('a', 'A', [], SIDE_LEFT),
      branch('b', 'B', [], SIDE_RIGHT)
    ]);
    const { nodes } = layout(root);
    const a = nodes.find((n) => n.id === 'a');
    const b = nodes.find((n) => n.id === 'b');
    expect(a.direction).toBe(SIDE_LEFT);
    expect(b.direction).toBe(SIDE_RIGHT);
    // left side has negative x; right side positive x
    expect(a.x).toBeLessThan(0);
    expect(b.x).toBeGreaterThan(0);
  });

  it('renders a collapsed branch without expanding its children', () => {
    const root = branch('r', 'root', [
      branch('a', 'A', [leaf('a1', 'a1'), leaf('a2', 'a2')], undefined, 'pending')
    ]);
    root.children[0].expanded = false;
    const { nodes } = layout(root);
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'r']);
    const a = nodes.find((n) => n.id === 'a');
    expect(a.collapsed).toBe(true);
    expect(a.hasChildren).toBe(true);
  });

  it('is deterministic — same input → same output nodes', () => {
    const make = () => branch('r', 'root', [
      branch('a', 'A', [leaf('a1', 'a1'), leaf('a2', 'a2')]),
      branch('b', 'B', [leaf('b1', 'b1')])
    ]);
    const out1 = layout(make());
    const out2 = layout(make());
    expect(JSON.stringify(out1.nodes)).toEqual(JSON.stringify(out2.nodes));
    expect(JSON.stringify(out1.links)).toEqual(JSON.stringify(out2.links));
  });

  it('DOWN direction stacks children below root', () => {
    const root = branch('r', 'root', [
      branch('a', 'A'),
      branch('b', 'B')
    ]);
    const { nodes } = layout(root, { direction: DIRECTION.DOWN });
    const r = nodes.find((n) => n.id === 'r');
    const a = nodes.find((n) => n.id === 'a');
    const b = nodes.find((n) => n.id === 'b');
    expect(a.direction).toBeUndefined();
    expect(b.direction).toBeUndefined();
    // Children appear below root: their y is greater than root's y.
    expect(a.y).toBeGreaterThan(r.y);
    expect(b.y).toBeGreaterThan(r.y);
  });
});
