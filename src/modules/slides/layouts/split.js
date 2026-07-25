import { spec, specShell, specKicker, specHeading, specBody, specContainer } from './_shared.js';
import { createCodeWindowSlide } from './code-window.js';
import { createBrowserFrameSlide } from './browser-frame.js';

/**
 * split — text + side media panel. Two-column. `flip: true` swaps sides.
 *
 * Config: `{ kicker?, title, body?, media, flip?, center=false }`
 * `media` is an embedded config: `{ type, ... }` where type can be
 * 'image', 'code-window', 'browser-frame', 'panel', 'globe', 'chart'.
 *
 * Emits a SPEC TREE (Phase 2.0). `renderMedia` may return a DOM Node for the
 * not-yet-converted 'code-window' / 'browser-frame' types — `mountTree`
 * accepts DOM Node passthrough inside a spec tree, so the migration is
 * incremental.
 */
export function createSplitSlide(config = {}) {
    const dataset = { layout: 'split' };
    if (config.flip) dataset.flip = 'true';

    const text = spec('div', { className: 'split-text', children: [
        specKicker(config.kicker),
        specHeading(config.title),
        specBody(config.body)
    ] });

    const mediaEl = renderMedia(config.media);
    const media = spec('div', { className: 'split-media', children: mediaEl ? [mediaEl] : [] });

    const inner = config.flip
        ? specContainer([media, text])
        : specContainer([text, media]);

    return spec('div', { className: 'slide', dataset, children: [inner] });
}

/**
 * Render an embedded media panel based on its `type` field.
 * Exported for reuse by other layouts (spotlight, bento tile media).
 *
 * Returns either a spec node (image/panel/globe/chart) or a DOM Node
 * (code-window/browser-frame, still DOM-based until Phase 2.1).
 */
export function renderMedia(mediaConfig) {
    if (!mediaConfig || typeof mediaConfig !== 'object') return null;
    switch (mediaConfig.type) {
        case 'image':
            return spec('div', { className: 'media-image', dataset: { src: mediaConfig.src || '' } });
        case 'code-window':
            return createCodeWindowSlide(mediaConfig);
        case 'browser-frame':
            return createBrowserFrameSlide(mediaConfig);
        case 'panel':
            return spec('div', { className: 'media-panel', dataset: { color: mediaConfig.color || 'primary' } });
        case 'globe':
            return spec('div', { className: 'media-globe', dataset: { layout: 'globe' } });
        case 'chart':
            return spec('div', { className: 'media-chart', dataset: { chartType: mediaConfig.chartType || 'bar' } });
        default:
            return null;
    }
}
