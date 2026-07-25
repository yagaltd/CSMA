import { el, createSlideShell, container } from './_shared.js';

/**
 * marquee — logo strip / trust marks. Pure CSS animation (the keyframes live
 * in slides.css). Each item is a plain text label (no images, no markup).
 *
 * Config: `{ items: string[] }`
 */
export function createMarqueeSlide(config = {}) {
    const slide = createSlideShell('marquee', { center: true });

    const track = el('div', { className: 'marquee-track' });
    const items = Array.isArray(config.items) ? config.items : [];
    // Duplicate items so the CSS animation can loop seamlessly
    const sequence = items.length > 0 ? items.concat(items) : [];
    for (const item of sequence) {
        track.appendChild(el('span', { className: 'marquee-item', text: String(item) }));
    }

    slide.appendChild(container([track]));
    return slide;
}
