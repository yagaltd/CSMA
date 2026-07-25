import { el, createSlideShell, createKicker, createHeading, container, formatFigure } from './_shared.js';
import { mountCountUp } from '../ui/count-up.js';

/**
 * stat-grid — 2–4 headline metrics with labels + captions. Each value animates
 * from 0 on slide-enter via CountUp.
 *
 * Config: `{ kicker?, title?, stats: [{ value: figureSpec, label, caption? }] }`
 */
export function createStatGridSlide(config = {}) {
    const slide = createSlideShell('stat-grid', { center: true });
    const stats = Array.isArray(config.stats) ? config.stats : [];

    const header = el('div', { className: 'stat-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const grid = el('div', { className: 'stat-grid' });
    for (const stat of stats) {
        grid.appendChild(buildStat(stat));
    }

    slide.appendChild(container([header, grid]));
    return slide;
}

function buildStat(stat = {}) {
    const card = el('div', { className: 'stat-card' });
    const valueEl = el('p', { className: 'stat-value' });
    valueEl.dataset.figure = JSON.stringify(stat.value || {});
    // Mount count-up once the element is attached to the document — the deck's
    // mountSlide() walks the slide for [data-figure] elements and calls
    // mountCountUp on each. This avoids needing IntersectionObserver setup
    // during pure construction.
    card.appendChild(valueEl);
    if (stat.label) card.appendChild(el('p', { className: 'stat-label', text: String(stat.label) }));
    if (stat.caption) card.appendChild(el('p', { className: 'stat-caption', text: String(stat.caption) }));
    return card;
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
