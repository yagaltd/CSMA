import { el, createSlideShell, createFoot, container } from './_shared.js';

/**
 * quote — pull-quote with attribution. Optional background image under scrim.
 *
 * Config: `{ text, name, role?, image?, center=true }`
 */
export function createQuoteSlide(config = {}) {
    const slide = createSlideShell('quote', { center: true });

    const text = el('blockquote', { className: 'quote-text' });
    // Build the quote mark + text as two spans (textContent only)
    const mark = el('span', { className: 'quote-mark', text: '"' });
    text.appendChild(mark);
    if (config.text) {
        text.appendChild(el('span', { className: 'quote-body', text: String(config.text) }));
    }

    const attrib = el('div', { className: 'quote-attribution', children: [
        config.name ? el('p', { className: 'quote-name', text: String(config.name) }) : null,
        config.role ? el('p', { className: 'quote-role', text: String(config.role) }) : null
    ].filter(Boolean) });

    slide.appendChild(container([text, attrib]));
    return slide;
}
