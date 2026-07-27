/**
 * @vitest-environment jsdom
 *
 * Unit tests for the shared slide-thumbnail primitive (SlideThumbnail.js).
 *
 * Verifies: returns {root, cleanup}; root has data-index + data-active;
 * contains .slide-thumb-frame with a rendered .csma-thumb-scale child;
 * num badge text = index+1; label span present when label passed;
 * cleanup removes the thumb content.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// jsdom ResizeObserver polyfill (same as render-thumb.test.js).
if (typeof ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
        constructor(cb) { this._cb = cb; this._els = new Set(); }
        observe(el) { this._els.add(el); try { this._cb([{ target: el }]); } catch { /* noop */ } }
        unobserve(el) { this._els.delete(el); }
        disconnect() { this._els.clear(); }
    };
}

import { createSlideThumbnail } from '../../src/modules/slides/chrome/SlideThumbnail.js';

// ── helpers ────────────────────────────────────────────────────────────

/**
 * Set a fake clientWidth on an element so renderThumb can compute the scale.
 * jsdom does not compute layout, so clientWidth is always 0.
 */
function setClientWidth(el, w) {
    Object.defineProperty(el, 'clientWidth', { value: w, configurable: true });
}

/**
 * Create and append a card, then stub clientWidth on the frame so the scale
 * transform is computed. Returns the same shape createSlideThumbnail does.
 */
function mountCard(config, opts = {}) {
    const { root, cleanup } = createSlideThumbnail(config, opts);
    if (root) {
        document.body.appendChild(root);
        const frame = root.querySelector('.slide-thumb-frame');
        if (frame) setClientWidth(frame, 320);
    }
    return { root, cleanup };
}

// ── tests ──────────────────────────────────────────────────────────────

describe('createSlideThumbnail', () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    it('returns { root, cleanup } for a valid config', () => {
        const result = createSlideThumbnail({ type: 'cover', title: 'Hello' }, { index: 0 });
        expect(result).toHaveProperty('root');
        expect(result).toHaveProperty('cleanup');
        expect(result.root).toBeInstanceOf(HTMLElement);
        expect(result.cleanup).toBeInstanceOf(Function);
    });

    it('returns { root: null, cleanup: fn } for missing config', () => {
        const result = createSlideThumbnail(null, { index: 0 });
        expect(result.root).toBeNull();
        expect(result.cleanup).toBeInstanceOf(Function);
        expect(() => result.cleanup()).not.toThrow();
    });

    it('root has data-index and data-active attributes', () => {
        const { root } = mountCard({ type: 'cover', title: 'X' }, { index: 3, active: true });
        expect(root.dataset.index).toBe('3');
        expect(root.dataset.active).toBe('true');
    });

    it('root has data-active="false" when active is false', () => {
        const { root } = mountCard({ type: 'cover', title: 'X' }, { index: 0, active: false });
        expect(root.dataset.active).toBe('false');
    });

    it('root contains .slide-thumb-frame with rendered .csma-thumb-scale child', () => {
        const { root } = mountCard({ type: 'cover', title: 'Thumb Test' }, { index: 0 });
        const frame = root.querySelector('.slide-thumb-frame');
        expect(frame).not.toBeNull();
        const scale = frame.querySelector('.csma-thumb-scale');
        expect(scale).not.toBeNull();
        // The scale wrapper should contain a real slide element.
        const slide = scale.querySelector('.slide');
        expect(slide).not.toBeNull();
    });

    it('num badge text equals index + 1', () => {
        const { root } = mountCard({ type: 'cover', title: 'X' }, { index: 4 });
        const num = root.querySelector('.slide-thumb-num');
        expect(num).not.toBeNull();
        expect(num.textContent).toBe('5');
    });

    it('label span is present when label is passed', () => {
        const { root } = mountCard({ type: 'cover', title: 'X' }, { index: 0, label: 'Slide 1' });
        const label = root.querySelector('.slide-thumb-label');
        expect(label).not.toBeNull();
        expect(label.textContent).toBe('Slide 1');
    });

    it('label span is absent when label is null', () => {
        const { root } = mountCard({ type: 'cover', title: 'X' }, { index: 0, label: null });
        expect(root.querySelector('.slide-thumb-label')).toBeNull();
    });

    it('label span is absent when label is not passed', () => {
        const { root } = mountCard({ type: 'cover', title: 'X' }, { index: 0 });
        expect(root.querySelector('.slide-thumb-label')).toBeNull();
    });

    it('cleanup removes the card from the DOM', () => {
        const { root, cleanup } = mountCard({ type: 'cover', title: 'X' }, { index: 0 });
        expect(document.body.contains(root)).toBe(true);
        cleanup();
        expect(document.body.contains(root)).toBe(false);
    });

    it('cleanup is safe to call multiple times', () => {
        const { cleanup } = mountCard({ type: 'cover', title: 'X' }, { index: 0 });
        expect(() => cleanup()).not.toThrow();
        expect(() => cleanup()).not.toThrow();
    });

    it('uses the tag option ("li") for rail-style cards', () => {
        const { root } = mountCard({ type: 'cover', title: 'X' }, { index: 0, tag: 'li' });
        expect(root.tagName).toBe('LI');
        expect(root.classList.contains('slide-thumb-card')).toBe(true);
    });

    it('uses the tag option ("button") by default', () => {
        const { root } = mountCard({ type: 'cover', title: 'X' }, { index: 0 });
        expect(root.tagName).toBe('BUTTON');
    });
});
