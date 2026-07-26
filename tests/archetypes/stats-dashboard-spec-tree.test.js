// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStatsDashboard } from '../../src/modules/archetypes/stats-dashboard/stats-dashboard.js';

// ─── Canonical DOM serializer ──────────────────────────────────────
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

// ─── Shared SVG icon expectations (trend icons — no stroke/stroke-width) ──
const svgTrendUp = {
  t: 'svg', a: { 'aria-hidden': 'true', fill: 'none', focusable: 'false', viewBox: '0 0 12 12' },
  c: [{ t: 'path', a: { d: 'M6 2L10 7H2L6 2Z', fill: 'currentColor' } }]
};
const svgTrendDown = {
  t: 'svg', a: { 'aria-hidden': 'true', fill: 'none', focusable: 'false', viewBox: '0 0 12 12' },
  c: [{ t: 'path', a: { d: 'M6 10L2 5H10L6 10Z', fill: 'currentColor' } }]
};
const svgTrendNeutral = {
  t: 'svg', a: { 'aria-hidden': 'true', fill: 'none', focusable: 'false', viewBox: '0 0 12 12' },
  c: [{ t: 'rect', a: { x: '2', y: '5', width: '8', height: '2', rx: '1', fill: 'currentColor' } }]
};

function mount(opts) {
  const container = document.createElement('section');
  document.body.appendChild(container);
  return { container, dashboard: createStatsDashboard(container, vi.fn(), opts) };
}

// ─── Byte-identical DOM — shell + state overlays ────────────────────
describe('Phase 3.1-B — stats-dashboard byte-identical DOM', () => {
  beforeEach(() => document.body.replaceChildren());

  it('empty-state shell (no cards) matches canonical structure', () => {
    const { container } = mount({ cards: [] });
    const s = serialize(container.firstChild);
    expect(s.t).toBe('div');
    expect(s.a).toEqual({ 'aria-label': 'Stats dashboard', class: 'csma-stats', 'data-state': 'empty', role: 'region' });
    // grid + charts + 3 state overlays present
    const classes = s.c.map(c => c.a.class);
    expect(classes).toContain('csma-stats__grid');
    expect(classes).toContain('csma-stats__charts');
    expect(classes).toContain('csma-stats__state');
  });

  it('charts container hidden when charts=[]', () => {
    const { container } = mount({ cards: [], charts: [] });
    expect(container.querySelector('.csma-stats__charts').hasAttribute('hidden')).toBe(true);
  });

  it('charts container visible when charts provided', () => {
    const { container } = mount({ cards: [], charts: [{ id: 'c1', label: 'C1' }] });
    expect(container.querySelector('.csma-stats__charts').hasAttribute('hidden')).toBe(false);
  });
});

// ─── Byte-identical DOM — card structures ───────────────────────────
describe('Phase 3.1-B — stats-dashboard card DOM', () => {
  beforeEach(() => document.body.replaceChildren());

  it('card with value: label + value div', () => {
    const { container } = mount({
      cards: [{ id: 'visitors', label: 'Visitors' }]
    });
    const card = serialize(container.querySelector('[data-card-id="visitors"]'));
    expect(card).toEqual({
      t: 'div', a: { class: 'csma-stats__card', 'data-card-id': 'visitors' }, c: [
        { t: 'div', a: { class: 'csma-stats__card-label' }, c: [{ '#text': 'Visitors' }] },
        { t: 'div', a: { class: 'csma-stats__card-value' }, c: [{ '#text': '0' }] }
      ]
    });
  });

  it('card with trend up renders direction dataset + svg + percentage text', () => {
    const { container, dashboard } = mount({
      cards: [{ id: 'sales', label: 'Sales', format: 'currency' }]
    });
    dashboard.update({ sales: { value: 1000, trend: 5 } });
    const card = serialize(container.querySelector('[data-card-id="sales"]'));
    const trend = card.c.find(c => c.a?.class === 'csma-stats__card-trend');
    expect(trend.a['data-direction']).toBe('up');
    expect(trend.c).toEqual([svgTrendUp, { '#text': ' 5%' }]);
  });

  it('card with trend down renders correct direction', () => {
    const { container, dashboard } = mount({
      cards: [{ id: 'churn', label: 'Churn' }]
    });
    dashboard.update({ churn: { value: 3, trend: -2 } });
    const trend = container.querySelector('[data-card-id="churn"] .csma-stats__card-trend');
    expect(trend.dataset.direction).toBe('down');
  });

  it('card with neutral trend (trend=0) renders neutral', () => {
    const { container, dashboard } = mount({
      cards: [{ id: 'flat', label: 'Flat' }]
    });
    dashboard.update({ flat: { value: 42, trend: 0 } });
    const trend = container.querySelector('[data-card-id="flat"] .csma-stats__card-trend');
    expect(trend.dataset.direction).toBe('neutral');
  });

  it('card loading state shows skeleton with 60% width', () => {
    const { container } = mount({
      cards: [{ id: 'async', label: 'Async', fetch: () => new Promise(() => {}) }]
    });
    const skeleton = container.querySelector('[data-card-id="async"] .csma-stats__skeleton');
    expect(skeleton).not.toBeNull();
    expect(skeleton.style.width).toBe('60%');
  });

  it('number formatter localizes', () => {
    const { container, dashboard } = mount({
      cards: [{ id: 'big', label: 'Big', format: 'number' }]
    });
    dashboard.update({ big: { value: 1234567 } });
    expect(container.querySelector('[data-card-id="big"] .csma-stats__card-value').textContent).toBe('1,234,567');
  });

  it('bytes formatter formats correctly', () => {
    const { container, dashboard } = mount({
      cards: [{ id: 'data', label: 'Data', format: 'bytes' }]
    });
    dashboard.update({ data: { value: 1500000 } });
    expect(container.querySelector('[data-card-id="data"] .csma-stats__card-value').textContent).toBe('1.5 MB');
  });

  it('percent formatter formats correctly', () => {
    const { container, dashboard } = mount({
      cards: [{ id: 'rate', label: 'Rate', format: 'percent' }]
    });
    dashboard.update({ rate: { value: 42.5 } });
    expect(container.querySelector('[data-card-id="rate"] .csma-stats__card-value').textContent).toBe('42.5%');
  });
});

