/**
 * tilt-card.js — perspective tilt on hover (Type I).
 *
 * Attaches a pointermove listener to a card element. The card's CSS transforms
 * are driven entirely by two CSS custom properties: `--tilt-x` and `--tilt-y`
 * (range -1..1). No JS-driven transforms, no inline styles for state.
 *
 * The CSS rule (.tilt-card[data-tilt-active="true"]) reads --tilt-x/--tilt-y
 * and applies the perspective transform.
 *
 * Returns a cleanup function that removes the listeners.
 *
 * @module tilt-card
 * @category ui/component
 */

/**
 * Mount tilt-on-hover behavior on a card element.
 *
 * @param {HTMLElement} card
 * @param {object} [opts]
 * @param {number} [opts.maxDegrees=6] — max tilt in degrees (passed to CSS via
 *   custom property so it stays token-driven)
 * @returns {() => void}
 */
export function mountTiltCard(card, opts = {}) {
    if (!card) return () => {};
    const win = typeof window !== 'undefined' ? window : null;
    if (!win) return () => {};

    const maxDegrees = Number.isFinite(opts.maxDegrees) ? opts.maxDegrees : 6;
    card.style.setProperty('--tilt-max', maxDegrees + 'deg');

    let active = false;

    const onEnter = () => {
        active = true;
        card.dataset.tiltActive = 'true';
    };

    const onMove = (e) => {
        if (!active) return;
        const rect = card.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const px = (e.clientX - rect.left) / rect.width;  // 0..1
        const py = (e.clientY - rect.top) / rect.height;  // 0..1
        card.style.setProperty('--tilt-x', String((px - 0.5) * 2));  // -1..1
        card.style.setProperty('--tilt-y', String((py - 0.5) * 2));
    };

    const onLeave = () => {
        active = false;
        card.dataset.tiltActive = 'false';
        card.style.setProperty('--tilt-x', '0');
        card.style.setProperty('--tilt-y', '0');
    };

    card.addEventListener('pointerenter', onEnter);
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);

    return () => {
        card.removeEventListener('pointerenter', onEnter);
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerleave', onLeave);
        card.dataset.tiltActive = 'false';
    };
}
