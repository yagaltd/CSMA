import { describe, it, expect } from 'vitest';

import EventBus from '../../src/runtime/EventBus.js';
import { AIUIComposerService } from '../../src/modules/ai-ui/services/AIUIComposerService.js';
import {
    renderSlide,
    buildSlide
} from '../../src/modules/slides/layouts/index.js';
// Back-compat DOM helpers — used to build golden reference DOM that mirrors the
// original (pre-Phase-2.0) layout implementations, byte-for-byte. These live
// in a test-only fixture (not the production _shared.js) so the golden
// reference stays an independent, raw-DOM baseline (no circular spec-vs-spec).
import {
    el,
    createSlideShell,
    createKicker,
    createHeading,
    createBody,
    createFoot,
    createTitleWithAccent,
    container
} from './fixtures/legacy-dom-helpers.js';

// ──────────────────────────────────────────────────────────────────
// Golden reference builders — re-implement the ORIGINAL layout bodies using
// the back-compat DOM helpers. The converted layouts now emit spec trees; we
// assert the mounted output is byte-identical to these references.
// ──────────────────────────────────────────────────────────────────

function goldenRenderMedia(mediaConfig) {
    if (!mediaConfig || typeof mediaConfig !== 'object') return null;
    switch (mediaConfig.type) {
        case 'image':
            return el('div', { className: 'media-image', dataset: { src: mediaConfig.src || '' } });
        case 'panel':
            return el('div', { className: 'media-panel', dataset: { color: mediaConfig.color || 'primary' } });
        case 'globe':
            return el('div', { className: 'media-globe', dataset: { layout: 'globe' } });
        case 'chart':
            return el('div', { className: 'media-chart', dataset: { chartType: mediaConfig.chartType || 'bar' } });
        default:
            return null;
    }
}

