import { spec, specShell, specKicker, specHeading, specContainer } from './_shared.js';
import { mountCountUp } from '../ui/count-up.js';

/**
 * stat-grid — 2–4 headline metrics with labels + captions. Each value animates
 * from 0 on slide-enter via CountUp.
 *
 * Config: `{ kicker?, title?, stats: [{ value: figureSpec, label, caption? }] }`
 *
 * Emits a SPEC TREE (Phase 2.1). Mounted by `AIUIComposerService.mountTree()`.
 * `wireStatGridCountUps` runs post-mount on the live DOM (unchanged).
 */
export function createStatGridSlide(config = {}) {
    const stats = Array.isArray(config.stats) ? config.stats : [];

    const header = spec('div', { className: 'stat-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const grid = spec('div', { className: 'stat-grid', children: stats.map(buildStat) });

    return specShell('stat-grid', { center: true }, [specContainer([header, grid])]);
}

function buildStat(stat = {}) {
    const valueEl = spec('p', {
        className: 'stat-value',
        dataset: { figure: JSON.stringify(stat.value || {}) }
    });

    const children = [valueEl];
    if (stat.label) children.push(spec('p', { className: 'stat-label', text: String(stat.label) }));
    if (stat.caption) children.push(spec('p', { className: 'stat-caption', text: String(stat.caption) }));

    return spec('div', { className: 'stat-card', children });
}

/**
 * Wire up CountUp animations on all `[data-figure]` elements within a slide.
 * Called by deck.js after the slide is attached.
 */
export function wireStatGridCountUps(slideEl, opts = {}) {
    if (!slideEl) return () => {};
    const cleanups = [];
    const targets = slideEl.querySelectorAll('[data-figure]');
    for (const target of targets) {
        let figure = {};
        try { figure = JSON.parse(target.dataset.figure || '{}'); } catch { /* noop */ }
        cleanups.push(mountCountUp(target, figure, opts));
    }
    return () => cleanups.forEach((fn) => fn && fn());
}
