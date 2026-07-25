import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';

/**
 * accordion — expand/collapse panels using native <details> for accessibility.
 * Used for FAQs and feature detail. Don't use for primary content — audience
 * can't click along during a presented deck.
 *
 * Config: `{ kicker?, title?, items: [{title, body}] }`
 */
export function createAccordionSlide(config = {}) {
    const slide = createSlideShell('accordion', { center: true });

    const header = el('div', { className: 'accordion-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const list = el('div', { className: 'accordion-list' });
    const items = Array.isArray(config.items) ? config.items : [];
    items.forEach((item) => {
        const details = el('details', { className: 'accordion-item' });
        details.appendChild(el('summary', { className: 'accordion-summary', text: String(item.title || '') }));
        if (item.body) details.appendChild(el('p', { className: 'accordion-body', text: String(item.body) }));
        list.appendChild(details);
    });

    slide.appendChild(container([header, list]));
    return slide;
}