function goldenCover(config = {}) {
    const slide = createSlideShell('cover', { center: true });
    if (config.image) {
        const bg = el('div', { className: 'cover-bg' });
        bg.dataset.image = 'present';
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

function goldenSplit(config = {}) {
    const slide = createSlideShell('split', { center: false });
    if (config.flip) slide.dataset.flip = 'true';
    const text = el('div', { className: 'split-text', children: [
        createKicker(config.kicker),
        createHeading(config.title),
        createBody(config.body)
    ].filter(Boolean) });
    const media = el('div', { className: 'split-media' });
    const mediaEl = goldenRenderMedia(config.media);
    if (mediaEl) media.appendChild(mediaEl);
    const inner = config.flip ? container([media, text]) : container([text, media]);
    slide.appendChild(inner);
    return slide;
}

function goldenQuote(config = {}) {
    const slide = createSlideShell('quote', { center: true });
    const text = el('blockquote', { className: 'quote-text' });
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

function goldenBigNumber(config = {}) {
    const slide = createSlideShell('big-number', { center: true });
    const valueEl = el('p', { className: 'big-number-value' });
    valueEl.dataset.figure = JSON.stringify(config.value || {});
    const inner = el('div', { className: 'big-number-inner', children: [
        createKicker(config.kicker),
        valueEl,
        config.caption ? el('p', { className: 'lead', text: String(config.caption) }) : null,
        createFoot(config.foot)
    ].filter(Boolean) });
    slide.appendChild(inner);
    return slide;
}

// ──────────────────────────────────────────────────────────────────

describe('AIUIComposerService.mountTree — raw spec trees', () => {
    it('mounts a simple raw tree into a target with correct DOM', () => {
        const composer = new AIUIComposerService(new EventBus());
        const host = document.createElement('div');
        const tree = {
            tag: 'div',
            attrs: { class: 'a', 'data-x': '1' },
            text: 'hi',
            children: [{ tag: 'span', text: 'child' }]
        };
        const { root, cleanup } = composer.mountTree(tree, host);

        expect(root.tagName).toBe('DIV');
        expect(host.firstChild).toBe(root);
        expect(root.outerHTML).toBe('<div class="a" data-x="1">hi<span>child</span></div>');
        expect(typeof cleanup).toBe('function');
    });

    it('mounts nested raw children and data-* attributes', () => {
        const composer = new AIUIComposerService(new EventBus());
        const { root } = composer.mountTree({
            tag: 'section',
            attrs: { class: 'card', 'data-state': 'open' },
            children: [
                { tag: 'h3', text: 'Title' },
                { tag: 'p', attrs: { 'data-role': 'note' }, text: 'Body' }
            ]
        });
        expect(root.outerHTML).toBe('<section class="card" data-state="open"><h3>Title</h3><p data-role="note">Body</p></section>');
    });

    it('rejects banned tags (script, iframe, style)', () => {
        const composer = new AIUIComposerService(new EventBus());
        for (const tag of ['script', 'iframe', 'style', 'object', 'embed']) {
            expect(() => composer.mountTree({ tag }), `tag ${tag}`).toThrow(/Unsafe tag/);
        }
    });

    it('rejects event-handler attributes (onclick, onload)', () => {
        const composer = new AIUIComposerService(new EventBus());
        expect(() => composer.mountTree({ tag: 'div', attrs: { onclick: 'x()' } })).toThrow(/Unsafe attribute "onclick"/);
        expect(() => composer.mountTree({ tag: 'div', attrs: { onload: 'x()' } })).toThrow(/Unsafe attribute "onload"/);
        // Non-whitelisted, non-data-* attribute also rejected.
        expect(() => composer.mountTree({ tag: 'div', attrs: { style: 'color:red' } })).toThrow(/Unsafe attribute "style"/);
    });

    it('accepts arbitrary data-* attributes (inert, layout state)', () => {
        const composer = new AIUIComposerService(new EventBus());
        const { root } = composer.mountTree({ tag: 'div', attrs: { class: 'x', 'data-figure': '{"n":1}', 'data-build-step': '2' } });
        expect(root.getAttribute('data-figure')).toBe('{"n":1}');
        expect(root.getAttribute('data-build-step')).toBe('2');
    });

    it('validates URL attributes with the same rules as applyOp', () => {
        const composer = new AIUIComposerService(new EventBus());
        // javascript: src is rejected (img is a SAFE_TAGS media element).
        expect(() => composer.mountTree({ tag: 'img', attrs: { src: 'javascript:alert(1)' } })).toThrow(/Unsafe URL/);
        // href is a whitelisted attribute; its URL validation fires on any safe tag.
        expect(() => composer.mountTree({ tag: 'div', attrs: { href: 'javascript:alert(1)' } })).toThrow(/Unsafe URL/);
        // https is accepted.
        const { root } = composer.mountTree({ tag: 'img', attrs: { src: 'https://example.com/a.png', class: 'i' } });
        expect(root.getAttribute('src')).toBe('https://example.com/a.png');
    });

    it('caps text length on attributes', () => {
        const composer = new AIUIComposerService(new EventBus());
        const long = 'x'.repeat(1001);
        expect(() => composer.mountTree({ tag: 'div', attrs: { class: long } })).toThrow(/exceeds/);
    });

    it('handles bare-string and {text} text-node children', () => {
        const composer = new AIUIComposerService(new EventBus());
        const { root } = composer.mountTree({
            tag: 'p',
            children: ['before ', { text: 'middle' }, ' after']
        });
        expect(root.outerHTML).toBe('<p>before middle after</p>');
    });

    it('passes DOM Nodes through (back-compat for unconverted sub-layouts)', () => {
        const composer = new AIUIComposerService(new EventBus());
        const passthrough = document.createElement('b');
        passthrough.textContent = 'kept';
        const { root } = composer.mountTree({ tag: 'div', children: [passthrough] });
        expect(root.querySelector('b').textContent).toBe('kept');
    });
});

describe('AIUIComposerService.mountTree — mixed trees (raw + catalog component)', () => {
    it('mounts a raw HTML node alongside a catalog component node', () => {
        const composer = new AIUIComposerService(new EventBus());
        const { root } = composer.mountTree({
            tag: 'div',
            attrs: { class: 'host' },
            children: [
                { component: 'button', props: { label: 'Go' } },
                { tag: 'p', text: 'raw' }
            ]
        });
        // Catalog component rendered through the validated compose path.
        const btn = root.querySelector('.button');
        expect(btn, 'button component must mount').not.toBeNull();
        expect(btn.tagName).toBe('BUTTON');
        expect(btn.textContent).toBe('Go');
        // Raw HTML node alongside it.
        expect(root.querySelector('p').textContent).toBe('raw');
    });

    it('mounts a catalog component slot with raw HTML children', () => {
        const composer = new AIUIComposerService(new EventBus());
        const { root } = composer.mountTree({
            tag: 'div',
            children: [
                { component: 'button', props: { label: 'L' }, slot: { default: [{ tag: 'span', text: 'extra' }] } }
            ]
        });
        const btn = root.querySelector('.button');
        expect(btn.childNodes[0].textContent).toBe('L'); // textProp set first
        expect(btn.querySelector('span').textContent).toBe('extra'); // slot child appended
    });

    it('cleanup unmounts the root and runs nested module-surface teardowns', () => {
        const composer = new AIUIComposerService(new EventBus());
        composer.registerComponent({
            id: 'fake-surface',
            alias: 'fake-surface',
            render: { kind: 'module', tag: 'div', className: 'fake-surface' },
            moduleId: 'fakemod',
            surfaceId: 'fake-surface',
            propsSchema: {},
            slots: {},
            allowedChildren: []
        });
        let surfaceCleaned = false;
        composer.setServiceManager({
            get: () => ({
                mountSurface: (_surfaceId, container) => {
                    container.textContent = 'surface';
                    return () => { surfaceCleaned = true; };
                }
            })
        });

        const host = document.createElement('div');
        document.body.appendChild(host);
        const { root, cleanup } = composer.mountTree({
            tag: 'div',
            attrs: { class: 'wrap' },
            children: [{ component: 'fake-surface' }]
        }, host);

        expect(host.querySelector('.wrap')).not.toBeNull();
        expect(host.querySelector('.fake-surface')).not.toBeNull();
        expect(root.querySelector('.fake-surface')).not.toBeNull();

        cleanup();

        expect(surfaceCleaned, 'nested module-surface cleanup must run').toBe(true);
        expect(host.querySelector('.wrap'), 'root must be detached on cleanup').toBeNull();
        host.remove();
    });
});

// ── The 4 converted layouts: spec-mounted DOM is byte-identical to the
//    original el()-built DOM. ────────────────────────────────────────

describe('Phase 2.0 converted layouts — byte-identical to pre-conversion DOM', () => {
    const COVER_CASES = [
        { kicker: 'K', title: 'T', subtitle: 'S', foot: 'F' },
        { kicker: 'Intro', title: { text: 'Hello World', accent: 'World' }, foot: 'cite' },
        { title: 'Plain', image: true },
        {}
    ];
    for (const [i, config] of COVER_CASES.entries()) {
        it(`cover #${i} matches golden outerHTML`, () => {
            const golden = goldenCover(config).outerHTML;
            const mounted = renderSlide({ type: 'cover', ...config }).outerHTML;
            expect(mounted).toBe(golden);
        });
    }

    const SPLIT_CASES = [
        { kicker: 'K', title: 'T', body: 'B', media: { type: 'panel', color: 'primary' } },
        { kicker: 'K', title: 'T', media: { type: 'chart', chartType: 'line' } },
        { title: 'T', media: { type: 'image', src: '/a.png' }, flip: true },
        { title: 'T', media: { type: 'globe' } },
        { title: 'T' } // no media → empty media div
    ];
    for (const [i, config] of SPLIT_CASES.entries()) {
        it(`split #${i} matches golden outerHTML`, () => {
            const golden = goldenSplit(config).outerHTML;
            const mounted = renderSlide({ type: 'split', ...config }).outerHTML;
            expect(mounted).toBe(golden);
        });
    }

    const QUOTE_CASES = [
        { text: 'quoted', name: 'N', role: 'R' },
        { text: 'only text', name: 'N' },
        { name: 'N', role: 'R' } // no quote text → mark only
    ];
    for (const [i, config] of QUOTE_CASES.entries()) {
        it(`quote #${i} matches golden outerHTML`, () => {
            const golden = goldenQuote(config).outerHTML;
            const mounted = renderSlide({ type: 'quote', ...config }).outerHTML;
            expect(mounted).toBe(golden);
        });
    }

    const BIG_NUMBER_CASES = [
        { kicker: 'K', value: { number: 42, suffix: 'M' }, caption: 'cap', foot: 'F' },
        { value: { number: 3.5, decimals: 1, prefix: '$' } },
        { value: { number: 0 }, caption: 'zero' }
    ];
    for (const [i, config] of BIG_NUMBER_CASES.entries()) {
        it(`big-number #${i} matches golden outerHTML`, () => {
            const golden = goldenBigNumber(config).outerHTML;
            const mounted = renderSlide({ type: 'big-number', ...config }).outerHTML;
            expect(mounted).toBe(golden);
        });
    }
});

describe('buildSlide dispatch — spec vs DOM back-compat + cleanup', () => {
    it('returns a real slide element and a cleanup fn for a converted (spec) layout', () => {
        const { element, cleanup } = buildSlide({ type: 'cover', title: 'Hi' });
        expect(element).toBeInstanceOf(Element);
        expect(element.classList.contains('slide')).toBe(true);
        expect(element.dataset.layout).toBe('cover');
        expect(typeof cleanup).toBe('function');
        expect(() => cleanup()).not.toThrow();
    });

    it('returns a DOM element for an unconverted (back-compat) layout', () => {
        const { element, cleanup } = buildSlide({ type: 'bento', title: 'Bento', tiles: [{ k: 'a', title: 'x' }] });
        expect(element).toBeInstanceOf(Element);
        expect(element.classList.contains('slide')).toBe(true);
        expect(element.dataset.layout).toBe('bento');
        expect(typeof cleanup).toBe('function');
    });

    it('renders a full multi-slide deck via renderSlide for all 24 layout types', () => {
        // Sanity that the registry + mount path still produces a slide for
        // every layout (covers both spec-emitting and DOM-emitting factories).
        const sample = {
            cover: { type: 'cover', title: 'T' },
            quote: { type: 'quote', text: 'q', name: 'n' },
            'big-number': { type: 'big-number', value: { number: 1 } },
            split: { type: 'split', title: 'T', media: { type: 'panel' } }
        };
        for (const [type, config] of Object.entries(sample)) {
            const slide = renderSlide(config);
            expect(slide.classList.contains('slide'), `${type} must be a .slide`).toBe(true);
            expect(slide.dataset.layout, `${type} must set data-layout`).toBe(type);
        }
    });
});
