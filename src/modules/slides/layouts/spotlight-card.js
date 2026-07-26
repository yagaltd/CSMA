import { spec, specShell, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * spotlight-card — 3 principles/values with cursor-follow accent glow.
 * The cursor-follow is CSS-only (the deck sets a CSS custom property on
 * pointermove via a single delegated listener — no per-card JS handler).
 *
 * Config: `{ kicker?, title?, cards: [{k, title, body}] }` — max 3 cards.
 *
 * Emits a SPEC TREE (Phase 2.1). deck.js mounts it via the aiui composer's
 * `mountTree()`.
 */
export function createSpotlightCardSlide(config = {}) {
    const header = spec('div', { className: 'spotlight-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const cards = Array.isArray(config.cards) ? config.cards.slice(0, 3) : [];
    const grid = spec('div', {
        className: 'spotlight-grid',
        children: cards.map((card) => buildSpotlightCard(card))
    });

    return specShell('spotlight-card', { center: true }, [specContainer([header, grid])]);
}

function buildSpotlightCard(card = {}) {
    const children = [];
    if (card.k) children.push(spec('p', { className: 'spotlight-k', text: String(card.k) }));
    if (card.title) children.push(spec('h3', { className: 'spotlight-title', text: String(card.title) }));
    if (card.body) children.push(spec('p', { className: 'spotlight-body', text: String(card.body) }));
    return spec('div', { className: 'spotlight-card', children });
}
