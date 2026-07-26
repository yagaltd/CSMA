/**
 * specHelpers.js — the aiui composition grammar (Layer 1 spec-node builders).
 *
 * These pure helpers produce the plain spec-node objects that
 * `AIUIComposerService.mountTree()` mounts into real DOM. They are the
 * canonical authoring API for any Layer-2 pattern (slide layouts, archetypes,
 * app chrome) that composes DOM through the single aiui pipeline instead of
 * raw `document.createElement`.
 *
 * Layering: Layer-2 code imports these helpers (Layer 1 owns the grammar).
 * Slides (`src/modules/slides/layouts/_shared.js`) keep their own copy of the
 * same logic until Phase 3.2 consolidates them onto this module; new Layer-2
 * code MUST import from here so there is one canonical source.
 *
 * Spec node grammar (consumed by mountTree):
 *   Raw element : { tag, attrs?, text?, children?: SpecNode[] }
 *   Component   : { component, props?, slot?: { [name]: SpecNode[] } }
 *   Text node   : { text }  OR a bare string
 *   null/false  : skipped
 *
 * Security is enforced by mountTree (SAFE_TAGS, SAFE_ATTRIBUTES, URL checks).
 * These helpers only shape data; they never touch the DOM.
 */

/**
 * Build the merged `attrs` object for a spec node from className / dataset /
 * explicit attrs. Order is className → dataset → explicit attrs so attribute
 * serialization is deterministic.
 *
 * Dataset keys are converted camelCase → kebab-case exactly as the DOM
 * `element.dataset` setter does (e.g. `chartType` → `data-chart-type`).
 */
export function toAttrs(className, dataset, attrs) {
    const out = {};
    if (className) out.class = String(className);
    if (dataset && typeof dataset === 'object') {
        for (const [k, v] of Object.entries(dataset)) {
            if (v === undefined || v === null) continue;
            const name = 'data-' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
            out[name] = String(v);
        }
    }
    if (attrs && typeof attrs === 'object') {
        for (const [k, v] of Object.entries(attrs)) {
            if (v === undefined || v === null) continue;
            out[k] = String(v);
        }
    }
    return out;
}

/**
 * Create a raw-element spec node.
 *
 * @param {string} tag
 * @param {object} [opts]
 * @param {string} [opts.className] — becomes `attrs.class`
 * @param {string} [opts.text] — becomes textContent (set before children)
 * @param {Record<string, string>} [opts.dataset] — becomes `data-*` attrs
 * @param {Record<string, string>} [opts.attrs] — arbitrary safe attrs
 * @param {(SpecNode|null|false)[]} [opts.children]
 * @returns {{ tag: string }} spec node
 */
export function spec(tag, opts = {}) {
    const node = { tag };
    const attrs = toAttrs(opts.className, opts.dataset, opts.attrs);
    if (Object.keys(attrs).length) node.attrs = attrs;
    if (typeof opts.text === 'string') node.text = opts.text;
    if (Array.isArray(opts.children)) {
        node.children = opts.children.filter((c) => c !== null && c !== undefined && c !== false);
    }
    return node;
}

/**
 * Create a bare text-node spec node (no element wrapper).
 * @param {string} text
 */
export function textNode(text) {
    return { text: String(text) };
}

/**
 * Create a catalog-component spec node — the embed point for aiui surfaces
 * (e.g. `component('comments-thread', { threadId })`).
 *
 * @param {string} name — catalog component id
 * @param {object} [props] — validated against the component's propsSchema
 * @param {Record<string, SpecNode[]>} [slot] — named slots; children may be
 *        raw spec nodes OR nested component nodes
 */
export function component(name, props, slot) {
    const node = { component: name };
    if (props && typeof props === 'object') node.props = props;
    if (slot && typeof slot === 'object') node.slot = slot;
    return node;
}

// ──────────────────────────────────────────────────────────────────
// Composer access — a process-level lazy singleton for Layer-2 code that
// composes raw-element spec trees via mountTree. Archetypes build raw specs
// (not catalog components), so they need no EventBus or ServiceManager; a
// null-eventBus composer is sufficient and avoids subscribing to module
// lifecycle events. mountTree never registers live nodes, so the shared
// composer carries no per-instance state.
// ──────────────────────────────────────────────────────────────────

import { AIUIComposerService } from './services/AIUIComposerService.js';

let _sharedComposer = null;

/**
 * @returns {AIUIComposerService} a shared composer for Layer-2 mountTree use.
 */
export function getComposer() {
    if (!_sharedComposer) {
        _sharedComposer = new AIUIComposerService(null);
    }
    return _sharedComposer;
}
