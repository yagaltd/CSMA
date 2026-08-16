/**
 * AIUIHelpers - shared constants, allowlists, and pure helpers for
 * AIUIComposerService and its op siblings.
 *
 * Extracted from AIUIComposerService.js (Phase 6 modular decomposition,
 * lane M1; see docs/plans/active/audit-fix-plan.md 6.2). Cut/paste move;
 * no behavior changes. Declarations gain `export` so siblings can import
 * them without importing the facade (no circular imports).
 */

export const MAX_TEXT_LENGTH = 1000;
export const MAX_CHILDREN_PER_SLOT = 50;
export const MAX_COMPOSITION_DEPTH = 8;
// Module surfaces receive structured props (objects/arrays for data/options).
// Cap serialized size to keep payloads bounded.
export const MAX_STRUCTURED_PROP_LENGTH = 20000;

// SVG drawing tags live in SAFE_TAGS but must be created in the SVG namespace;
// HTML `createElement('path')` yields an HTMLUnknownElement that does not
// render. SVG_TAGS is the subset of SAFE_TAGS that need createElementNS.
export const SVG_NS = 'http://www.w3.org/2000/svg';
export const SVG_TAGS = new Set([
  'svg', 'path', 'g', 'line', 'circle', 'rect', 'polyline', 'polygon'
]);

export const SAFE_TAGS = new Set([
  // ── Layout ──
  'article',
  'div',
  'footer',
  'header',
  'section',
  'main',
  'aside',
  'nav',
  'details',
  'summary',

  // ── Headings (complete set — viewer archetype needs h1–h6) ──
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',

  // ── Text semantics (viewer renders rich content) ──
  'p', 'span',
  'time', 'mark', 'abbr',
  'code', 'pre', 'kbd', 'samp', 'var',
  'blockquote', 'cite', 'q',

  // ── Lists (viewer uses ul/ol/li) ──
  'ul', 'ol', 'li',
  'dl', 'dt', 'dd',

  // ── Tables (viewer renders tabular data) ──
  'table', 'thead', 'tbody', 'tfoot',
  'tr', 'td', 'th',
  'caption', 'col', 'colgroup',

  // ── Form elements (editor-builder, config-panel, settings) ──
  'input',
  'textarea',
  'select', 'option', 'optgroup',
  'label',
  'fieldset', 'legend',
  'datalist', 'output',
  'progress', 'meter',

  // ── Interactive ──
  'button',
  'dialog',

  // ── Media (media-browser, viewer, overlay-manager) ──
  'img',
  'figure', 'figcaption',
  'picture', 'source',
  'video', 'audio',

  // ── Graphics (chart canvas + svg connectors + archetype icons) ──
  // NOTE: script/iframe/object/embed are intentionally excluded (security).
  'canvas',
  'svg', 'path', 'g',
  'line', 'circle', 'rect',
  'polyline', 'polygon',
]);
export const SAFE_ATTRIBUTES = new Set([
  'aria-label',
  'aria-hidden',
  'autocomplete',
  'checked',
  'class',
  'cols',
  'data-aiui-id',
  'data-disabled',
  'data-group',
  'data-shape',
  'data-size',
  'data-slot',
  'data-state',
  'data-theme-active',
  'data-theme-toggle',
  'data-tone',
  'data-variant',
  'disabled',
  'for',
  'href',
  'id',
  'loading',
  'max',
  'maxlength',
  'min',
  'minlength',
  'name',
  'placeholder',
  'required',
  'role',
  'rows',
  'selected',
  'src',
  'step',
  'tabindex',
  'title',
  'type',
  'value',
  'alt',

  // ── SVG geometry & presentation (inert — no script execution, no resource
  // loading). Needed so archetype icons and vector decoration compose through
  // the same mountTree pipeline instead of bypassing it. href/src stay
  // URL-validated above; no new URL-capable attributes are added here. ──
  'viewBox', 'preserveAspectRatio',
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity',
  'points', 'd',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'width', 'height', 'transform', 'opacity', 'focusable'
]);
export const URL_ATTRIBUTES = new Set(['href', 'src']);
export const KNOWN_STATE_ATTRS = new Set([
  'data-state',
  'data-variant',
  'data-tone',
  'data-size',
  'data-shape',
  'data-disabled',
  'data-theme-active',
  'data-group',
]);

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function cloneDefinition(definition) {
  return JSON.parse(JSON.stringify(definition));
}

export function normalizeCatalogEntry(definition, owner = 'core') {
  if (!isPlainObject(definition)) {
    throw new Error('AI UI component definition must be an object');
  }

  const id = definition.id || definition.alias;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('AI UI component definition requires an id');
  }
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id)) {
    throw new Error(`AI UI component id "${id}" must be globally safe and namespaced when module-owned`);
  }
  if (!isPlainObject(definition.render)) {
    throw new Error(`AI UI component "${id}" requires render metadata`);
  }

  return {
    ...cloneDefinition(definition),
    id,
    owner,
    alias: definition.alias || id,
    propsSchema: definition.propsSchema || {},
    slots: definition.slots || {},
    allowedChildren: definition.allowedChildren || [],
    dependencies: definition.dependencies || { runtime: [], components: [] }
  };
}

export function ownerFromPayload(payload) {
  return payload?.id || payload?.manifest?.id || 'unknown-module';
}
