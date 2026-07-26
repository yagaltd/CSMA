// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIUIComposerService } from '../../src/modules/ai-ui/services/AIUIComposerService.js';
import { createNavTabs } from '../../src/modules/archetypes/nav-tabs/nav-tabs.js';
import { createOverlayManager } from '../../src/modules/archetypes/overlay-manager/overlay-manager.js';

// ──────────────────────────────────────────────────────────────────
// Canonical DOM serializer — deterministic (attributes sorted by name).
// Captures tag, attributes, direct text, and children recursively. This is
// the byte-identical proof: two implementations producing the same canonical
// serialization have identical DOM (modulo attribute order, which is not
// semantically meaningful). SVG namespace correctness is verified separately.
// ──────────────────────────────────────────────────────────────────
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

// Expected SVG icon block (shared by arrow + close icons).
const svgArrow = (points) => ({
  t: 'svg',
  a: { 'aria-hidden': 'true', fill: 'none', focusable: 'false', stroke: 'currentColor', 'stroke-width': '1.5', viewBox: '0 0 12 12' },
  c: [{ t: 'polyline', a: { points } }]
});
const svgClose = {
  t: 'svg',
  a: { 'aria-hidden': 'true', fill: 'none', focusable: 'false', stroke: 'currentColor', 'stroke-width': '1.5', viewBox: '0 0 12 12' },
  c: [
    { t: 'line', a: { x1: '3', x2: '9', y1: '3', y2: '9' } },
    { t: 'line', a: { x1: '9', x2: '3', y1: '3', y2: '9' } }
  ]
};

const NAVTABS_CONFIG = {
  tabs: [
    { id: 'home', label: 'Home', active: true, badge: 5 },
    { id: 'search', label: 'Search' },
    { id: 'profile', label: 'Profile', badge: 0 }
  ],
  closable: true
};

function mountNavTabs() {
  const container = document.createElement('section');
  document.body.appendChild(container);
  return { container, navtabs: createNavTabs(container, vi.fn(), NAVTABS_CONFIG) };
}

// ──────────────────────────────────────────────────────────────────
// Byte-identical DOM — nav-tabs
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.0 foundation — nav-tabs byte-identical DOM', () => {
  beforeEach(() => document.body.replaceChildren());

  it('produces canonical DOM identical to the pre-conversion implementation', () => {
    const { container } = mountNavTabs();
    const expected = {
      t: 'section', a: {}, c: [{
        t: 'div', a: { 'aria-label': 'Navigation tabs', class: 'csma-navtabs', role: 'tablist' }, c: [
          { t: 'button', a: { 'aria-label': 'Scroll tabs left', class: 'csma-navtabs__arrow csma-navtabs__arrow--left' }, c: [svgArrow('8 2 4 6 8 10')] },
          { t: 'div', a: { class: 'csma-navtabs__scroll' }, c: [
            { t: 'div', a: { 'aria-selected': 'true', class: 'csma-navtabs__tab', 'data-tab-id': 'home', role: 'tab', tabindex: '0' }, c: [
              { t: 'span', a: {}, c: [{ '#text': 'Home' }] },
              { t: 'span', a: { class: 'csma-navtabs__tab-badge' }, c: [{ '#text': '5' }] },
              { t: 'button', a: { 'aria-label': 'Close Home', class: 'csma-navtabs__close' }, c: [svgClose] }
            ]},
            { t: 'div', a: { class: 'csma-navtabs__tab', 'data-tab-id': 'search', role: 'tab', tabindex: '-1' }, c: [
              { t: 'span', a: {}, c: [{ '#text': 'Search' }] },
              { t: 'button', a: { 'aria-label': 'Close Search', class: 'csma-navtabs__close' }, c: [svgClose] }
            ]},
            { t: 'div', a: { class: 'csma-navtabs__tab', 'data-tab-id': 'profile', role: 'tab', tabindex: '-1' }, c: [
              { t: 'span', a: {}, c: [{ '#text': 'Profile' }] },
              { t: 'span', a: { class: 'csma-navtabs__tab-badge' }, c: [{ '#text': '0' }] },
              { t: 'button', a: { 'aria-label': 'Close Profile', class: 'csma-navtabs__close' }, c: [svgClose] }
            ]}
          ]},
          { t: 'button', a: { 'aria-label': 'Scroll tabs right', class: 'csma-navtabs__arrow csma-navtabs__arrow--right' }, c: [svgArrow('4 2 8 6 4 10')] }
        ]
      }]
    };
    expect(serialize(container)).toEqual(expected);
  });
});

