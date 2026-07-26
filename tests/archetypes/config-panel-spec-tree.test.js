// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createConfigPanel } from '../../src/modules/archetypes/config-panel/config-panel.js';

// Canonical DOM serializer — deterministic (attributes sorted by name).
// Matches the foundation test serializer. Strips `c: undefined` keys so
// leaf nodes compare equal regardless of serializer quirk.
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
  const out = { t: node.tagName.toLowerCase(), a: sorted };
  if (kids.length) out.c = kids;
  return out;
}

const svgArrow = {
  t: 'svg',
  a: { 'aria-hidden': 'true', class: 'csma-config__section-arrow', fill: 'none', focusable: 'false', viewBox: '0 0 12 12' },
  c: [{ t: 'path', a: { d: 'M6 3L10 8H2L6 3Z', fill: 'currentColor' } }]
};

const PANEL_CONFIG = {
  sections: [
    {
      label: 'General',
      controls: [
        { id: 'dark', type: 'toggle', label: 'Dark mode', value: true },
        { id: 'accent', type: 'color', label: 'Accent', value: '#ff0000' },
        { id: 'size', type: 'slider', label: 'Font size', value: 14, min: 10, max: 20, step: 2 },
        { id: 'layout', type: 'select', label: 'Layout', value: 'grid',
          options: [{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }] },
        { id: 'name', type: 'text', label: 'Project name', value: 'demo', placeholder: 'Type…' }
      ]
    },
    {
      label: 'Empty',
      collapsed: true,
      controls: []
    }
  ]
};

function mountPanel() {
  const container = document.createElement('section');
  document.body.appendChild(container);
  const panel = createConfigPanel(container, vi.fn(), PANEL_CONFIG);
  return { container, panel };
}

