/**
 * SlideThumbnail.js — shared slide-thumbnail card primitive.
 *
 * One root, three CSS layouts. The grid (▦), the rail (☰), and the comments
 * drawer rail all build cards through this single factory so they never drift.
 *
 * Each card is a spec()→mountTree() element containing:
 *   .slide-thumb-frame  ← renderThumb fills this with a scaled slide preview
 *   .slide-thumb-num    ← index+1 badge
 *   .slide-thumb-label  ← optional caption (only when `label` is passed)
 *
 * The calling chrome sets `tag` to 'button' (grid, drawer) or 'li' (rail <ol>).
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { renderThumb } from './renderThumb.js';

/**
 * @param {object} config — slide config (type, title, etc.)
 * @param {object} [opts]
 * @param {number} opts.index    — slide index (0-based); sets data-index + num badge
 * @param {boolean} [opts.active=false] — sets data-active="true"|"false"
 * @param {string|null} [opts.label=null] — optional caption text; null = no label span
 * @param {string} [opts.tag='button'] — 'button' or 'li'
 * @param {Document} [opts.documentRef]
 * @param {object} [opts.composer] — AIUIComposerService instance
 * @returns {{ root: HTMLElement|null, cleanup: () => void }}
 */
export function createSlideThumbnail(config, {
    index,
    active = false,
    label = null,
    tag = 'button',
    documentRef = null,
    composer = null
} = {}) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || !config) return { root: null, cleanup: () => {} };

    const cmp = composer || getComposer();

    const children = [
        spec('span', { className: 'slide-thumb-frame' }),
        spec('span', { className: 'slide-thumb-num', text: String(index + 1) })
    ];

    if (label !== null && label !== undefined) {
        children.push(spec('span', { className: 'slide-thumb-label', text: String(label) }));
    }

    const cardSpec = spec(tag, {
        className: 'slide-thumb-card',
        dataset: {
            index: String(index),
            active: active ? 'true' : 'false'
        },
        children
    });

    const { root, cleanup: unmountCard } = cmp.mountTree(cardSpec, null, { documentRef: doc });

    // Attach the real scaled thumbnail into the frame span.
    const frame = root ? root.querySelector('.slide-thumb-frame') : null;
    let thumbCleanup = () => {};
    if (frame) {
        thumbCleanup = renderThumb(config, frame, { documentRef: doc });
    }

    const cleanup = () => {
        try { thumbCleanup(); } catch { /* best-effort */ }
        try { unmountCard(); } catch { /* best-effort */ }
    };

    return { root, cleanup };
}
