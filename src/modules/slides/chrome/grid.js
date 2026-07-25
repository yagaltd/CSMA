/**
 * grid.js — grid overview (Type II).
 *
 * Subscribes to: SLIDE_CHANGED, UI_STATE_CHANGED, DECK_READY
 * Publishes: INTENT_SLIDE_GO
 *
 * Full-screen grid of slide labels. Visible only when gridOpen=true. Press
 * Escape or click outside to close.
 */

import { el } from '../layouts/_shared.js';

export function initGrid(container, eventBus, service) {
    if (!container || !eventBus) return () => {};
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return () => {};

    const grid = el('div', {
        className: 'slide-grid',
        attrs: { 'aria-label': 'Slide overview' }
    });
    grid.dataset.open = 'false';
    container.appendChild(grid);

    const inner = el('div', { className: 'grid-inner' });
    grid.appendChild(inner);

    const renderItems = () => {
        while (inner.firstChild) inner.removeChild(inner.firstChild);
        const slides = Array.isArray(service.slides) ? service.slides : [];
        slides.forEach((slide, i) => {
            const card = el('button', {
                className: 'grid-card',
                dataset: { index: String(i), active: i === service.index ? 'true' : 'false' }
            });
            const label = slide?.type ? slide.type : ('slide ' + (i + 1));
            card.appendChild(el('span', { className: 'grid-thumb', text: String(label) }));
            card.appendChild(el('span', { className: 'grid-num', text: String(i + 1) }));
            inner.appendChild(card);
        });
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
        if (grid.parentNode) grid.parentNode.removeChild(grid);
    };
}
