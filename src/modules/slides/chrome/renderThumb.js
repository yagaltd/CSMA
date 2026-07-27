/**
 * renderThumb.js — scaled slide thumbnail renderer.
 *
 * Renders a real slide (via buildSlide from layouts/index.js) into a fixed
 * design-size frame, then CSS-transforms it down to fit the frame's pixel
 * width. The frame acts as a clipping window via overflow:hidden + aspect-ratio.
 *
 * Reusable: the comments drawer (change D) and any other chrome that needs a
 * miniature slide preview can import and call `renderThumb()`.
 *
 * Inline styles: ONLY the scale wrapper's width / height / transform are set
 * inline (pixel math, same exception as overlay-manager popover placement).
 * All other visual state is CSS (classes + tokens).
 */

import { buildSlide } from '../layouts/index.js';
import { spec, getComposer } from '../../ai-ui/specHelpers.js';

// ──────────────────────────────────────────────────────────────────
// Design size — the logical coordinate space the slide renders in.
// Slides fill 100% of their container; at 1280×720 they behave exactly as
// they would on a 16:9 viewport of that size. CSMA fonts use clamp() so
// they resolve sensibly at 1280px.
// ──────────────────────────────────────────────────────────────────
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

const SCALE_CLASS = 'csma-thumb-scale';

/**
 * Render a scaled slide thumbnail into `frameEl`.
 *
 * @param {object} config — slide config (type, title, etc.)
 * @param {HTMLElement} frameEl — the clipping frame (must have overflow:hidden +
 *        an aspect-ratio set via CSS)
 * @param {object} [opts]
 * @param {Document} [opts.documentRef] — document to create nodes in
 * @param {object} [opts.composer] — AIUIComposerService (defaults to the
 *        raw-mount-only composer from buildSlide)
 * @returns {() => void} cleanup — tears down the thumbnail (disconnects
 *          observer, unmounts aiui surfaces, removes wrapper)
 */
export function renderThumb(config, frameEl, opts = {}) {
    const doc = opts.documentRef || (frameEl && frameEl.ownerDocument) || (typeof document !== 'undefined' ? document : null);
    if (!doc || !frameEl || !config) return () => {};

    const buildOpts = {};
    if (opts.composer) buildOpts.composer = opts.composer;

    const { element: slideEl, cleanup: slideCleanup } = buildSlide(config, buildOpts);
    if (!slideEl) return () => {};

    const composer = getComposer();

    // Build the scale wrapper via spec + mountTree so we stay aiui-native.
    // The slide element itself (a DOM Node from buildSlide) is appended via
    // DOM passthrough — mountTree passes it through as-is.
    const wrapperSpec = spec('div', { className: SCALE_CLASS });
    const { root: wrapper, cleanup: unmountWrapper } = composer.mountTree(wrapperSpec, null, { documentRef: doc });

    // Set inline dimensions before appending (pixel math — the one allowed
    // inline-style exception, like overlay-manager popover placement).
    wrapper.style.width = DESIGN_WIDTH + 'px';
    wrapper.style.height = DESIGN_HEIGHT + 'px';

    // Append the live slide element into the wrapper.
    wrapper.appendChild(slideEl);

    // Append the wrapper into the clipping frame.
    frameEl.appendChild(wrapper);

    // ── Scale computation ──────────────────────────────────────────
    const updateScale = () => {
        const frameW = frameEl.clientWidth;
        if (frameW <= 0) return;
        const scale = frameW / DESIGN_WIDTH;
        wrapper.style.transform = `scale(${scale})`;
    };

    // Defer first paint so fonts / layout settle.
    const rafId = requestAnimationFrame(() => {
        updateScale();
    });

    // Keep scale in sync if the frame resizes (grid column changes, window
    // resize, etc.). ResizeObserver may be absent in test environments
    // (jsdom) — degrade gracefully.
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => updateScale());
        ro.observe(frameEl);
    }

    // ── Cleanup ────────────────────────────────────────────────────
    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        cancelAnimationFrame(rafId);
        if (ro) ro.disconnect();
        // Remove the wrapper from the frame (safe even if already removed).
        if (wrapper.parentNode === frameEl) {
            frameEl.removeChild(wrapper);
        }
        // Tear down the slide's own aiui surfaces (if any).
        slideCleanup();
        // Tear down the wrapper's mountTree binding (no-op for raw elements,
        // but correct).
        unmountWrapper();
    };

    return cleanup;
}
