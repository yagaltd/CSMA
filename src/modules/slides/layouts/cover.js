import { el, createSlideShell, createKicker, createTitleWithAccent, createFoot, container } from './_shared.js';

/**
 * cover — opening slide. Always the first slide. Full-viewport with optional
 * background image under a scrim. Center-aligned by default.
 *
 * Config: `{ kicker, title, subtitle, foot?, image?, center=true }`
 */
export function createCoverSlide(config = {}) {
    const slide = createSlideShell('cover', { center: true });
    if (config.image) {
        const bg = el('div', { className: 'cover-bg' });
        bg.dataset.image = 'present';
        // Actual image rendered via CSS background-image (set by data-attr →
        // CSS rule, never as inline style). Caller may set CSS in slides.css.
        slide.appendChild(bg);
    }
    const inner = el('div', { className: 'cover-inner', children: [
        createKicker(config.kicker),
        createTitleWithAccent(config.title, { level: 'h1', className: 'display' }),
        config.subtitle ? el('p', { className: 'subhead', text: String(config.subtitle) }) : null,
        createFoot(config.foot)
    ].filter(Boolean) });
    slide.appendChild(inner);
    return slide;
}