// ──────────────────────────────────────────────────────────────────
// Byte-identical DOM — overlay-manager (modal / drawer / lightbox)
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.0 foundation — overlay-manager byte-identical DOM', () => {
  beforeEach(() => document.body.replaceChildren());

  it('modal shell matches the pre-conversion implementation', () => {
    const om = createOverlayManager(document.createElement('section'), vi.fn());
    om.openModal('Body text', { title: 'Modal Title', closable: true, footer: 'Foot' });
    const expected = {
      t: 'div', a: { 'aria-label': 'Modal Title', 'aria-modal': 'true', class: 'csma-overlay-modal', role: 'dialog' }, c: [
        { t: 'div', a: { class: 'csma-overlay-header' }, c: [
          { t: 'span', a: {}, c: [{ '#text': 'Modal Title' }] },
          { t: 'button', a: { 'aria-label': 'Close', class: 'csma-overlay-close' }, c: [{ '#text': '×' }] }
        ]},
        { t: 'div', a: { class: 'csma-overlay-body' }, c: [{ '#text': 'Body text' }] },
        { t: 'div', a: { class: 'csma-overlay-footer' }, c: [{ '#text': 'Foot' }] }
      ]
    };
    expect(serialize(document.querySelector('.csma-overlay-modal'))).toEqual(expected);
    om.destroy();
  });

  it('drawer shell matches the pre-conversion implementation', () => {
    const om = createOverlayManager(document.createElement('section'), vi.fn());
    om.openDrawer('Drawer body', { title: 'Settings', closable: true });
    const expected = {
      t: 'div', a: { 'aria-label': 'Settings', 'aria-modal': 'true', class: 'csma-overlay-drawer', role: 'dialog' }, c: [
        { t: 'div', a: { class: 'csma-overlay-header' }, c: [
          { t: 'span', a: {}, c: [{ '#text': 'Settings' }] },
          { t: 'button', a: { 'aria-label': 'Close', class: 'csma-overlay-close' }, c: [{ '#text': '×' }] }
        ]},
        { t: 'div', a: { class: 'csma-overlay-body' }, c: [{ '#text': 'Drawer body' }] }
      ]
    };
    expect(serialize(document.querySelector('.csma-overlay-drawer'))).toEqual(expected);
    om.destroy();
  });

  it('lightbox shell matches the pre-conversion implementation', () => {
    const om = createOverlayManager(document.createElement('section'), vi.fn());
    om.openLightbox('https://example.com/x.png', { alt: 'Pic' });
    const expected = {
      t: 'div', a: { 'aria-label': 'Pic', class: 'csma-overlay-lightbox', role: 'dialog' }, c: [
        { t: 'img', a: { alt: 'Pic', src: 'https://example.com/x.png' } },
        { t: 'button', a: { 'aria-label': 'Close', class: 'csma-overlay-close' }, c: [{ '#text': '×' }] }
      ]
    };
    expect(serialize(document.querySelector('.csma-overlay-lightbox'))).toEqual(expected);
    om.destroy();
  });

  it('renders tag-like modal strings as literal text (no XSS)', () => {
    const literal = '<img src=x onerror=alert(1)>';
    const om = createOverlayManager(document.createElement('section'), vi.fn());
    const { el } = om.openModal(literal, { title: 'Unsafe content' });
    const body = el.querySelector('.csma-overlay-body');
    expect(body.textContent).toBe(literal);
    expect(body.querySelector('img')).toBeNull();
    expect(document.body.querySelector('img')).toBeNull();
    om.destroy();
  });
});

