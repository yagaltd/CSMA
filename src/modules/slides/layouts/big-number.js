import { spec, specShell, specKicker, specFoot } from './_shared.js';
import { mountCountUp } from '../../../ui/components/count-up/count-up.js';

/**
 * big-number — one enormous accent figure + caption. Always cited in `foot`.
 * At most one per deck — two giant numbers cancel each other (per §12.5).
 *
 * Config: `{ kicker?, value: figureSpec, caption, foot?, center=true }`
 *
 * Emits a SPEC TREE (Phase 2.0).
 */
export function createBigNumberSlide(config = {}) {
    const valueEl = spec('p', {
        className: 'big-number-value',
        dataset: { figure: JSON.stringify(config.value || {}) }
    });

    const inner = spec('div', { className: 'big-number-inner', children: [
        specKicker(config.kicker),
        valueEl,
        config.caption ? spec('p', { className: 'lead', text: String(config.caption) }) : null,
        specFoot(config.foot)
    ] });

    return specShell('big-number', { center: true }, [inner]);
}

export function wireBigNumberCountUp(slideEl, opts = {}) {
    const target = slideEl?.querySelector('[data-figure]');
    if (!target) return () => {};
    let figure = {};
    try { figure = JSON.parse(target.dataset.figure || '{}'); } catch { /* noop */ }
    return mountCountUp(target, figure, opts);
}
