import { describe, it, expect } from 'vitest';
import { LAYOUT_FACTORIES, LAYOUT_TYPES, renderSlide, createFallbackSlide } from '../../src/modules/slides/layouts/index.js';

/**
 * Each of the 24 layouts must produce an HTMLElement with the correct
 * data-layout attribute and no innerHTML usage (textContent-only). We don't
 * assert exact DOM trees (too brittle) but we check structural invariants.
 */

const SAMPLE_CONFIGS = {
    cover: { type: 'cover', kicker: 'K', title: 'T', subtitle: 'S', foot: 'F' },
    split: { type: 'split', kicker: 'K', title: 'T', body: 'B', media: { type: 'panel', color: 'primary' } },
    bento: { type: 'bento', kicker: 'K', title: 'T', tiles: [{ k: 'A', fig: { number: 1 } }, { k: 'B', title: 'X' }] },
    globe: { type: 'globe', kicker: 'K', title: 'T', markers: [{ location: [0, 0], label: 'place', value: '1k' }], stats: [{ value: '50%', label: 'NA' }] },
    'stat-grid': { type: 'stat-grid', kicker: 'K', title: 'T', stats: [{ value: { number: 10, suffix: '%' }, label: 'L', caption: 'C' }] },
    'big-number': { type: 'big-number', kicker: 'K', value: { number: 42, suffix: 'M' }, caption: 'cap', foot: 'F' },
    contrast: { type: 'contrast', kicker: 'K', title: 'T', left: { label: 'L', title: 'lt', points: ['a'] }, right: { label: 'R', title: 'rt', points: ['b'] } },
    quote: { type: 'quote', text: 'quoted', name: 'N', role: 'R' },
    comparison: { type: 'comparison', kicker: 'K', title: 'T', cols: ['', 'A', 'B'], highlight: 1, rows: [{ label: 'X', values: [true, false] }] },
    table: { type: 'table', kicker: 'K', title: 'T', columns: ['A', 'B'], rows: [['1', '2']], highlightCol: 1, caption: 'cap' },
    steps: { type: 'steps', kicker: 'K', title: 'T', items: [{ title: 'i1', body: 'b1' }] },
    timeline: { type: 'timeline', kicker: 'K', title: 'T', items: [{ time: 'Now', title: 'X', body: 'B' }] },
    chat: { type: 'chat', kicker: 'K', title: 'T', messages: [{ from: 'user', text: 'hi' }, { from: 'ai', text: 'hello' }] },
    pricing: { type: 'pricing', kicker: 'K', title: 'T', tiers: [{ name: 'Starter', price: '$10', period: '/mo', features: ['f1'] }] },
    accordion: { type: 'accordion', kicker: 'K', title: 'T', items: [{ title: 'q', body: 'a' }] },
    tabs: { type: 'tabs', kicker: 'K', title: 'T', tabs: [{ label: 'One', body: 'b1' }] },
    team: { type: 'team', kicker: 'K', title: 'T', people: [{ name: 'Dana Kim', role: 'CEO' }] },
    'code-window': { type: 'code-window', title: 'app.ts', highlight: [1], code: 'const x = 1\nconst y = 2' },
    'browser-frame': { type: 'browser-frame', url: 'app.example.com', screenshot: '/x.png' },
    'spotlight-card': { type: 'spotlight-card', kicker: 'K', title: 'T', cards: [{ k: '01', title: 't', body: 'b' }] },
    agenda: { type: 'agenda', kicker: 'K', title: 'T', items: ['first', { title: 'second', hint: '5 min' }] },
    section: { type: 'section', n: 2, kicker: 'Part two', title: 'How it works.' },
    marquee: { type: 'marquee', items: ['A', 'B', 'C'] },
    cta: { type: 'cta', title: 'Let’s talk', subtitle: 'hi@example.com' }
};

