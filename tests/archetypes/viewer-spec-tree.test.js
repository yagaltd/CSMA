// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewer } from '../../src/modules/archetypes/viewer/viewer.js';

// ─── Canonical DOM serializer (same as foundation.test.js) ──────────
function serialize(node) {
  if (node.nodeType === 3) return { '#text': node.data };
  if (node.nodeType !== 1) return null;
  const attrs = {};
  for (const a of node.attributes) attrs[a.name] = a.value;
  const sorted = {};
  for (const k of Object.keys(attrs).sort()) sorted[k] = attrs[k];
  const kids = [];
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { if (c.data.trim() || kids.length === 0) kids.push({ '#text': c.data }); }
    else if (c.nodeType === 1) kids.push(serialize(c));
  }
  return { t: node.tagName.toLowerCase(), a: sorted, c: kids.length ? kids : undefined };
}

// ─── Shared SVG icon expectations ───────────────────────────────────
const svgEmpty = {
  t: 'svg', a: { 'aria-hidden': 'true', fill: 'none', focusable: 'false', stroke: 'currentColor', 'stroke-width': '1.5', viewBox: '0 0 24 24' },
  c: [
    { t: 'path', a: { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' } },
    { t: 'polyline', a: { points: '14 2 14 8 20 8' } }
  ]
};
const svgError = {
  t: 'svg', a: { 'aria-hidden': 'true', fill: 'none', focusable: 'false', stroke: 'currentColor', 'stroke-width': '1.5', viewBox: '0 0 24 24' },
  c: [
    { t: 'circle', a: { cx: '12', cy: '12', r: '10' } },
    { t: 'line', a: { x1: '12', x2: '12', y1: '8', y2: '12' } },
    { t: 'line', a: { x1: '12', x2: '12.01', y1: '16', y2: '16' } }
  ]
};

// Expected shell structure (always present, regardless of state).
function expectedShell(rootAttrs = {}) {
  return {
    t: 'div', a: { 'aria-label': 'Content viewer', class: 'csma-viewer', role: 'region', ...rootAttrs }, c: [
      { t: 'div', a: { class: 'csma-viewer__content' } },
      { t: 'div', a: { 'aria-live': 'polite', class: 'csma-viewer__state', 'data-state': 'loading', role: 'status' }, c: [
        { t: 'div', a: { class: 'csma-viewer__spinner' } },
        { t: 'span', a: { class: 'csma-viewer__state-message' }, c: [{ '#text': 'Loading…' }] }
      ]},
      { t: 'div', a: { 'aria-live': 'polite', class: 'csma-viewer__state', 'data-state': 'empty', role: 'status' }, c: [
        { t: 'div', a: { class: 'csma-viewer__state-icon' }, c: [svgEmpty] },
        { t: 'span', a: { class: 'csma-viewer__state-message' }, c: [{ '#text': 'Nothing to display' }] }
      ]},
      { t: 'div', a: { 'aria-live': 'assertive', class: 'csma-viewer__state', 'data-state': 'error', role: 'status' }, c: [
        { t: 'div', a: { class: 'csma-viewer__state-icon' }, c: [svgError] },
        { t: 'span', a: { class: 'csma-viewer__state-message' }, c: [{ '#text': 'Failed to load content' }] },
        { t: 'span', a: { class: 'csma-viewer__state-detail' } },
        { t: 'button', a: { class: 'csma-viewer__state-retry' }, c: [{ '#text': 'Retry' }] }
      ]}
    ]
  };
}

// ─── Byte-identical DOM — viewer shell ──────────────────────────────
describe('Phase 3.1-B — viewer byte-identical DOM', () => {
  beforeEach(() => document.body.replaceChildren());

  it('empty-state shell matches canonical structure', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    createViewer(container, vi.fn(), {}); // no fetch → starts empty
    expect(serialize(container.firstChild)).toEqual(expectedShell({ 'data-state': 'empty' }));
  });

  it('loaded-state shell: data-state removed, content populated', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const v = createViewer(container, vi.fn(), {});
    v.update('Hello world');
    const s = serialize(container.firstChild);
    expect(s.a).toEqual({ 'aria-label': 'Content viewer', class: 'csma-viewer', role: 'region' });
    expect(s.c[0]).toEqual({ t: 'div', a: { class: 'csma-viewer__content' }, c: [{ '#text': 'Hello world' }] });
  });

  it('loading-state shell: data-state=loading on root', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const neverResolve = () => new Promise(() => {});
    createViewer(container, vi.fn(), { fetch: neverResolve });
    expect(serialize(container.firstChild)).toEqual(expectedShell({ 'data-state': 'loading' }));
  });
});

// ─── SVG namespace correctness ──────────────────────────────────────
describe('Phase 3.1-B — viewer SVG icons in SVG namespace', () => {
  beforeEach(() => document.body.replaceChildren());

  it('empty + error icons use createElementNS', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    createViewer(container, vi.fn(), {});
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(2); // empty + error icons
    svgs.forEach(svg => {
      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
      svg.querySelectorAll('*').forEach(child => {
        expect(child.namespaceURI).toBe('http://www.w3.org/2000/svg');
      });
    });
  });
});

// ─── Lifecycle ──────────────────────────────────────────────────────
describe('Phase 3.1-B — viewer lifecycle', () => {
  beforeEach(() => document.body.replaceChildren());

  it('destroy removes the root element', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const v = createViewer(container, vi.fn(), {});
    expect(container.querySelector('.csma-viewer')).not.toBeNull();
    v.destroy();
    expect(container.querySelector('.csma-viewer')).toBeNull();
  });

  it('retry button triggers the retry callback', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const v = createViewer(container, vi.fn(), {});
    let retried = false;
    v.retry(() => { retried = true; });
    // retry() without fetch triggers the custom fn directly
    expect(retried).toBe(true);
  });

  it('update with null sets empty state', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const v = createViewer(container, vi.fn(), {});
    v.update(null);
    expect(container.firstChild.dataset.state).toBe('empty');
  });

  it('update with empty string sets empty state', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const v = createViewer(container, vi.fn(), {});
    v.update('   ');
    expect(container.firstChild.dataset.state).toBe('empty');
  });

  it('setLoading(true) sets data-state=loading', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const v = createViewer(container, vi.fn(), {});
    v.update('content');
    v.setLoading(true);
    expect(container.firstChild.dataset.state).toBe('loading');
    v.setLoading(false);
    expect(container.firstChild.hasAttribute('data-state')).toBe(false);
  });

  it('custom render callback populates content', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const v = createViewer(container, vi.fn(), {
      render: (data, el) => { el.textContent = `RENDERED:${data}`; }
    });
    v.update('test-data');
    expect(container.querySelector('.csma-viewer__content').textContent).toBe('RENDERED:test-data');
  });
});

// ─── Convention guard: no raw DOM factories in archetype internals ──
describe('Phase 3.1-B — raw DOM factories forbidden', () => {
  const SOURCES = [
    'src/modules/archetypes/viewer/viewer.js',
    'src/modules/archetypes/stats-dashboard/stats-dashboard.js'
  ];

  for (const rel of SOURCES) {
    it(`${rel} contains no document.createElement / createElementNS`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8');
      // Strip comments so a docstring mentioning createElement does not fail.
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(stripped).not.toMatch(/document\.createElement/);
      expect(stripped).not.toMatch(/createElementNS/);
    });
  }
});
