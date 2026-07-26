/**
 * _shared.js — slide-layout construction helpers (spec-only).
 *
 * This module holds the slides-specific SPEC helpers (`specShell`, `specKicker`,
 * …) plus re-exports of the canonical spec primitives (`spec`, `textNode`,
 * `component`, `toAttrs`) from the aiui Layer-1 module. Every value here is a
 * pure spec-node builder consumed by `AIUIComposerService.mountTree()` — there
 * is no direct DOM construction in this file.
 *
 * Layering: the spec-node grammar lives in one canonical place —
 * `src/modules/ai-ui/specHelpers.js` (Layer 1). This module (Layer 2,
 * slides-specific) re-exports those primitives so slide layouts import a single
 * local entry point, then adds the slide-layout-specific extensions on top.
 *
 * The unlock: a spec tree may embed any aiui catalog surface
 * (`{ component: 'comments-thread', ... }`) alongside raw HTML, so any module
 * surface can live inside any slide layout.
 *
 * Architecture rules enforced via specHelpers / mountTree:
 *   - `textContent` for all user strings — never innerHTML
 *   - No inline styles for durable UI state (use data-* + CSS)
 *   - Tokens via CSS, not raw values
 *
 * Layout factories are PURE — no EventBus access, no service calls. The deck
 * wires them up via mountDeck().
 */

// Canonical spec primitives — imported locally (one source of truth: the
// ai-ui Layer-1 module) and re-exported so slide layouts have a single local
// entry point for the spec-node grammar.
import { spec, textNode, component, toAttrs } from '../../ai-ui/specHelpers.js';
export { spec, textNode, component, toAttrs };

// ──────────────────────────────────────────────────────────────────
// Slides-specific spec extensions (built on the canonical primitives).
// Mounted by AIUIComposerService.mountTree(). See the method doc for the
// full node grammar (raw element / component / text / DOM passthrough).
// ──────────────────────────────────────────────────────────────────

/**
 * Create the outer `.slide` shell as a spec node with `data-layout` set.
 *
 * @param {string} layoutName
 * @param {object} [config]
 * @param {boolean} [config.center] — add the `center` class
 * @param {SpecNode[]} [children] — slide content
 */
export function specShell(layoutName, config = {}, children = []) {
    return spec('div', {
        className: config.center ? 'slide center' : 'slide',
        dataset: { layout: String(layoutName) },
        children
    });
}

/** Spec equivalent of the removed `createKicker`. */
export function specKicker(text) {
    if (!text) return null;
    return spec('p', { className: 'kicker', text: String(text) });
}

/** Spec equivalent of the removed `createHeading`. */
export function specHeading(text, { className = 'headline' } = {}) {
    if (!text) return null;
    return spec('h2', { className, text: String(text) });
}

/** Spec equivalent of the removed `createBody`. */
export function specBody(text, { className = 'body' } = {}) {
    if (!text) return null;
    return spec('p', { className, text: String(text) });
}

/** Spec equivalent of the removed `createFoot`. */
export function specFoot(text) {
    if (!text) return null;
    return spec('p', { className: 'foot', text: String(text) });
}

/** Accepts a string or `{ text, accent }`. */
export function specTitleWithAccent(specInput, { level = 'h1', className = 'display' } = {}) {
    if (!specInput) return null;
    if (typeof specInput === 'string') {
        return spec(level, { className, text: specInput });
    }
    const text = String(specInput.text || '');
    const accent = specInput.accent ? String(specInput.accent) : '';
    if (accent && text.includes(accent)) {
        const idx = text.indexOf(accent);
        const children = [];
        if (idx > 0) children.push(textNode(text.slice(0, idx)));
        children.push(spec('span', { className: 'accent-text', text: accent }));
        if (idx + accent.length < text.length) {
            children.push(textNode(text.slice(idx + accent.length)));
        }
        return spec(level, { className, children });
    }
    return spec(level, { className, text });
}

/** Spec equivalent of the removed `container` — wraps content in a `.slide-container` div. */
export function specContainer(children = []) {
    return spec('div', { className: 'slide-container', children });
}

/**
 * Format a number-with-affixes for display (no animation — CountUp handles that).
 * Accepts `{ number, decimals, prefix, suffix }` or a primitive.
 */
export function formatFigure(spec) {
    if (spec == null) return '';
    if (typeof spec === 'number') return String(spec);
    if (typeof spec === 'string') return spec;
    const n = Number(spec.number);
    if (!Number.isFinite(n)) return '';
    const decimals = Number.isFinite(spec.decimals) ? spec.decimals : 0;
    const prefix = spec.prefix || '';
    const suffix = spec.suffix || '';
    const formatted = decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
    return prefix + formatted + suffix;
}