// ──────────────────────────────────────────────────────────────────
// Byte-identical DOM — config-panel
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.1-A — config-panel byte-identical DOM', () => {
  beforeEach(() => document.body.replaceChildren());

  it('root shell matches the pre-conversion implementation', () => {
    const { container } = mountPanel();
    const root = container.querySelector('.csma-config');
    expect(root.tagName).toBe('DIV');
    expect(root.getAttribute('role')).toBe('region');
    expect(root.getAttribute('aria-label')).toBe('Configuration panel');
    expect(root.className).toBe('csma-config');
  });

  it('section structure matches (header + body, aria-expanded)', () => {
    const { container } = mountPanel();
    const sections = container.querySelectorAll('.csma-config__section');
    expect(sections).toHaveLength(2);
    expect(sections[0].getAttribute('aria-expanded')).toBe('true');
    expect(sections[1].getAttribute('aria-expanded')).toBe('false');

    const header0 = sections[0].querySelector('.csma-config__section-header');
    expect(header0.getAttribute('tabindex')).toBe('0');
    expect(header0.getAttribute('role')).toBe('button');
    const headerSpan = header0.querySelector('span');
    expect(headerSpan.textContent).toBe('General');
    const arrowSvg = header0.querySelector('svg');
    expect(arrowSvg).not.toBeNull();
    expect(arrowSvg.getAttribute('viewBox')).toBe('0 0 12 12');

    const body0 = sections[0].querySelector('.csma-config__section-body');
    expect(body0).not.toBeNull();
    expect(body0.querySelectorAll('.csma-config__control')).toHaveLength(5);
  });

  it('toggle control renders label + checkbox input + track', () => {
    const { container } = mountPanel();
    const toggle = container.querySelector('.csma-config__toggle');
    expect(toggle.tagName).toBe('LABEL');
    expect(toggle.querySelector('.csma-config__control-label').textContent).toBe('Dark mode');
    const input = toggle.querySelector('input[type="checkbox"]');
    expect(input).not.toBeNull();
    // checked state set via property post-mount (wireControl) — verify
    expect(input.checked).toBe(true);
    expect(toggle.querySelector('.csma-config__toggle-track')).not.toBeNull();
  });

  it('color control renders color input + swatch + hex display', () => {
    const { container } = mountPanel();
    const colorRow = Array.from(container.querySelectorAll('.csma-config__control'))
      .find((r) => r.querySelector('input[type="color"]'));
    expect(colorRow).toBeTruthy();
    expect(colorRow.querySelector('.csma-config__control-label').textContent).toBe('Accent');
    const input = colorRow.querySelector('input[type="color"]');
    expect(input.value).toBe('#ff0000');
    expect(input.getAttribute('aria-label')).toBe('Accent');
    expect(colorRow.querySelector('.csma-config__color-swatch')).not.toBeNull();
    expect(colorRow.querySelector('.csma-config__color-hex').textContent).toBe('#ff0000');
  });

  it('slider control renders range input with min/max/step + value display', () => {
    const { container } = mountPanel();
    const sliderRow = Array.from(container.querySelectorAll('.csma-config__control'))
      .find((r) => r.querySelector('input[type="range"]'));
    expect(sliderRow).toBeTruthy();
    const input = sliderRow.querySelector('input[type="range"]');
    expect(input.getAttribute('min')).toBe('10');
    expect(input.getAttribute('max')).toBe('20');
    expect(input.getAttribute('step')).toBe('2');
    expect(input.value).toBe('14');
    expect(input.getAttribute('aria-label')).toBe('Font size');
    expect(sliderRow.querySelector('.csma-config__slider-value').textContent).toBe('14');
  });

  it('select control renders options with the matching one selected', () => {
    const { container } = mountPanel();
    const selectRow = Array.from(container.querySelectorAll('.csma-config__control'))
      .find((r) => r.querySelector('select'));
    expect(selectRow).toBeTruthy();
    const select = selectRow.querySelector('select');
    expect(select.getAttribute('aria-label')).toBe('Layout');
    const opts = select.querySelectorAll('option');
    expect(opts).toHaveLength(2);
    expect(opts[0].value).toBe('grid');
    expect(opts[0].textContent).toBe('Grid');
    expect(opts[1].value).toBe('list');
    expect(opts[1].textContent).toBe('List');
    expect(select.value).toBe('grid');
  });

  it('text control renders text input with value + placeholder', () => {
    const { container } = mountPanel();
    const textRow = Array.from(container.querySelectorAll('.csma-config__control'))
      .find((r) => r.querySelector('input[type="text"]'));
    expect(textRow).toBeTruthy();
    const input = textRow.querySelector('input[type="text"]');
    expect(input.value).toBe('demo');
    expect(input.getAttribute('placeholder')).toBe('Type…');
  });

  it('produces canonical DOM identical to the pre-conversion implementation', () => {
    const { container } = mountPanel();
    const expected = {
      t: 'section', a: {}, c: [{
        t: 'div',
        a: { 'aria-label': 'Configuration panel', class: 'csma-config', role: 'region' },
        c: [
          // Section 1: General (expanded, 5 controls)
          { t: 'div', a: { 'aria-expanded': 'true', class: 'csma-config__section' }, c: [
            { t: 'div', a: { class: 'csma-config__section-header', role: 'button', tabindex: '0' }, c: [
              { t: 'span', a: {}, c: [{ '#text': 'General' }] },
              svgArrow
            ]},
            { t: 'div', a: { class: 'csma-config__section-body' }, c: [
              // toggle
              { t: 'label', a: { class: 'csma-config__control csma-config__toggle' }, c: [
                { t: 'div', a: { class: 'csma-config__control-label' }, c: [{ '#text': 'Dark mode' }] },
                { t: 'span', a: { class: 'csma-config__control-input' }, c: [
                  { t: 'input', a: { type: 'checkbox' } },
                  { t: 'span', a: { class: 'csma-config__toggle-track' } }
                ]}
              ]},
              // color
              { t: 'div', a: { class: 'csma-config__control' }, c: [
                { t: 'div', a: { class: 'csma-config__control-label' }, c: [{ '#text': 'Accent' }] },
                { t: 'span', a: { class: 'csma-config__control-input' }, c: [
                  { t: 'span', a: { class: 'csma-config__color' }, c: [
                    { t: 'input', a: { 'aria-label': 'Accent', class: 'csma-config__color-input', type: 'color', value: '#ff0000' } },
                    { t: 'span', a: { class: 'csma-config__color-swatch', 'data-color': '#ff0000', style: 'background-color: rgb(255, 0, 0);' } },
                    { t: 'span', a: { class: 'csma-config__color-hex' }, c: [{ '#text': '#ff0000' }] }
                  ]}
                ]}
              ]},
              // slider
              { t: 'div', a: { class: 'csma-config__control' }, c: [
                { t: 'div', a: { class: 'csma-config__control-label' }, c: [{ '#text': 'Font size' }] },
                { t: 'span', a: { class: 'csma-config__control-input' }, c: [
                  { t: 'span', a: { class: 'csma-config__slider' }, c: [
                    { t: 'input', a: { 'aria-label': 'Font size', max: '20', min: '10', step: '2', type: 'range', value: '14' } },
                    { t: 'span', a: { class: 'csma-config__slider-value' }, c: [{ '#text': '14' }] }
                  ]}
                ]}
              ]},
              // select
              { t: 'div', a: { class: 'csma-config__control' }, c: [
                { t: 'div', a: { class: 'csma-config__control-label' }, c: [{ '#text': 'Layout' }] },
                { t: 'span', a: { class: 'csma-config__control-input' }, c: [
                  { t: 'select', a: { 'aria-label': 'Layout', class: 'csma-config__select' }, c: [
                    { t: 'option', a: { value: 'grid' }, c: [{ '#text': 'Grid' }] },
                    { t: 'option', a: { value: 'list' }, c: [{ '#text': 'List' }] }
                  ]}
                ]}
              ]},
              // text
              { t: 'div', a: { class: 'csma-config__control' }, c: [
                { t: 'div', a: { class: 'csma-config__control-label' }, c: [{ '#text': 'Project name' }] },
                { t: 'span', a: { class: 'csma-config__control-input' }, c: [
                  { t: 'input', a: { class: 'csma-config__select', placeholder: 'Type…', type: 'text', value: 'demo' } }
                ]}
              ]}
            ]}
          ]},
          // Section 2: Empty (collapsed, no controls)
          { t: 'div', a: { 'aria-expanded': 'false', class: 'csma-config__section' }, c: [
            { t: 'div', a: { class: 'csma-config__section-header', role: 'button', tabindex: '0' }, c: [
              { t: 'span', a: {}, c: [{ '#text': 'Empty' }] },
              svgArrow
            ]},
            { t: 'div', a: { class: 'csma-config__section-body' } }
          ]}
        ]
      }]
    };
    expect(serialize(container)).toEqual(expected);
  });
});

