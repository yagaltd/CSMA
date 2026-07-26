// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { initDock } from '../../src/modules/slides/chrome/dock.js';
import { initGrid } from '../../src/modules/slides/chrome/grid.js';
import { initRail } from '../../src/modules/slides/chrome/rail.js';
import { initPresenter } from '../../src/modules/slides/chrome/presenter.js';
// Legacy raw-DOM helper — the INDEPENDENT golden reference (built from
// document.createElement, not the spec pipeline under test). Each golden
// builder below mirrors the original (pre-Phase-3.2) chrome construction
// verbatim; the converted chrome modules now build the same DOM via spec +
// mountTree. We assert byte-identical serialization.
import { el } from './fixtures/legacy-dom-helpers.js';

const TIMER_KEY = 'csma-slides-timer-start';

// ──────────────────────────────────────────────────────────────────
// Canonical DOM serializer — deterministic (attributes sorted by name).
// Same as tests/archetypes/foundation.test.js: two implementations producing
// the same canonical serialization have identical DOM (modulo attribute order).
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

// ──────────────────────────────────────────────────────────────────
// Shared fixtures + helpers (mirroring the original chrome internals).
// ──────────────────────────────────────────────────────────────────
const TOOL_DEFS = [
  { label: 'Toggle sidebar', symbol: '☰', intent: 'INTENT_SLIDE_TOGGLE_RAIL' },
  { label: 'Toggle grid',    symbol: '▦', intent: 'INTENT_SLIDE_TOGGLE_GRID' },
  { label: 'Toggle comments on current slide (Phase 2.2)', symbol: '💬', intent: 'INTENT_SLIDE_TOGGLE_COMMENTS' },
  { label: 'Toggle drawing', symbol: '✎', intent: 'INTENT_SLIDE_TOGGLE_DRAWING' },
  { label: 'Fullscreen',     symbol: '⛶', intent: 'INTENT_SLIDE_TOGGLE_FS' },
  { label: 'Presenter',      symbol: '📺', intent: 'INTENT_SLIDE_OPEN_PRESENTER' },
  { label: 'Hide UI',        symbol: '◉', intent: 'INTENT_SLIDE_HIDE_UI' }
];

function formatCounter(slide, total) {
  const s = Number.isFinite(slide) ? slide + 1 : 1;
  const t = Number.isFinite(total) ? total : 0;
  return s + ' / ' + t;
}

function goldenLabelFor(service, idx) {
  const i = Number.isFinite(idx) ? idx : service.index;
  if (i < 0 || i >= service.slides.length) return '(end)';
  const slide = service.slides[i];
  return slide?.title || slide?.type || ('slide ' + (i + 1));
}

function makeService(overrides = {}) {
  return {
    index: 0,
    slides: [{ type: 'cover' }, { type: 'split' }],
    isPresenter: false,
    getNote: () => '',
    ...overrides
  };
}

const NOOP_BUS = { subscribe: () => () => {}, publish: () => {} };

function mountBoth(goldenBuilder, initFn) {
  const service = makeService();
  const actualHost = document.createElement('div');
  document.body.appendChild(actualHost);
  const cleanup = initFn(actualHost, NOOP_BUS, service);

  const goldenHost = document.createElement('div');
  document.body.appendChild(goldenHost);
  goldenHost.appendChild(goldenBuilder(service));

  return { actualHost, goldenHost, cleanup };
}

// ──────────────────────────────────────────────────────────────────
// Golden builders — exact mirror of the pre-Phase-3.2 chrome construction.
// ──────────────────────────────────────────────────────────────────
function goldenDock(service) {
  const dock = el('div', { className: 'noir-dock', attrs: { role: 'toolbar', 'aria-label': 'Slide controls' } });
  const counter = el('span', { className: 'dock-counter', text: formatCounter(service.index, service.slides.length) });
  dock.appendChild(el('button', { className: 'dock-btn', text: '←', attrs: { 'aria-label': 'Previous slide' }, dataset: { intent: 'INTENT_SLIDE_PREV' } }));
  dock.appendChild(counter);
  dock.appendChild(el('button', { className: 'dock-btn', text: '→', attrs: { 'aria-label': 'Next slide' }, dataset: { intent: 'INTENT_SLIDE_NEXT' } }));
  const tools = el('div', { className: 'dock-tools' });
  for (const t of TOOL_DEFS) {
    tools.appendChild(el('button', {
      className: 'dock-btn',
      text: t.symbol,
      attrs: { 'aria-label': t.label, 'title': t.label },
      dataset: { intent: t.intent }
    }));
  }
  dock.appendChild(tools);
  return dock;
}

function goldenGrid(service) {
  const grid = el('div', { className: 'slide-grid', attrs: { 'aria-label': 'Slide overview' } });
  grid.dataset.open = 'false';
  const inner = el('div', { className: 'grid-inner' });
  grid.appendChild(inner);
  const slides = Array.isArray(service.slides) ? service.slides : [];
  slides.forEach((slide, i) => {
    const card = el('button', {
      className: 'grid-card',
      dataset: { index: String(i), active: i === service.index ? 'true' : 'false' }
    });
    const label = slide?.type ? slide.type : ('slide ' + (i + 1));
    card.appendChild(el('span', { className: 'grid-thumb', text: String(label) }));
    card.appendChild(el('span', { className: 'grid-num', text: String(i + 1) }));
    inner.appendChild(card);
  });
  return grid;
}

