/**
 * _shared.js — DOM construction helpers shared by every layout factory.
 *
 * Enforces CSMA architecture rules:
 *   - `textContent` for all user strings — never innerHTML
 *   - No inline styles for durable UI state (use data-* + CSS)
 *   - Tokens via CSS, not raw values
 *
 * Each layout factory builds a `.slide` element programmatically using these
 * helpers. Layouts are PURE — no EventBus access, no service calls. The deck
 * wires them up via mountDeck().
 */

/**
 * Create a DOM element with className, text, dataset, and children in one call.
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
