/**
 * _shared.js — construction helpers shared by every layout factory.
 *
 * TWO helper families live here:
 *
 *   1. SPEC API (Phase 2.0+) — `spec`, `component`, `specShell`, `specKicker`,
 *      `specHeading`, `specBody`, `specFoot`, `specTitleWithAccent`,
 *      `specContainer`, `textNode`. These return plain spec-node objects that
 *      `AIUIComposerService.mountTree()` mounts into real DOM. NEW layouts
 *      MUST use these. This is the unlock: a spec tree may embed any aiui
 *      catalog surface (`{ component: 'comments-thread', ... }`) alongside
 *      raw HTML, so any module surface can live inside any slide layout.
 *
 *   2. DOM API (back-compat) — `el`, `createSlideShell`, `createKicker`, …
 *      These still build DOM directly and are used by the 20 layouts not yet
 *      converted (Phase 2.1 will convert them). They are DEPRECATED for new
 *      layouts and will be removed once all 24 layouts emit spec trees.
 *
 * Both families enforce CSMA architecture rules:
 *   - `textContent` for all user strings — never innerHTML
 *   - No inline styles for durable UI state (use data-* + CSS)
 *   - Tokens via CSS, not raw values
 *
 * Layout factories are PURE — no EventBus access, no service calls. The deck
 * wires them up via mountDeck().
 */

// ──────────────────────────────────────────────────────────────────
// SPEC API (Phase 2.0+) — pure functions returning spec nodes.
// Mounted by AIUIComposerService.mountTree(). See the method doc for the
// full node grammar (raw element / component / text / DOM passthrough).
// ──────────────────────────────────────────────────────────────────

/**
 * Build the merged `attrs` object for a spec node from className / dataset /
 * explicit attrs. Attribute order is className → dataset → attrs so that
 * `mountTree` serializes attributes in the same order the legacy DOM `el()`
 * helper produced (byte-identical DOM across the migration).
 *
 * Dataset keys are converted camelCase → kebab-case exactly as the DOM
 * `element.dataset` setter does (e.g. `chartType` → `data-chart-type`).
 */
function toAttrs(className, dataset, attrs) {
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
 * (e.g. `component('comments-thread', { threadId })`, `component('video-player', { src })`).
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

/**
 * Create the outer `.slide` shell as a spec node with `data-layout` set.
 * Spec equivalent of the back-compat `createSlideShell`.
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

/** Spec equivalent of `createKicker`. */
export function specKicker(text) {
    if (!text) return null;
    return spec('p', { className: 'kicker', text: String(text) });
}

/** Spec equivalent of `createHeading`. */
export function specHeading(text, { className = 'headline' } = {}) {
    if (!text) return null;
    return spec('h2', { className, text: String(text) });
}

/** Spec equivalent of `createBody`. */
export function specBody(text, { className = 'body' } = {}) {
    if (!text) return null;
    return spec('p', { className, text: String(text) });
}

/** Spec equivalent of `createFoot`. */
export function specFoot(text) {
    if (!text) return null;
    return spec('p', { className: 'foot', text: String(text) });
}

/** Spec equivalent of `createTitleWithAccent`. Accepts a string or `{ text, accent }`. */
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

/** Spec equivalent of `container` — wraps content in a `.slide-container` div. */
export function specContainer(children = []) {
    return spec('div', { className: 'slide-container', children });
}

// ──────────────────────────────────────────────────────────────────
// DOM API (back-compat) — used by the 20 not-yet-converted layouts.
// DEPRECATED for new layouts; removed in Phase 2.1.
// ──────────────────────────────────────────────────────────────────

/**
 * Create a DOM element with className, text, dataset, and children in one call.
 *
 * @deprecated Phase 2.0 — new layouts should emit spec nodes via `spec()` /
 *   `specShell()` and let the composer mount them. This DOM helper remains
 *   only for layouts not yet converted (Phase 2.1) and for the deck's own
 *   chrome scaffolding.
 *
 * @param {string} tag — element tag (e.g. 'h1', 'div', 'span')
 * @param {object} [opts]
 * @param {string} [opts.className] — class string
 * @param {string} [opts.text] — textContent (only if string)
 * @param {Record<string, string>} [opts.dataset] — data-* attributes
 * @param {Record<string, string>} [opts.attrs] — arbitrary attributes (e.g. aria-label)
 * @param {Node[]} [opts.children] — child nodes to append
 * @returns {HTMLElement}
 */
export function el(tag, opts = {}) {
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc) return null;
    const node = doc.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (typeof opts.text === 'string') node.textContent = opts.text;
    if (opts.dataset && typeof opts.dataset === 'object') {
        for (const [k, v] of Object.entries(opts.dataset)) {
            if (v === undefined || v === null) continue;
            node.dataset[k] = String(v);
        }
    }
    if (opts.attrs && typeof opts.attrs === 'object') {
        for (const [k, v] of Object.entries(opts.attrs)) {
            if (v === undefined || v === null) continue;
            node.setAttribute(k, String(v));
        }
    }
    if (Array.isArray(opts.children)) {
        for (const child of opts.children) {
            if (child instanceof Node) node.appendChild(child);
        }
    }
    return node;
}

/**
 * Create the outer `.slide` container with the layout's data attribute set.
 * Layouts call this first, then append their content.
 *
 * @param {string} layoutName
 * @param {object} [config]
 * @param {boolean} [config.center] — force centering
 * @returns {HTMLElement} `.slide` element with `data-layout` set
 */
export function createSlideShell(layoutName, config = {}) {
    const slide = el('div', { className: 'slide' });
    slide.dataset.layout = String(layoutName);
    if (config.center) {
        slide.classList.add('center');
    }
    return slide;
}

/**
 * Create a kicker label (small ALL-CAPS pre-title).
 */
export function createKicker(text) {
    if (!text) return null;
    return el('p', { className: 'kicker', text: String(text) });
}

/**
 * Create a heading.
 */
export function createHeading(text, { className = 'headline' } = {}) {
    if (!text) return null;
    return el('h2', { className, text: String(text) });
}

/**
 * Create a body paragraph.
 */
export function createBody(text, { className = 'body' } = {}) {
    if (!text) return null;
    return el('p', { className, text: String(text) });
}

/**
 * Create a foot/source line.
 */
export function createFoot(text) {
    if (!text) return null;
    return el('p', { className: 'foot', text: String(text) });
}

/**
 * Compose a title that may have accent-highlighted words.
 * Accepts either a string or `{ text, accent: string }` shape.
 * Returns a heading element with an `<span class="accent-text">` around the
 * accent word if present.
 */
export function createTitleWithAccent(spec, { level = 'h1', className = 'display' } = {}) {
    if (!spec) return null;
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc) return null;

    if (typeof spec === 'string') {
        return el(level, { className, text: spec });
    }

    const heading = doc.createElement(level);
    heading.className = className;
    const text = String(spec.text || '');
    const accent = spec.accent ? String(spec.accent) : '';

    if (accent && text.includes(accent)) {
        const idx = text.indexOf(accent);
        if (idx > 0) heading.appendChild(doc.createTextNode(text.slice(0, idx)));
        const span = doc.createElement('span');
        span.className = 'accent-text';
        span.textContent = accent;
        heading.appendChild(span);
        if (idx + accent.length < text.length) {
            heading.appendChild(doc.createTextNode(text.slice(idx + accent.length)));
        }
    } else {
        heading.textContent = text;
    }
    return heading;
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

/**
 * Container helper for non-full slides — wraps content in a `.container` div.
 */
export function container(children = []) {
    return el('div', { className: 'slide-container', children });
}
