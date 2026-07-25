/**
 * thumbnails.js — canvas-based slide preview for rail and grid chrome.
 *
 * Renders a slide element to an offscreen canvas at a fractional scale. Used by
 * the rail (sidebar) and grid (overview) chrome to give the audience a glance
 * of every slide without rendering each at full size.
 *
 * Implementation note: full foreignObject-SVG-to-canvas rasterization is
 * browser-flaky (taint, CORS on fonts). We use a layout-driven approach that
 * reads the slide element's bounding rect and copies its outerHTML into an
 * iframe-rendered SVG, then draws that SVG to canvas. For environments
 * without canvas (jsdom), we return a placeholder canvas with a label so
 * tests can still verify the rail/grid mount correctly.
 *
 * This is best-effort: if rasterization fails, callers fall back to a labeled
 * placeholder.
 */

const PLACEHOLDER_BG = 'var(--surface-muted)';
const PLACEHOLDER_FG = 'var(--foreground-muted)';

/**
 * Render a slide element to a canvas thumbnail.
 *
 * @param {HTMLElement} slideEl
 * @param {number} [scale=0.15] — fraction of full size (0.15 = ~15%)
 * @param {object} [opts]
 * @param {number} [opts.baseWidth=1280] — assumed slide width when slideEl has no layout
 * @param {number} [opts.baseHeight=720]
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderThumbnail(slideEl, scale = 0.15, opts = {}) {
    const baseWidth = opts.baseWidth || 1280;
    const baseHeight = opts.baseHeight || 720;
    const w = Math.max(40, Math.round(baseWidth * scale));
    const h = Math.max(30, Math.round(baseHeight * scale));

    const doc = slideEl?.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const canvas = doc ? doc.createElement('canvas') : null;
    if (!canvas) return null;
    canvas.width = w;
    canvas.height = h;
    canvas.className = 'slide-thumb';

    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return canvas;

    // Placeholder fill — works in jsdom and as a fallback in browsers
    try {
        ctx.fillStyle = '#f3f3f3';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#888';
        ctx.font = Math.max(8, Math.round(h * 0.10)) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = String(slideEl?.dataset?.slideType || slideEl?.dataset?.layout || 'slide');
        ctx.fillText(label, w / 2, h / 2);
    } catch {
        // jsdom canvas: fillText may throw — leave the placeholder blank
    }

    // Best-effort browser rasterization using the SVG <foreignObject> trick.
    // Skipped in jsdom (no DOMParser XML serialization of computed styles).
    const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
    if (!win || !slideEl || typeof win.btoa !== 'function') return canvas;
    if (typeof slideEl.outerHTML !== 'string') return canvas;

    try {
        const rect = slideEl.getBoundingClientRect();
        const rw = rect.width || baseWidth;
        const rh = rect.height || baseHeight;
        const xml = new win.XMLSerializer().serializeToString(slideEl);
        const svgString =
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + rw + '" height="' + rh + '">' +
            '<foreignObject width="100%" height="100%">' +
            xml +
            '</foreignObject></svg>';
        const dataUrl = 'data:image/svg+xml;base64,' + win.btoa(unescape(encodeURIComponent(svgString)));
        const img = new win.Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
            setTimeout(reject, 250); // bail on slow decode
        });
        ctx.drawImage(img, 0, 0, w, h);
    } catch {
        // foreignObject taint / serialization failure → keep placeholder
    }

    return canvas;
}

/**
 * Build a non-canvas placeholder (used when canvas rasterization is unavailable).
 */
export function createPlaceholderThumbnail(label, scale = 0.15, opts = {}) {
    const baseWidth = opts.baseWidth || 1280;
    const baseHeight = opts.baseHeight || 720;
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc) return null;
    const el = doc.createElement('div');
    el.className = 'slide-thumb slide-thumb--placeholder';
    el.textContent = String(label || 'slide');
    el.style.width = Math.max(40, Math.round(baseWidth * scale)) + 'px';
    el.style.aspectRatio = String(baseWidth + ' / ' + baseHeight);
    // Note: inline styles here are intentional for the placeholder fallback only.
    // Real slide thumbnails use canvas. Background uses tokens.
    el.style.background = PLACEHOLDER_BG;
    el.style.color = PLACEHOLDER_FG;
    return el;
}
