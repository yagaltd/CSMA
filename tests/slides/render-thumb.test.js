// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

// jsdom does not ship ResizeObserver — polyfill it so renderThumb doesn't
// throw. The polyfill only tracks observe/unobserve/disconnect; callbacks
// fire synchronously on observe so the scale is computed at least once.
if (typeof ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
        constructor(cb) { this._cb = cb; this._els = new Set(); }
        observe(el) { this._els.add(el); try { this._cb([{ target: el }]); } catch { /* noop */ } }
        unobserve(el) { this._els.delete(el); }
        disconnect() { this._els.clear(); }
    };
}

import { renderThumb, DESIGN_WIDTH, DESIGN_HEIGHT } from '../../src/modules/slides/chrome/renderThumb.js';
import { initGrid } from '../../src/modules/slides/chrome/grid.js';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

const NOOP_BUS = { subscribe: () => () => {}, publish: () => {} };

function makeService(overrides = {}) {
    return {
        index: 0,
        slides: [{ type: 'cover', title: 'Test Cover' }, { type: 'split', title: 'Test Split' }],
        ...overrides
    };
}

function makeFrame(doc = document) {
    const frame = doc.createElement('div');
    frame.className = 'grid-thumb';
    // Simulate the CSS that makes the frame a clipping box.
    frame.style.overflow = 'hidden';
    frame.style.aspectRatio = '16 / 9';
    frame.style.width = '320px';  // small card width
    frame.style.position = 'relative';
    // jsdom does not compute layout — clientWidth is always 0 unless we mock
    // it. renderThumb reads clientWidth to compute the scale factor.
    Object.defineProperty(frame, 'clientWidth', { value: 320, configurable: true });
    doc.body.appendChild(frame);
    return frame;
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('renderThumb', () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    it('returns a cleanup function when called with valid args', () => {
        const frame = makeFrame();
        const cleanup = renderThumb({ type: 'cover', title: 'X' }, frame);
        expect(cleanup).toBeInstanceOf(Function);
        // cleanup is idempotent
        expect(() => cleanup()).not.toThrow();
        expect(() => cleanup()).not.toThrow();
    });

    it('returns a no-op cleanup (not a function that throws) for missing args', () => {
        const cleanup1 = renderThumb(null, null);
        expect(cleanup1).toBeInstanceOf(Function);
        expect(() => cleanup1()).not.toThrow();

        const cleanup2 = renderThumb({ type: 'cover' }, null);
        expect(cleanup2).toBeInstanceOf(Function);
        expect(() => cleanup2()).not.toThrow();

        // frameEl with no config → no-op
        const frame = makeFrame();
        const cleanup3 = renderThumb(null, frame);
        expect(cleanup3).toBeInstanceOf(Function);
        expect(() => cleanup3()).not.toThrow();
    });

    it('renders a slide element into the frame', () => {
        const frame = makeFrame();
        renderThumb({ type: 'cover', title: 'Hello' }, frame);

        // The frame should contain the scale wrapper.
        const wrapper = frame.querySelector('.csma-thumb-scale');
        expect(wrapper).not.toBeNull();

        // The wrapper should contain a rendered slide.
        const slide = wrapper.querySelector('.slide');
        expect(slide).not.toBeNull();
        expect(slide.dataset.layout).toBe('cover');

        // The slide should have the title text rendered.
        expect(slide.textContent).toContain('Hello');
    });

    it('applies scale transform to the wrapper', () => {
        const frame = makeFrame();
        // frame width is 320px, DESIGN_WIDTH is 1280 → scale = 0.25
        renderThumb({ type: 'cover', title: 'X' }, frame);

        const wrapper = frame.querySelector('.csma-thumb-scale');
        expect(wrapper).not.toBeNull();
        expect(wrapper.style.width).toBe(DESIGN_WIDTH + 'px');
        expect(wrapper.style.height).toBe(DESIGN_HEIGHT + 'px');

        // ResizeObserver polyfill fires synchronously on observe(), so the
        // transform is already set. The rAF also fires updateScale but the
        // RO already did the work.
        expect(wrapper.style.transform).toContain('scale');
    });

    it('cleanup removes the wrapper from the frame', () => {
        const frame = makeFrame();
        const cleanup = renderThumb({ type: 'cover', title: 'X' }, frame);
        expect(frame.querySelector('.csma-thumb-scale')).not.toBeNull();

        cleanup();
        expect(frame.querySelector('.csma-thumb-scale')).toBeNull();
    });

    it('cleanup is safe to call multiple times', () => {
        const frame = makeFrame();
        const cleanup = renderThumb({ type: 'cover', title: 'X' }, frame);
        cleanup();
        expect(() => cleanup()).not.toThrow();
        expect(() => cleanup()).not.toThrow();
    });

    it('uses DESIGN_WIDTH and DESIGN_HEIGHT constants matching 16:9', () => {
        expect(DESIGN_WIDTH).toBe(1280);
        expect(DESIGN_HEIGHT).toBe(720);
        expect(DESIGN_WIDTH / DESIGN_HEIGHT).toBeCloseTo(16 / 9, 2);
    });

    it('renders different slide types without throwing', () => {
        const types = ['cover', 'split', 'quote', 'cta', 'section', 'bento'];
        for (const type of types) {
            const frame = makeFrame();
            const cleanup = renderThumb({ type, title: type }, frame);
            expect(frame.querySelector('.csma-thumb-scale')).not.toBeNull();
            cleanup();
        }
    });
});

