import { spec, specShell, specContainer } from './_shared.js';

/**
 * marquee — logo strip / trust marks. Pure CSS animation (the keyframes live
 * in slides.css). Each item is a plain text label (no images, no markup).
 *
 * Config: `{ items: string[] }`
 *
 * Emits a SPEC TREE (Phase 2.1). deck.js mounts it via the aiui composer's
 * `mountTree()`.
 */
export function createMarqueeSlide(config = {}) {
    const items = Array.isArray(config.items) ? config.items : [];
    // Duplicate items so the CSS animation can loop seamlessly
    const sequence = items.length > 0 ? items.concat(items) : [];
    const track = spec('div', {
        className: 'marquee-track',
        children: sequence.map((item) => spec('span', { className: 'marquee-item', text: String(item) }))
    });

    return specShell('marquee', { center: true }, [specContainer([track])]);
}
