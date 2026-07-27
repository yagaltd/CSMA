/**
 * grid.js — grid overview (Type II).
 *
 * Subscribes to: SLIDE_CHANGED, UI_STATE_CHANGED, DECK_READY
 * Publishes: INTENT_SLIDE_GO
 *
 * Full-screen grid of slide thumbnails. Visible only when gridOpen=true.
 * Press Escape or click outside to close.
 *
 * Phase 3.2 — aiui-native (factory-wrapping). The grid shell is spec-mounted
 * via `getComposer().mountTree()`; cards are built through the shared
 * `createSlideThumbnail` primitive. No raw `document.createElement` in chrome
 * internals.
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { createSlideThumbnail } from './SlideThumbnail.js';

export function initGrid(container, eventBus, service) {
    if (!container || !eventBus) return () => {};
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return () => {};

    const composer = getComposer();

    // 1. Build + mount the grid shell (data-open set via spec → DOM dataset).
    const gridSpec = spec('div', {
        className: 'slide-grid',
        attrs: { 'aria-label': 'Slide overview' },
        dataset: { open: 'false' },
        children: [
            spec('div', { className: 'grid-inner' })
        ]
    });
    const { root: grid, cleanup: unmountGrid } = composer.mountTree(gridSpec, container, { documentRef: doc });
    const inner = grid.querySelector('.grid-inner');

    // Per-render cleanup bag — createSlideThumbnail returns cleanups
    // (renderThumb teardown + mountTree unmount) that must run before
    // the next renderItems().
    let thumbCleanups = [];

    // Build card elements via the shared primitive, append into inner.
    const renderItems = () => {
        // Tear down previous thumbnails before wiping inner.
        thumbCleanups.forEach((fn) => { try { fn(); } catch { /* swallow */ } });
        thumbCleanups = [];

        inner.replaceChildren();
        const slides = Array.isArray(service.slides) ? service.slides : [];

        for (let i = 0; i < slides.length; i++) {
            const { root, cleanup } = createSlideThumbnail(slides[i], {
                index: i,
                active: i === service.index,
                tag: 'button',
                documentRef: doc
            });
            if (root) {
                inner.appendChild(root);
                thumbCleanups.push(cleanup);
            }
        }
    };

    renderItems();

    const onClick = (e) => {
        const card = e.target.closest('[data-index]');
        if (card) {
            const idx = Number(card.dataset.index);
            if (Number.isFinite(idx)) {
                eventBus.publish('INTENT_SLIDE_GO', { index: idx, timestamp: Date.now() });
            }
        } else if (e.target === grid) {
            // Click on backdrop closes
            eventBus.publish('INTENT_SLIDE_ESCAPE', { timestamp: Date.now() });
        }
    };
    grid.addEventListener('click', onClick);

    const subs = [];
    if (eventBus.subscribe) {
        subs.push(eventBus.subscribe('DECK_READY', renderItems));
        subs.push(eventBus.subscribe('SLIDE_CHANGED', (payload) => {
            const items = inner.querySelectorAll('[data-index]');
            items.forEach((item) => {
                item.dataset.active = Number(item.dataset.index) === payload?.slide ? 'true' : 'false';
            });
        }));
        subs.push(eventBus.subscribe('UI_STATE_CHANGED', (payload) => {
            grid.dataset.open = payload?.gridOpen ? 'true' : 'false';
        }));
    }

    return () => {
        thumbCleanups.forEach((fn) => { try { fn(); } catch { /* swallow */ } });
        thumbCleanups = [];
        subs.forEach((fn) => fn && fn());
        grid.removeEventListener('click', onClick);
        unmountGrid();
    };
}
