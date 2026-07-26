/**
 * legacy-dom-helpers.js — TEST-ONLY back-compat DOM helpers.
 *
 * These are the original (pre-aiui) layout DOM builders, preserved verbatim so
 * that the Phase 2.0 / 2.1 byte-identical layout tests have an INDEPENDENT
 * golden reference built from raw `document.createElement` (not from the spec
 * pipeline under test). This avoids a circular spec-vs-spec comparison.
 *
 * The production module `src/modules/slides/layouts/_shared.js` no longer
 * carries these helpers (removed in Phase 3.2). They live here, test-only, so
 * the regression guards keep proving the spec-emitting layouts are
 * byte-identical to the original `el()`-based implementations.
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

export function createSlideShell(layoutName, config = {}) {
    const slide = el('div', { className: 'slide' });
    slide.dataset.layout = String(layoutName);
    if (config.center) {
        slide.classList.add('center');
    }
    return slide;
}

export function createKicker(text) {
    if (!text) return null;
    return el('p', { className: 'kicker', text: String(text) });
}

export function createHeading(text, { className = 'headline' } = {}) {
    if (!text) return null;
    return el('h2', { className, text: String(text) });
}

export function createBody(text, { className = 'body' } = {}) {
    if (!text) return null;
    return el('p', { className, text: String(text) });
}

export function createFoot(text) {
    if (!text) return null;
    return el('p', { className: 'foot', text: String(text) });
}

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

export function container(children = []) {
    return el('div', { className: 'slide-container', children });
}
