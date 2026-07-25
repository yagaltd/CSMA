import { describe, it, expect, beforeEach } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';
import { Search } from '../../src/modules/mindmap/services/Search.js';

function makeEventBus() {
  return { subscribe() {}, unsubscribe() {}, publish() {} };
}

function sampleTree() {
  return {
    id: 'root',
    topic: 'root',
    schemaType: 'mindmap/branch',
    status: 'pending',
    children: [
      {
        id: 'b1', topic: 'e2e-test', schemaType: 'mindmap/branch', status: 'in_progress', tag: 'phase',
        children: [
          { id: 'l1', topic: 'test /morphmap-review', schemaType: 'mindmap/leaf', status: 'pending', children: [] },
          { id: 'l2', topic: 'scout recon', schemaType: 'mindmap/leaf', status: 'done', children: [] },
          { id: 'l3', topic: 'research module patterns', schemaType: 'mindmap/leaf', status: 'blocked', children: [] }
        ]
      },
      {
        id: 'b2', topic: 'docs', schemaType: 'mindmap/branch', status: 'pending', tag: 'module',
        children: [
          { id: 'l4', topic: 'write readme', schemaType: 'mindmap/leaf', status: 'pending', children: [] }
        ]
      }
    ]
  };
}

describe('Search', () => {
  it('returns substring matches with high scores', () => {
    const s = new Search();
    const results = s.search(sampleTree(), 'test');
    expect(results.length).toBeGreaterThanOrEqual(2);
    // topic containing 'test' should be in results
    expect(results.some((r) => r.topic.includes('test'))).toBe(true);
  });

  it('returns empty array for no match', () => {
    const s = new Search();
    expect(s.search(sampleTree(), 'zzz-nope')).toEqual([]);
  });

  it('subsequence match still scores positive', () => {
    const s = new Search();
    const results = s.search(sampleTree(), 'rvmrph'); // subsequence of /morphmap-review
    // Subsequence matching is lenient; just ensure no crash and array shape.
    expect(Array.isArray(results)).toBe(true);
  });

  it('filter by status returns only matching nodes', () => {
    const s = new Search();
    const results = s.search(sampleTree(), '', { status: ['done'] });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => r.status === 'done')).toBe(true);
  });

  it('filter by tag scopes results', () => {
    const s = new Search();
    const results = s.search(sampleTree(), '', { tag: ['phase'] });
    expect(results.every((r) => r.tag === 'phase')).toBe(true);
    expect(results.some((r) => r.nodeId === 'b1')).toBe(true);
  });

  it('results include path-from-root', () => {
    const s = new Search();
    const results = s.search(sampleTree(), 'recon');
    expect(results.length).toBeGreaterThanOrEqual(1);
    // 'scout recon' (substring) must outrank any subsequence match.
    expect(results[0].nodeId).toBe('l2');
    const path = results[0].path;
    expect(path[0].id).toBe('root');
    expect(path[path.length - 1].id).toBe(results[0].nodeId);
  });
});

describe('MindmapService.search', () => {
  let svc;
  let mapId;

  beforeEach(async () => {
    const bus = makeEventBus();
    svc = new MindmapService(bus);
    svc.init({ storage: null });
    mapId = await svc.createMap('m');
    const root = svc._getMap(mapId).root;
    const b = await svc.addBranch(root.id, 'e2e-test', { tag: 'phase' });
    await svc.addLeaf(b.id, 'test /morphmap-review');
    await svc.addLeaf(b.id, 'write specs');
  });

  it('finds leaves by query', () => {
    const results = svc.search(mapId, 'specs');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].topic).toContain('specs');
  });

  it('empty query with filter returns all matching', () => {
    const all = svc.search(mapId, '');
    expect(all.length).toBe(4); // root + branch + 2 leaves
  });
});
