import { el, createSlideShell, container } from './_shared.js';

/**
 * cta — closing slide. Always the last slide. Title + subtitle (contact).
 *
 * Config: `{ title, subtitle?, notes?, center=true }`
 */
export function createCtaSlide(config = {}) {
    const slide = createSlideShell('cta', { center: true });
    const inner = el('div', { className: 'cta-inner', children: [
        config.title ? el('h1', { className: 'display', text: String(config.title) }) : null,
        config.subtitle ? el('p', { className: 'subhead', text: String(config.subtitle) }) : null
    ].filter(Boolean) });
    slide.appendChild(inner);
    return slide;
}
