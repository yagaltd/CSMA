import { spec, specShell, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * pricing — tier cards. `highlight: true` on a tier gets an accent badge.
 *
 * Config: `{ kicker?, title?, tiers: [{name, price, period?, blurb?, features[], highlight?}] }`
 *
 * Emits a SPEC TREE (Phase 2.1). deck.js mounts it via the aiui composer's
 * `mountTree()`. To embed any aiui surface inside this layout (e.g. a
 * `chart-display` for a price-over-time graph), drop a
 * `component('chart-display', { ... })` node in the tier's children.
 */
export function createPricingSlide(config = {}) {
    const header = spec('div', { className: 'pricing-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const tiers = Array.isArray(config.tiers) ? config.tiers : [];
    const grid = spec('div', {
        className: 'pricing-grid',
        children: tiers.map((tier) => buildTier(tier))
    });

    return specShell('pricing', { center: true }, [specContainer([header, grid])]);
}

function buildTier(tier = {}) {
    const children = [];
    if (tier.name) children.push(spec('p', { className: 'tier-name', text: String(tier.name) }));
    if (tier.price) {
        const priceOpts = { className: 'tier-price', text: String(tier.price) };
        if (tier.period) priceOpts.dataset = { period: String(tier.period) };
        children.push(spec('p', priceOpts));
    }
    if (tier.blurb) children.push(spec('p', { className: 'tier-blurb', text: String(tier.blurb) }));
    if (Array.isArray(tier.features)) {
        children.push(spec('ul', {
            className: 'tier-features',
            children: tier.features.map((f) => spec('li', { text: String(f) }))
        }));
    }
    const cardOpts = { className: 'pricing-tier', children };
    if (tier.highlight) cardOpts.dataset = { highlight: 'true' };
    return spec('div', cardOpts);
}
