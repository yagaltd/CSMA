import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';

/**
 * pricing — tier cards. `highlight: true` on a tier gets an accent badge.
 *
 * Config: `{ kicker?, title?, tiers: [{name, price, period?, blurb?, features[], highlight?}] }`
 */
export function createPricingSlide(config = {}) {
    const slide = createSlideShell('pricing', { center: true });

    const header = el('div', { className: 'pricing-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const grid = el('div', { className: 'pricing-grid' });
    const tiers = Array.isArray(config.tiers) ? config.tiers : [];
    tiers.forEach((tier) => grid.appendChild(buildTier(tier)));

    slide.appendChild(container([header, grid]));
    return slide;
}

function buildTier(tier = {}) {
    const card = el('div', { className: 'pricing-tier' });
    if (tier.highlight) card.dataset.highlight = 'true';

    const children = [];
    if (tier.name) children.push(el('p', { className: 'tier-name', text: String(tier.name) }));
    if (tier.price) {
        const price = el('p', { className: 'tier-price', text: String(tier.price) });
        if (tier.period) price.dataset.period = String(tier.period);
        children.push(price);
    }
    if (tier.blurb) children.push(el('p', { className: 'tier-blurb', text: String(tier.blurb) }));
    if (Array.isArray(tier.features)) {
        const ul = el('ul', { className: 'tier-features' });
        for (const f of tier.features) ul.appendChild(el('li', { text: String(f) }));
        children.push(ul);
    }
    for (const child of children.filter(Boolean)) card.appendChild(child);
    return card;
}
