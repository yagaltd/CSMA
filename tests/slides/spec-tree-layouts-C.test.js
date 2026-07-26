import { describe, it, expect } from 'vitest';

import EventBus from '../../src/runtime/EventBus.js';
import { AIUIComposerService } from '../../src/modules/ai-ui/services/AIUIComposerService.js';
import { renderSlide } from '../../src/modules/slides/layouts/index.js';
// Back-compat DOM helpers — used to build golden reference DOM that mirrors the
// original (pre-Phase-2.1-C) layout implementations, byte-for-byte. These live
// in a test-only fixture (not the production _shared.js) so the golden
// reference stays an independent, raw-DOM baseline (no circular spec-vs-spec).
import {
    el,
    createSlideShell,
    createKicker,
    createHeading,
    container
} from './fixtures/legacy-dom-helpers.js';

// ──────────────────────────────────────────────────────────────────
// Golden reference builders — re-implement the ORIGINAL layout bodies using
// the back-compat DOM helpers. The converted layouts now emit spec trees; we
// assert the mounted output is byte-identical to these references.
// ──────────────────────────────────────────────────────────────────

function goldenAgenda(config = {}) {
    const slide = createSlideShell('agenda', { center: true });
    const header = el('div', { className: 'agenda-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });
    const list = el('ol', { className: 'agenda-list' });
    const items = Array.isArray(config.items) ? config.items : [];
    items.forEach((item) => {
        const li = el('li', { className: 'agenda-item' });
        const title = typeof item === 'string' ? item : (item?.title || '');
        li.appendChild(el('span', { className: 'agenda-title', text: String(title) }));
        if (item && typeof item === 'object' && item.hint) {
            li.appendChild(el('span', { className: 'agenda-hint', text: String(item.hint) }));
        }
        list.appendChild(li);
    });
    slide.appendChild(container([header, list]));
    return slide;
}

function goldenMarquee(config = {}) {
    const slide = createSlideShell('marquee', { center: true });
    const track = el('div', { className: 'marquee-track' });
    const items = Array.isArray(config.items) ? config.items : [];
    const sequence = items.length > 0 ? items.concat(items) : [];
    for (const item of sequence) {
        track.appendChild(el('span', { className: 'marquee-item', text: String(item) }));
    }
    slide.appendChild(container([track]));
    return slide;
}

function goldenSpotlightCard(config = {}) {
    const slide = createSlideShell('spotlight-card', { center: true });
    const header = el('div', { className: 'spotlight-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });
    const grid = el('div', { className: 'spotlight-grid' });
    const cards = Array.isArray(config.cards) ? config.cards.slice(0, 3) : [];
    cards.forEach((card) => grid.appendChild(buildGoldenSpotlightCard(card)));
    slide.appendChild(container([header, grid]));
    return slide;
}

function buildGoldenSpotlightCard(card = {}) {
    const node = el('div', { className: 'spotlight-card' });
    const children = [];
    if (card.k) children.push(el('p', { className: 'spotlight-k', text: String(card.k) }));
    if (card.title) children.push(el('h3', { className: 'spotlight-title', text: String(card.title) }));
    if (card.body) children.push(el('p', { className: 'spotlight-body', text: String(card.body) }));
    for (const child of children.filter(Boolean)) node.appendChild(child);
    return node;
}

function goldenAccordion(config = {}) {
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

function goldenPricing(config = {}) {
    const slide = createSlideShell('pricing', { center: true });
    const header = el('div', { className: 'pricing-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });
    const grid = el('div', { className: 'pricing-grid' });
    const tiers = Array.isArray(config.tiers) ? config.tiers : [];
    tiers.forEach((tier) => grid.appendChild(buildGoldenTier(tier)));
    slide.appendChild(container([header, grid]));
    return slide;
}

function buildGoldenTier(tier = {}) {
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

// ──────────────────────────────────────────────────────────────────
// Test cases
// ──────────────────────────────────────────────────────────────────

const AGENDA_CASES = [
    { kicker: 'Today', title: 'Agenda', items: ['Intro', { title: 'Deep dive', hint: '5 min' }, { title: 'Q&A' }] },
    { items: [] },
    { items: ['solo'] },
    {}
];

const MARQUEE_CASES = [
    { items: ['A', 'B', 'C'] },
    { items: [] },
    { items: ['solo'] },
    {}
];

const SPOTLIGHT_CASES = [
    { kicker: 'K', title: 'T', cards: [{ k: '01', title: 't', body: 'b' }] },
    { cards: [] },
    { cards: [{ k: '01', title: 'a' }, { k: '02', title: 'b' }, { k: '03', title: 'c' }, { k: '04', title: 'd' }] }, // slice(0,3)
    { cards: [{ title: 'no-k-no-body' }] },
    {}
];

const ACCORDION_CASES = [
    { kicker: 'K', title: 'FAQ', items: [{ title: 'q1', body: 'a1' }, { title: 'q2', body: 'a2' }] },
    { items: [] },
    { items: [{ title: 'no body' }] },
    {}
];

const PRICING_CASES = [
    { kicker: 'K', title: 'Tiers', tiers: [{ name: 'Starter', price: '$10', period: '/mo', features: ['f1', 'f2'], highlight: true }] },
    { tiers: [] },
    { tiers: [{ name: 'Free', price: '$0' }] },
    { tiers: [{ name: 'Pro', price: '$50', period: '/yr', blurb: 'Best', features: ['a', 'b'] }] },
    { tiers: [{ name: 'X', price: '€9', period: '/mo', highlight: false }] },
    {}
];

describe('Phase 2.1-C — spec-tree layouts match golden DOM byte-for-byte', () => {
    for (const [i, config] of AGENDA_CASES.entries()) {
        it(`agenda #${i} matches golden outerHTML`, () => {
            const golden = goldenAgenda(config).outerHTML;
            const mounted = renderSlide({ type: 'agenda', ...config }).outerHTML;
            expect(mounted).toBe(golden);
        });
    }

    for (const [i, config] of MARQUEE_CASES.entries()) {
        it(`marquee #${i} matches golden outerHTML`, () => {
            const golden = goldenMarquee(config).outerHTML;
            const mounted = renderSlide({ type: 'marquee', ...config }).outerHTML;
            expect(mounted).toBe(golden);
        });
    }

    for (const [i, config] of SPOTLIGHT_CASES.entries()) {
        it(`spotlight-card #${i} matches golden outerHTML`, () => {
            const golden = goldenSpotlightCard(config).outerHTML;
            const mounted = renderSlide({ type: 'spotlight-card', ...config }).outerHTML;
            expect(mounted).toBe(golden);
        });
    }

    for (const [i, config] of ACCORDION_CASES.entries()) {
        it(`accordion #${i} matches golden outerHTML`, () => {
            const golden = goldenAccordion(config).outerHTML;
            const mounted = renderSlide({ type: 'accordion', ...config }).outerHTML;
            expect(mounted).toBe(golden);
        });
    }

    for (const [i, config] of PRICING_CASES.entries()) {
        it(`pricing #${i} matches golden outerHTML`, () => {
            const golden = goldenPricing(config).outerHTML;
            const mounted = renderSlide({ type: 'pricing', ...config }).outerHTML;
            expect(mounted).toBe(golden);
        });
    }
});
