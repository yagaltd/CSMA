/**
 * dock.js — floating toolbar (Type II).
 *
 * Subscribes to: SLIDE_CHANGED, UI_STATE_CHANGED
 * Publishes: INTENT_SLIDE_NEXT, INTENT_SLIDE_PREV, INTENT_SLIDE_TOGGLE_RAIL,
 *            INTENT_SLIDE_TOGGLE_GRID, INTENT_SLIDE_TOGGLE_FS,
 *            INTENT_SLIDE_TOGGLE_DRAWING, INTENT_SLIDE_HIDE_UI,
 *            INTENT_SLIDE_OPEN_PRESENTER
 *
 * Hides when uiHidden=true. Two rows on desktop (nav + tools), stacked on mobile.
 */

import { el } from '../layouts/_shared.js';

export function initDock(container, eventBus, service) {
    if (!container || !eventBus) return () => {};
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return () => {};

    const dock = el('div', { className: 'noir-dock', attrs: { role: 'toolbar', 'aria-label': 'Slide controls' } });

    const counter = el('span', { className: 'dock-counter', text: formatCounter(service.index, service.slides.length) });

    const publish = (name) => () => eventBus.publish(name, { timestamp: Date.now() });

    dock.appendChild(el('button', {
        className: 'dock-btn',
        text: '←',
        attrs: { 'aria-label': 'Previous slide' },
        dataset: { intent: 'INTENT_SLIDE_PREV' }
    }));
    dock.appendChild(counter);
    dock.appendChild(el('button', {
        className: 'dock-btn',
        text: '→',
        attrs: { 'aria-label': 'Next slide' },
        dataset: { intent: 'INTENT_SLIDE_NEXT' }
    }));

    const tools = el('div', { className: 'dock-tools' });
    const toolDefs = [
        { label: 'Toggle sidebar', symbol: '☰', intent: 'INTENT_SLIDE_TOGGLE_RAIL' },
        { label: 'Toggle grid',    symbol: '▦', intent: 'INTENT_SLIDE_TOGGLE_GRID' },
        { label: 'Toggle drawing', symbol: '✎', intent: 'INTENT_SLIDE_TOGGLE_DRAWING' },
        { label: 'Fullscreen',     symbol: '⛶', intent: 'INTENT_SLIDE_TOGGLE_FS' },
        { label: 'Presenter',      symbol: '', intent: 'INTENT_SLIDE_OPEN_PRESENTER' },
        { label: 'Hide UI',        symbol: '◉', intent: 'INTENT_SLIDE_HIDE_UI' }
    ];
    for (const t of toolDefs) {
        tools.appendChild(el('button', {
            className: 'dock-btn',
            text: t.symbol,
            attrs: { 'aria-label': t.label, 'title': t.label },
            dataset: { intent: t.intent }
        }));
    }
    dock.appendChild(tools);
    container.appendChild(dock);

    // Click delegation — read intent from data-attr, publish
    const onClick = (e) => {
        const btn = e.target.closest('button[data-intent]');
        if (!btn) return;
        const intent = btn.dataset.intent;
        if (intent) publish(intent)();
    };
    dock.addEventListener('click', onClick);

    const subs = [];
    if (eventBus.subscribe) {
        subs.push(eventBus.subscribe('SLIDE_CHANGED', (payload) => {
            counter.textContent = formatCounter(payload?.slide, payload?.total);
        }));
        subs.push(eventBus.subscribe('UI_STATE_CHANGED', (payload) => {
            dock.dataset.uiHidden = payload?.uiHidden ? 'true' : 'false';
            dock.dataset.drawing  = payload?.drawing  ? 'true' : 'false';
            dock.dataset.railOpen = payload?.railOpen ? 'true' : 'false';
            dock.dataset.gridOpen = payload?.gridOpen ? 'true' : 'false';
        }));
    }

    return () => {
        subs.forEach((fn) => fn && fn());
        dock.removeEventListener('click', onClick);
        if (dock.parentNode) dock.parentNode.removeChild(dock);
    };
}

function formatCounter(slide, total) {
    const s = Number.isFinite(slide) ? slide + 1 : 1;
    const t = Number.isFinite(total) ? total : 0;
    return s + ' / ' + t;
}
