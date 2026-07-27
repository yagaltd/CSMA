/**
 * rail.js — thumbnail sidebar (Type II).
 *
 * Subscribes to: SLIDE_CHANGED, UI_STATE_CHANGED, DECK_READY
 * Publishes: INTENT_SLIDE_GO
 *
 * Renders a vertical list of slide thumbnails using the shared
 * `createSlideThumbnail` primitive (same card root as the grid).
 * Visible only when railOpen=true.
 *
 * Phase 3.2 — aiui-native (factory-wrapping). The rail shell is spec-mounted
 * via `getComposer().mountTree()`; cards are built through the shared
 * `createSlideThumbnail` primitive. No raw `document.createElement` in
 * chrome internals.
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { createSlideThumbnail } from './SlideThumbnail.js';

export function initRail(container, eventBus, service) {
    if (!container || !eventBus) return () => {};
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return () => {};

    const composer = getComposer();

    // 1. Build + mount the rail shell (data-open set via spec → DOM dataset).
    const railSpec = spec('aside', {
        className: 'slide-rail',
        attrs: { 'aria-label': 'Slide thumbnails' },
        dataset: { open: 'false' },
        children: [
            spec('ol', { className: 'rail-list' })
        ]
    });
    const { root: rail, cleanup: unmountRail } = composer.mountTree(railSpec, container, { documentRef: doc });
    const list = rail.querySelector('.rail-list');

    // Per-render cleanup bag — createSlideThumbnail returns cleanups.
    let thumbCleanups = [];

    // Build <li> card elements via the shared primitive, append into list.
    const renderItems = () => {
        // Tear down previous thumbnails before wiping the list.
        thumbCleanups.forEach((fn) => { try { fn(); } catch { /* swallow */ } });
        thumbCleanups = [];

        list.replaceChildren();
        const slides = Array.isArray(service.slides) ? service.slides : [];

        for (let i = 0; i < slides.length; i++) {
            const { root, cleanup } = createSlideThumbnail(slides[i], {
                index: i,
                active: i === service.index,
                tag: 'li',
                documentRef: doc
            });
            if (root) {
                list.appendChild(root);
                thumbCleanups.push(cleanup);
            }
        }
    };

    renderItems();

    const onClick = (e) => {
        const item = e.target.closest('[data-index]');
        if (!item) return;
        const idx = Number(item.dataset.index);
        if (Number.isFinite(idx)) {
            eventBus.publish('INTENT_SLIDE_GO', { index: idx, timestamp: Date.now() });
        }
    };
    list.addEventListener('click', onClick);

    const subs = [];
    if (eventBus.subscribe) {
        subs.push(eventBus.subscribe('DECK_READY', renderItems));
        subs.push(eventBus.subscribe('SLIDE_CHANGED', (payload) => {
            const items = list.querySelectorAll('[data-index]');
            items.forEach((item) => {
                item.dataset.active = Number(item.dataset.index) === payload?.slide ? 'true' : 'false';
            });
        }));
        subs.push(eventBus.subscribe('UI_STATE_CHANGED', (payload) => {
            rail.dataset.open = payload?.railOpen ? 'true' : 'false';
        }));
    }

    return () => {
        thumbCleanups.forEach((fn) => { try { fn(); } catch { /* swallow */ } });
        thumbCleanups = [];
        subs.forEach((fn) => fn && fn());
        list.removeEventListener('click', onClick);
        unmountRail();
    };
}