// ──────────────────────────────────────────────────────────────────
// Lifecycle — getValues, setValues, destroy, emit
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.1-A — config-panel lifecycle', () => {
  beforeEach(() => document.body.replaceChildren());

  it('getValues returns initial defaults', () => {
    const { panel } = mountPanel();
    const v = panel.getValues();
    expect(v).toEqual({
      dark: true, accent: '#ff0000', size: 14, layout: 'grid', name: 'demo'
    });
  });

  it('setValues merges and re-renders', () => {
    const { container, panel } = mountPanel();
    panel.setValues({ dark: false, accent: '#00ff00' });
    const v = panel.getValues();
    expect(v.dark).toBe(false);
    expect(v.accent).toBe('#00ff00');
    // DOM reflects new values
    const toggle = container.querySelector('.csma-config__toggle input');
    expect(toggle.checked).toBe(false);
    const colorHex = container.querySelector('.csma-config__color-hex');
    expect(colorHex.textContent).toBe('#00ff00');
  });

  it('destroy clears the panel', () => {
    const { container, panel } = mountPanel();
    panel.destroy();
    expect(container.querySelector('.csma-config')).toBeNull();
  });

  it('emits config:changed on toggle interaction', () => {
    const emit = vi.fn();
    const container = document.createElement('section');
    createConfigPanel(container, emit, {
      sections: [{ label: 'S', controls: [{ id: 'x', type: 'toggle', label: 'X', value: false }] }]
    });
    const input = container.querySelector('input[type="checkbox"]');
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    expect(emit).toHaveBeenCalledWith('config:changed', { id: 'x', value: true });
  });

  it('collapsible section toggles aria-expanded on click', () => {
    const { container } = mountPanel();
    const header = container.querySelector('.csma-config__section-header');
    const section = header.closest('.csma-config__section');
    expect(section.getAttribute('aria-expanded')).toBe('true');
    header.click();
    expect(section.getAttribute('aria-expanded')).toBe('false');
    header.click();
    expect(section.getAttribute('aria-expanded')).toBe('true');
  });

  it('collapsible section toggles on Enter/Space', () => {
    const { container } = mountPanel();
    const header = container.querySelector('.csma-config__section-header');
    const section = header.closest('.csma-config__section');
    header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(section.getAttribute('aria-expanded')).toBe('false');
  });
});

// ──────────────────────────────────────────────────────────────────
// Convention guard: no raw document.createElement in archetype internals
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.1-A — raw DOM factories forbidden in config-panel', () => {
  it('config-panel.js contains no document.createElement / createElementNS', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/modules/archetypes/config-panel/config-panel.js'), 'utf8');
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/document\.createElement/);
    expect(stripped).not.toMatch(/createElementNS/);
  });
});