// ──────────────────────────────────────────────────────────────────
// Lifecycle through the new pipeline
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.0 foundation — archetype lifecycle', () => {
  beforeEach(() => document.body.replaceChildren());

  it('nav-tabs: setActive / update / addTab / removeTab / destroy', () => {
    const { container, navtabs } = mountNavTabs();
    const tab = (id) => container.querySelector(`[data-tab-id="${id}"]`);

    navtabs.setActive('search');
    expect(tab('search').getAttribute('aria-selected')).toBe('true');
    expect(tab('home').getAttribute('aria-selected')).toBeNull();
    expect(navtabs.getActive()).toBe('search');

    navtabs.addTab({ id: 'new', label: 'New' });
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(4);

    navtabs.removeTab('search');
    expect(tab('search')).toBeNull();
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3);

    navtabs.update([{ id: 'only', label: 'Only', active: true }]);
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1);
    expect(navtabs.getActive()).toBe('only');

    navtabs.destroy();
    expect(container.querySelector('.csma-navtabs')).toBeNull();
  });

  it('nav-tabs: emits select intent on tab click', () => {
    const emit = vi.fn();
    const container = document.createElement('section');
    createNavTabs(container, emit, { tabs: [{ id: 'a', label: 'A' }] });
    container.querySelector('[data-tab-id="a"]').click();
    expect(emit).toHaveBeenCalledWith('navtabs:select', expect.objectContaining({ id: 'a' }));
  });

  it('overlay-manager: openModal → closeAll → destroy tears down backdrop', () => {
    const om = createOverlayManager(document.createElement('section'), vi.fn());
    om.openModal('hi', { title: 'T' });
    expect(document.querySelector('.csma-overlay-modal')).not.toBeNull();
    expect(document.querySelector('.csma-overlay-backdrop')).not.toBeNull();
    om.destroy();
    expect(document.querySelector('.csma-overlay-modal')).toBeNull();
    expect(document.querySelector('.csma-overlay-backdrop')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// SVG composes through mountTree (namespace + attributes)
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.0 foundation — mountTree SVG support', () => {
  beforeEach(() => document.body.replaceChildren());

  it('creates svg/line/polyline in the SVG namespace', () => {
    const composer = new AIUIComposerService(null);
    const { root } = composer.mountTree({
      tag: 'button', children: [{
        tag: 'svg', attrs: { viewBox: '0 0 12 12', 'aria-hidden': 'true' }, children: [
          { tag: 'polyline', attrs: { points: '1 2 3 4' } }
        ]
      }]
    });
    const svg = root.querySelector('svg');
    const poly = root.querySelector('polyline');
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(poly.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 12 12');
    expect(poly.getAttribute('points')).toBe('1 2 3 4');
  });

  it('renders nav-tabs arrow icons in the SVG namespace', () => {
    const { container } = mountNavTabs();
    const svg = container.querySelector('.csma-navtabs__arrow svg');
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.querySelector('polyline').namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});

// ──────────────────────────────────────────────────────────────────
// SAFE_TAGS / SAFE_ATTRIBUTES still enforced (no regression from SVG addition)
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.0 foundation — security boundary intact', () => {
  it('mountTree still rejects script/iframe/style and onclick/style attrs', () => {
    const composer = new AIUIComposerService(null);
    for (const tag of ['script', 'iframe', 'style']) {
      expect(() => composer.mountTree({ tag })).toThrow(/Unsafe tag/);
    }
    expect(() => composer.mountTree({ tag: 'div', attrs: { onclick: 'x()' } })).toThrow(/Unsafe attribute "onclick"/);
    expect(() => composer.mountTree({ tag: 'div', attrs: { style: 'color:red' } })).toThrow(/Unsafe attribute "style"/);
  });

  it('mountTree accepts SVG presentation attributes but still rejects event handlers on svg', () => {
    const composer = new AIUIComposerService(null);
    const { root } = composer.mountTree({
      tag: 'svg', attrs: { viewBox: '0 0 10 10', stroke: 'red', 'stroke-width': '2' }
    });
    expect(root.getAttribute('stroke')).toBe('red');
    expect(() => composer.mountTree({ tag: 'svg', attrs: { onload: 'x()' } })).toThrow(/Unsafe attribute "onload"/);
  });
});

// ──────────────────────────────────────────────────────────────────
// Convention guard: no raw document.createElement in archetype internals
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.0 foundation — raw DOM factories forbidden in archetype internals', () => {
  const SOURCES = [
    'src/modules/archetypes/nav-tabs/nav-tabs.js',
    'src/modules/archetypes/overlay-manager/overlay-manager.js'
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
