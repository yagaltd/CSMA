import { spec, specShell, specKicker, specHeading, specContainer, formatFigure } from './_shared.js';

/**
 * bento — asymmetric tile grid. 3–5 proof points with figures, titles, short
 * bodies. Each tile can span columns (`c`) and rows (`r`) and use a variant
 * (`glow` | `accent`).
 *
 * Config: `{ kicker?, title?, tiles: [{ k, fig?, title?, body?, c?, r?, variant?, img? }] }`
 *
 * Emits a SPEC TREE (Phase 2.1). Mounted by `AIUIComposerService.mountTree()`.
 */
export function createBentoSlide(config = {}) {
    const tiles = Array.isArray(config.tiles) ? config.tiles : [];

    const header = spec('div', { className: 'bento-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const grid = spec('div', { className: 'bento-grid', children: tiles.map(buildTile) });

    return specShell('bento', { center: false }, [specContainer([header, grid])]);
}

function buildTile(tile = {}) {
    const dataset = {};
    if (tile.c) dataset.colSpan = String(tile.c);
    if (tile.r) dataset.rowSpan = String(tile.r);
    if (tile.variant) dataset.variant = String(tile.variant);
    if (tile.img) dataset.image = String(tile.img);

    const children = [];
    if (tile.k) children.push(spec('p', { className: 'kicker', text: String(tile.k) }));
    if (tile.fig) children.push(spec('p', { className: 'figure', text: formatFigure(tile.fig) }));
    if (tile.title) children.push(spec('p', { className: 'tile-title', text: String(tile.title) }));
    if (tile.body) children.push(spec('p', { className: 'tile-body', text: String(tile.body) }));

    return spec('div', { className: 'bento-tile', dataset, children });
}
