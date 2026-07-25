/**
 * rail.js — thumbnail sidebar (Type II).
 *
 * Subscribes to: SLIDE_CHANGED, UI_STATE_CHANGED, DECK_READY
 * Publishes: INTENT_SLIDE_GO
 *
 * Renders a vertical list of thumbnail labels (canvas thumbnails are a Phase 5+
 * optimization; v1 uses labeled placeholders that share styling with the grid
 * chrome). Visible only when railOpen=true.
 */

import { el } from '../layouts/_shared.js';

export function initRail(container, eventBus, service) {
    if (!container || !eventBus) return () => {};
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return () => {};

    const rail = el('aside', {
        className: 'slide-rail',
        attrs: { 'aria-label': 'Slide thumbnails' }
    });
    rail.dataset.open = 'false';
    container.appendChild(rail);

    const list = el('ol', { className: 'rail-list' });
    rail.appendChild(list);

    const renderItems = () => {
        while (list.firstChild) list.removeChild(list.firstChild);
        const slides = Array.isArray(service.slides) ? service.slides : [];
        slides.forEach((slide, i) => {
            const li = el('li', {
                className: 'rail-item',
                dataset: { index: String(i), active: i === service.index ? 'true' : 'false' }
            });
            const label = slide?.type ? slide.type : ('slide ' + (i + 1));
            li.appendChild(el('span', { className: 'rail-thumb', text: String(label) }));
            li.appendChild(el('span', { className: 'rail-num', text: String(i + 1) }));
            list.appendChild(li);
        });
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
        if (rail.parentNode) rail.parentNode.removeChild(rail);
    };
}
