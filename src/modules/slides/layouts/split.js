import { el, createSlideShell, createKicker, createHeading, createBody, container } from './_shared.js';
import { createCodeWindowSlide } from './code-window.js';
import { createBrowserFrameSlide } from './browser-frame.js';

/**
 * split — text + side media panel. Two-column. `flip: true` swaps sides.
 *
 * Config: `{ kicker?, title, body?, media, flip?, center=false }`
 * `media` is an embedded config: `{ type, ... }` where type can be
 * 'image', 'code-window', 'browser-frame', 'panel', 'globe', 'chart'.
 */
export function createSplitSlide(config = {}) {
    const slide = createSlideShell('split', { center: false });
    if (config.flip) slide.dataset.flip = 'true';

    const text = el('div', { className: 'split-text', children: [
        createKicker(config.kicker),
        createHeading(config.title),
        createBody(config.body)
    ].filter(Boolean) });

    const media = el('div', { className: 'split-media' });
    const mediaEl = renderMedia(config.media);
    if (mediaEl) media.appendChild(mediaEl);

    const inner = config.flip
        ? container([media, text])
        : container([text, media]);
    slide.appendChild(inner);
    return slide;
}

/**
 * Render an embedded media panel based on its `type` field.
 * Exported for reuse by other layouts (spotlight, bento tile media).
 */
export function renderMedia(mediaConfig) {
    if (!mediaConfig || typeof mediaConfig !== 'object') return null;
    switch (mediaConfig.type) {
        case 'image':
            return el('div', { className: 'media-image', dataset: { src: mediaConfig.src || '' } });
        case 'code-window':
            return createCodeWindowSlide(mediaConfig);
        case 'browser-frame':
            return createBrowserFrameSlide(mediaConfig);
        case 'panel':
            return el('div', { className: 'media-panel', dataset: { color: mediaConfig.color || 'primary' } });
        case 'globe':
            return el('div', { className: 'media-globe', dataset: { layout: 'globe' } });
        case 'chart':
            return el('div', { className: 'media-chart', dataset: { chartType: mediaConfig.chartType || 'bar' } });
        default:
            return null;
    }
}