describe('Layout registry', () => {
    it('registers all 24 layout types', () => {
        expect(LAYOUT_TYPES.length).toBe(24);
        for (const name of Object.keys(SAMPLE_CONFIGS)) {
            expect(LAYOUT_TYPES, `missing ${name}`).toContain(name);
        }
    });

    describe('each layout returns a proper slide element', () => {
        for (const [name, config] of Object.entries(SAMPLE_CONFIGS)) {
            it(name, () => {
                const el = renderSlide(config);
                expect(el, `${name} returned null`).not.toBeNull();
                expect(el.tagName).toBe('DIV');
                expect(el.classList.contains('slide')).toBe(true);
                expect(el.dataset.layout, `${name} must set data-layout`).toBe(name);
            });
        }
    });

    it('renderSlide returns fallback for unknown type', () => {
        const el = renderSlide({ type: 'totally-made-up' });
        expect(el.dataset.layout).toBe('fallback');
    });

    it('renderSlide returns fallback for null config', () => {
        const el = renderSlide(null);
        expect(el.dataset.layout).toBe('fallback');
    });

    describe('textContent-only invariant (no innerHTML usage)', () => {
        for (const [name, config] of Object.entries(SAMPLE_CONFIGS)) {
            it(name + ' — no innerHTML set on any descendant', () => {
                const el = renderSlide(config);
                const all = [el, ...el.querySelectorAll('*')];
                for (const node of all) {
                    // innerHTML is a property; we can't directly detect "was set to".
                    // But we CAN check that there are no script tags or event handlers
                    // baked in (defense in depth for innerHTML violations).
                    expect(node.querySelectorAll('script').length, `${name} has a <script>`).toBe(0);
                    expect(node.querySelectorAll('[onclick]').length, `${name} has inline onclick`).toBe(0);
                    expect(node.querySelectorAll('[onload]').length, `${name} has inline onload`).toBe(0);
                }
            });
        }
    });

    describe('structural spot-checks', () => {
        it('cover renders kicker + title + subtitle', () => {
            const el = renderSlide(SAMPLE_CONFIGS.cover);
            expect(el.querySelector('.kicker').textContent).toBe('K');
            expect(el.querySelector('.display').textContent).toBe('T');
            expect(el.querySelector('.subhead').textContent).toBe('S');
        });

        it('big-number stamps data-figure for count-up wiring', () => {
            const el = renderSlide(SAMPLE_CONFIGS['big-number']);
            const target = el.querySelector('[data-figure]');
            expect(target).not.toBeNull();
            const figure = JSON.parse(target.dataset.figure);
            expect(figure.number).toBe(42);
            expect(figure.suffix).toBe('M');
        });

        it('chat wraps each message in a build element', () => {
            const el = renderSlide(SAMPLE_CONFIGS.chat);
            const builds = el.querySelectorAll('.build');
            expect(builds.length).toBe(2);
            expect(builds[0].dataset.buildStep).toBe('1');
            expect(builds[1].dataset.buildStep).toBe('2');
        });

        it('comparison renders bool cells with data-bool attr', () => {
            const el = renderSlide(SAMPLE_CONFIGS.comparison);
            const trueCell = el.querySelector('td[data-bool="true"]');
            const falseCell = el.querySelector('td[data-bool="false"]');
            expect(trueCell).not.toBeNull();
            expect(falseCell).not.toBeNull();
        });

        it('section stamps data-chapter', () => {
            const el = renderSlide(SAMPLE_CONFIGS.section);
            expect(el.dataset.chapter).toBe('2');
            const ghost = el.querySelector('.section-ghost');
            expect(ghost.textContent).toBe('II'); // roman numeral for 2
        });

        it('accordion uses native details/summary', () => {
            const el = renderSlide(SAMPLE_CONFIGS.accordion);
            expect(el.querySelectorAll('details').length).toBe(1);
            expect(el.querySelectorAll('summary').length).toBe(1);
        });

        it('tabs sets aria roles', () => {
            const el = renderSlide(SAMPLE_CONFIGS.tabs);
            expect(el.querySelector('[role="tablist"]')).not.toBeNull();
            expect(el.querySelector('[role="tab"]')).not.toBeNull();
            expect(el.querySelector('[role="tabpanel"]')).not.toBeNull();
        });
    });
});
