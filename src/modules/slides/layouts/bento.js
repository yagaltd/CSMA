import { el, createSlideShell, createKicker, createHeading, container, formatFigure } from './_shared.js';

/**
 * bento — asymmetric tile grid. 3–5 proof points with figures, titles, short
 * bodies. Each tile can span columns (`c`) and rows (`r`) and use a variant
 * (`glow` | `accent`).
 *
 * Config: `{ kicker?, title?, tiles: [{ k, fig?, title?, body?, c?, r?, variant?, img? }] }`
 */
export function createBentoSlide(config = {}) {
    const slide = createSlideShell('bento', { center: false });
    const tiles = Array.isArray(config.tiles) ? config.tiles : [];

    const header = el('div', { className: 'bento-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const grid = el('div', { className: 'bento-grid' });
    for (const tile of tiles) {
        grid.appendChild(buildTile(tile));
    }

    slide.appendChild(container([header, grid]));
    return slide;
}

function buildTile(tile = {}) {
    const t = el('div', { className: 'bento-tile' });
    if (tile.c) t.dataset.colSpan = String(tile.c);
    if (tile.r) t.dataset.rowSpan = String(tile.r);
    if (tile.variant) t.dataset.variant = String(tile.variant);
    if (tile.img) t.dataset.image = String(tile.img);

    const children = [];
    if (tile.k) children.push(el('p', { className: 'kicker', text: String(tile.k) }));
    if (tile.fig) children.push(el('p', { className: 'figure', text: formatFigure(tile.fig) }));
    if (tile.title) children.push(el('p', { className: 'tile-title', text: String(tile.title) }));
    if (tile.body) children.push(el('p', { className: 'tile-body', text: String(tile.body) }));

    for (const child of children.filter(Boolean)) t.appendChild(child);
    return t;
}
