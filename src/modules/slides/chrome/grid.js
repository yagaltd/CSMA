/**
 * grid.js — grid overview (Type II).
 *
 * Subscribes to: SLIDE_CHANGED, UI_STATE_CHANGED, DECK_READY
 * Publishes: INTENT_SLIDE_GO
 *
 * Full-screen grid of slide labels. Visible only when gridOpen=true. Press
 * Escape or click outside to close.
 *
 * Phase 3.2 — aiui-native (factory-wrapping). The grid shell + cards are
 * spec-mounted via `getComposer().mountTree()`; dynamic re-renders (DECK_READY)
 * mount a fresh card spec subtree into the shell's `.grid-inner`. No raw
 * `document.createElement` in chrome internals.
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';

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

    // Build a card spec subtree for the current slide list, mounted into inner.
    const renderItems = () => {
        inner.replaceChildren();
        const slides = Array.isArray(service.slides) ? service.slides : [];
        const cardSpecs = slides.map((slide, i) => {
            const label = slide?.type ? slide.type : ('slide ' + (i + 1));
            return spec('button', {
                className: 'grid-card',
                dataset: { index: String(i), active: i === service.index ? 'true' : 'false' },
                children: [
                    spec('span', { className: 'grid-thumb', text: String(label) }),
                    spec('span', { className: 'grid-num', text: String(i + 1) })
                ]
            });
        });
        // mountTree accepts a spec array (mounts a fragment) into inner. Cards
        // are pure raw HTML (no catalog surfaces), so their cleanup is a no-op
        // beyond DOM removal — re-renders clear inner above.
        composer.mountTree(cardSpecs, inner, { documentRef: doc });
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
        subs.forEach((fn) => fn && fn());
        grid.removeEventListener('click', onClick);
        unmountGrid();
    };
}