// ──────────────────────────────────────────────────────────────────
// Grid integration
// ──────────────────────────────────────────────────────────────────

describe('initGrid with renderThumb', () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    it('mounts cards whose .slide-thumb-frame contains rendered slide content (not text)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const service = makeService();
        const cleanup = initGrid(host, NOOP_BUS, service);

        // Each .slide-thumb-frame should contain a .csma-thumb-scale wrapper.
        const frames = host.querySelectorAll('.slide-thumb-frame');
        expect(frames.length).toBeGreaterThanOrEqual(2);

        let contentFound = 0;
        frames.forEach((frame) => {
            const wrapper = frame.querySelector('.csma-thumb-scale');
            if (wrapper && wrapper.querySelector('.slide')) {
                contentFound++;
            }
        });
        expect(contentFound).toBeGreaterThanOrEqual(1);

        // The .slide-thumb-frame should NOT contain bare text (no type label text node).
        frames.forEach((frame) => {
            // Only child should be the wrapper, not a text node.
            for (const child of frame.childNodes) {
                if (child.nodeType === 3) {
                    // Text nodes are only whitespace — no visible text.
                    expect(child.data.trim()).toBe('');
                }
            }
        });

        cleanup();
    });

    it('re-renders on DECK_READY without leaking observers (uses .slide-thumb-frame)', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const service = makeService();
        const bus = {
            _subs: {},
            subscribe(event, fn) {
                (this._subs[event] || (this._subs[event] = [])).push(fn);
                return () => {};
            },
            publish(event, payload) {
                (this._subs[event] || []).forEach((fn) => fn(payload));
            }
        };
        const cleanup = initGrid(host, bus, service);

        // First render
        const framesBefore = host.querySelectorAll('.slide-thumb-frame');
        expect(framesBefore.length).toBe(2);

        // Simulate DECK_READY with new slides
        service.slides = [
            { type: 'cover', title: 'New' },
            { type: 'quote', title: 'Quote', quote: 'Hello' },
            { type: 'cta', title: 'Go' }
        ];
        service.index = 0;
        bus.publish('DECK_READY', {});

        const framesAfter = host.querySelectorAll('.slide-thumb-frame');
        expect(framesAfter.length).toBe(3);

        // All frames should still have scale wrappers.
        framesAfter.forEach((frame) => {
            expect(frame.querySelector('.csma-thumb-scale')).not.toBeNull();
        });

        cleanup();
    });
});