function goldenRail(service) {
  const rail = el('aside', { className: 'slide-rail', attrs: { 'aria-label': 'Slide thumbnails' } });
  rail.dataset.open = 'false';
  const list = el('ol', { className: 'rail-list' });
  rail.appendChild(list);
  const slides = Array.isArray(service.slides) ? service.slides : [];
  slides.forEach((slide, i) => {
    const li = el('li', {
      className: 'rail-item',
      dataset: { index: String(i), active: i === service.index ? 'true' : 'false' }
    });
    const label = slide?.type ? slide.type : ('slide ' + (i + 1));
    li.appendChild(el('span', { className: 'rail-thumb', text: String(label) }));
    li.appendChild(el('span', { className: 'rail-num', text: String(i + 1) }));
    list.appendChild(li);
  });
  return rail;
}

function goldenPresenter(service) {
  const overlay = el('div', { className: 'presenter-overlay' });
  const current = el('section', { className: 'presenter-current' });
  current.appendChild(el('p', { className: 'kicker', text: 'Current' }));
  const currentLabel = el('p', { className: 'presenter-slide-label', text: goldenLabelFor(service) });
  current.appendChild(currentLabel);
  const next = el('section', { className: 'presenter-next' });
  next.appendChild(el('p', { className: 'kicker', text: 'Next' }));
  const nextLabel = el('p', { className: 'presenter-slide-label', text: goldenLabelFor(service, service.index + 1) });
  next.appendChild(nextLabel);
  const notesWrap = el('section', { className: 'presenter-notes' });
  notesWrap.appendChild(el('label', {
    className: 'presenter-notes-label',
    text: 'Notes',
    attrs: { for: 'csma-presenter-notes' }
  }));
  const textarea = el('textarea', {
    className: 'presenter-notes-input',
    attrs: { id: 'csma-presenter-notes', maxlength: '5000', placeholder: 'Add talking points for this slide…' }
  });
  notesWrap.appendChild(textarea);
  const timerWrap = el('section', { className: 'presenter-timer' });
  const timerDisplay = el('p', { className: 'presenter-timer-display', text: '00:00' });
  timerWrap.appendChild(timerDisplay);
  overlay.appendChild(current);
  overlay.appendChild(next);
  overlay.appendChild(notesWrap);
  overlay.appendChild(timerWrap);
  return overlay;
}

// ──────────────────────────────────────────────────────────────────
// Byte-identical assertions — each chrome module
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.2 — slides chrome byte-identical DOM', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    try { window.localStorage?.removeItem(TIMER_KEY); } catch { /* noop */ }
  });

  it('initDock mounts DOM byte-identical to the pre-conversion el() chrome', () => {
    const { actualHost, goldenHost, cleanup } = mountBoth(goldenDock, initDock);
    expect(serialize(actualHost)).toEqual(serialize(goldenHost));
    cleanup();
  });

  it('initGrid mounts DOM byte-identical to the pre-conversion el() chrome', () => {
    const { actualHost, goldenHost, cleanup } = mountBoth(goldenGrid, initGrid);
    expect(serialize(actualHost)).toEqual(serialize(goldenHost));
    cleanup();
  });

  it('initRail mounts DOM byte-identical to the pre-conversion el() chrome', () => {
    const { actualHost, goldenHost, cleanup } = mountBoth(goldenRail, initRail);
    expect(serialize(actualHost)).toEqual(serialize(goldenHost));
    cleanup();
  });

  it('initPresenter mounts DOM byte-identical to the pre-conversion el() chrome', () => {
    const { actualHost, goldenHost, cleanup } = mountBoth(goldenPresenter, initPresenter);
    expect(serialize(actualHost)).toEqual(serialize(goldenHost));
    cleanup();
  });
});

// ──────────────────────────────────────────────────────────────────
// Lifecycle — chrome wires through the composer and cleans up on teardown.
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.2 — slides chrome lifecycle', () => {
  beforeEach(() => document.body.replaceChildren());

  it('initDock teardown detaches the dock from its host', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const cleanup = initDock(host, NOOP_BUS, makeService());
    expect(host.querySelector('.noir-dock')).not.toBeNull();
    cleanup();
    expect(host.querySelector('.noir-dock')).toBeNull();
  });

  it('initGrid teardown detaches the grid from its host', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const cleanup = initGrid(host, NOOP_BUS, makeService());
    expect(host.querySelector('.slide-grid')).not.toBeNull();
    cleanup();
    expect(host.querySelector('.slide-grid')).toBeNull();
  });

  it('initRail teardown detaches the rail from its host', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const cleanup = initRail(host, NOOP_BUS, makeService());
    expect(host.querySelector('.slide-rail')).not.toBeNull();
    cleanup();
    expect(host.querySelector('.slide-rail')).toBeNull();
  });
});