// ─── Byte-identical DOM — chart structures ──────────────────────────
describe('Phase 3.1-B — stats-dashboard chart DOM', () => {
  beforeEach(() => document.body.replaceChildren());

  it('chart with summary: label + description paragraph', () => {
    const { container } = mount({
      cards: [],
      charts: [{ id: 'traffic', label: 'Traffic', description: '7-day trend' }]
    });
    const chart = serialize(container.querySelector('[data-chart-id="traffic"]'));
    expect(chart).toEqual({
      t: 'div', a: { class: 'csma-stats__chart', 'data-chart-id': 'traffic' }, c: [
        { t: 'div', a: { class: 'csma-stats__chart-label' }, c: [{ '#text': 'Traffic' }] },
        { t: 'p', a: { class: 'csma-stats__chart-summary' }, c: [{ '#text': '7-day trend' }] }
      ]
    });
  });

  it('chart without description uses fallback label', () => {
    const { container } = mount({
      cards: [],
      charts: [{ id: 'revenue', label: 'Revenue' }]
    });
    const summary = container.querySelector('[data-chart-id="revenue"] .csma-stats__chart-summary');
    expect(summary.textContent).toBe('Chart: Revenue');
  });

  it('renderChart callback DOM replaces the summary <p>', () => {
    const { container } = mount({
      cards: [],
      charts: [{ id: 'custom', label: 'Custom' }],
      renderChart: () => {
        const node = document.createElement('output');
        node.className = 'my-chart';
        node.textContent = 'rendered';
        return node;
      }
    });
    expect(container.querySelector('[data-chart-id="custom"] .csma-stats__chart-summary')).toBeNull();
    expect(container.querySelector('[data-chart-id="custom"] .my-chart').textContent).toBe('rendered');
  });

  it('renderChart receives the chart container', () => {
    let receivedContainer;
    mount({
      cards: [],
      charts: [{ id: 'c', label: 'C' }],
      renderChart: (_def, { container: chartContainer }) => {
        receivedContainer = chartContainer;
        return document.createElement('div');
      }
    });
    expect(receivedContainer.dataset.chartId).toBe('c');
  });
});

// ─── SVG namespace correctness ──────────────────────────────────────
describe('Phase 3.1-B — stats-dashboard SVG namespace', () => {
  beforeEach(() => document.body.replaceChildren());

  it('trend icon SVG + children use SVG namespace', () => {
    const { container, dashboard } = mount({
      cards: [{ id: 't', label: 'T' }]
    });
    dashboard.update({ t: { value: 1, trend: 1 } });
    const svg = container.querySelector('.csma-stats__card-trend svg');
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.querySelector('path').namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});

// ─── Lifecycle ──────────────────────────────────────────────────────
describe('Phase 3.1-B — stats-dashboard lifecycle', () => {
  beforeEach(() => document.body.replaceChildren());

  it('destroy removes root', () => {
    const { container, dashboard } = mount({ cards: [{ id: 'x', label: 'X' }] });
    expect(container.querySelector('.csma-stats')).not.toBeNull();
    dashboard.destroy();
    expect(container.querySelector('.csma-stats')).toBeNull();
  });

  it('update replaces card data', () => {
    const { container, dashboard } = mount({
      cards: [{ id: 'v', label: 'V' }]
    });
    dashboard.update({ v: { value: 100 } });
    expect(container.querySelector('[data-card-id="v"] .csma-stats__card-value').textContent).toBe('100');
    dashboard.update({ v: { value: 200 } });
    expect(container.querySelector('[data-card-id="v"] .csma-stats__card-value').textContent).toBe('200');
  });

  it('getData returns current card data', () => {
    const { dashboard } = mount({ cards: [{ id: 'g', label: 'G' }] });
    dashboard.update({ g: { value: 42 } });
    expect(dashboard.getData().g.value).toBe(42);
  });
});
