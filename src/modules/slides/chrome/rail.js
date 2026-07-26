/**
 * rail.js — thumbnail sidebar (Type II).
 *
 * Subscribes to: SLIDE_CHANGED, UI_STATE_CHANGED, DECK_READY
 * Publishes: INTENT_SLIDE_GO
 *
 * Renders a vertical list of thumbnail labels (canvas thumbnails are a Phase 5+
 * optimization; v1 uses labeled placeholders that share styling with the grid
 * chrome). Visible only when railOpen=true.
 *
 * Phase 3.2 — aiui-native (factory-wrapping). The rail shell + items are
 * spec-mounted via `getComposer().mountTree()`; dynamic re-renders (DECK_READY)
 * mount a fresh item spec subtree into the shell's `.rail-list`. No raw
 * `document.createElement` in chrome internals.
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';

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

    // Build an item spec subtree for the current slide list, mounted into list.
    const renderItems = () => {
        list.replaceChildren();
        const slides = Array.isArray(service.slides) ? service.slides : [];
        const itemSpecs = slides.map((slide, i) => {
            const label = slide?.type ? slide.type : ('slide ' + (i + 1));
            return spec('li', {
                className: 'rail-item',
                dataset: { index: String(i), active: i === service.index ? 'true' : 'false' },
                children: [
                    spec('span', { className: 'rail-thumb', text: String(label) }),
                    spec('span', { className: 'rail-num', text: String(i + 1) })
                ]
            });
        });
        composer.mountTree(itemSpecs, list, { documentRef: doc });
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
        subs.forEach((fn) => fn && fn());
        list.removeEventListener('click', onClick);
        unmountRail();
    };
}
