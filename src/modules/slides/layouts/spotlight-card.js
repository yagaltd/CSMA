import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';

/**
 * spotlight-card — 3 principles/values with cursor-follow accent glow.
 * The cursor-follow is CSS-only (the deck sets a CSS custom property on
 * pointermove via a single delegated listener — no per-card JS handler).
 *
 * Config: `{ kicker?, title?, cards: [{k, title, body}] }` — max 3 cards.
 */
export function createSpotlightCardSlide(config = {}) {
    const slide = createSlideShell('spotlight-card', { center: true });

    const header = el('div', { className: 'spotlight-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const grid = el('div', { className: 'spotlight-grid' });
    const cards = Array.isArray(config.cards) ? config.cards.slice(0, 3) : [];
    cards.forEach((card) => grid.appendChild(buildSpotlightCard(card)));

    slide.appendChild(container([header, grid]));
    return slide;
}

function buildSpotlightCard(card = {}) {
    const node = el('div', { className: 'spotlight-card' });
    const children = [];
    if (card.k) children.push(el('p', { className: 'spotlight-k', text: String(card.k) }));
    if (card.title) children.push(el('h3', { className: 'spotlight-title', text: String(card.title) }));
    if (card.body) children.push(el('p', { className: 'spotlight-body', text: String(card.body) }));
    for (const child of children.filter(Boolean)) node.appendChild(child);
    return node;
}
