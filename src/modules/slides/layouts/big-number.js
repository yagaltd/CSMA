import { el, createSlideShell, createKicker, createFoot, container } from './_shared.js';
import { mountCountUp } from '../ui/count-up.js';

/**
 * big-number — one enormous accent figure + caption. Always cited in `foot`.
 * At most one per deck — two giant numbers cancel each other (per §12.5).
 *
 * Config: `{ kicker?, value: figureSpec, caption, foot?, center=true }`
 */
export function createBigNumberSlide(config = {}) {
    const slide = createSlideShell('big-number', { center: true });

    const valueEl = el('p', { className: 'big-number-value' });
    valueEl.dataset.figure = JSON.stringify(config.value || {});

    const inner = el('div', { className: 'big-number-inner', children: [
        createKicker(config.kicker),
        valueEl,
        config.caption ? el('p', { className: 'lead', text: String(config.caption) }) : null,
        createFoot(config.foot)
    ].filter(Boolean) });

    slide.appendChild(inner);
    return slide;
}

export function wireBigNumberCountUp(slideEl, opts = {}) {
    const target = slideEl?.querySelector('[data-figure]');
    if (!target) return () => {};
    let figure = {};
    try { figure = JSON.parse(target.dataset.figure || '{}'); } catch { /* noop */ }
    return mountCountUp(target, figure, opts);
}
