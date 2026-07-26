/**
 * presenter.js — presenter overlay (Type II).
 *
 * Only mounted when ?presenter=1 is in the URL (set on the SlideDeckService).
 * Subscribes to PRESENTER_SYNC (cross-tab from main deck) and SLIDE_CHANGED.
 * Publishes INTENT_SLIDE_NOTE_UPDATE.
 *
 * Layout: current slide preview + next slide preview + notes textarea + timer.
 * Notes persist to localStorage (device-scoped, same as bolt-slides).
 *
 * Phase 3.2 — aiui-native (factory-wrapping). The overlay shell is spec-mounted
 * via `getComposer().mountTree()`; label updates, the textarea value, and the
 * timer run on the mounted DOM. No raw `document.createElement` in chrome
 * internals.
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';

const TIMER_KEY = 'csma-slides-timer-start';

export function initPresenter(container, eventBus, service) {
    if (!container || !eventBus) return () => {};
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const win = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
    if (!doc || !win) return () => {};

    // 1. Build + mount the overlay shell (byte-identical to the legacy el() DOM).
    const overlaySpec = spec('div', {
        className: 'presenter-overlay',
        children: [
            spec('section', { className: 'presenter-current', children: [
                spec('p', { className: 'kicker', text: 'Current' }),
                spec('p', { className: 'presenter-slide-label', text: labelFor(service) })
            ]}),
            spec('section', { className: 'presenter-next', children: [
                spec('p', { className: 'kicker', text: 'Next' }),
                spec('p', { className: 'presenter-slide-label', text: labelFor(service, service.index + 1) })
            ]}),
            spec('section', { className: 'presenter-notes', children: [
                spec('label', {
                    className: 'presenter-notes-label',
                    text: 'Notes',
                    attrs: { for: 'csma-presenter-notes' }
                }),
                spec('textarea', {
                    className: 'presenter-notes-input',
                    attrs: { id: 'csma-presenter-notes', maxlength: '5000', placeholder: 'Add talking points for this slide…' }
                })
            ]}),
            spec('section', { className: 'presenter-timer', children: [
                spec('p', { className: 'presenter-timer-display', text: '00:00' })
            ]})
        ]
    });
    const { root: overlay, cleanup: unmountOverlay } = getComposer().mountTree(overlaySpec, container, { documentRef: doc });

    // Resolve the mutable nodes from the mounted DOM.
    const currentLabel  = overlay.querySelector('.presenter-current .presenter-slide-label');
    const nextLabel     = overlay.querySelector('.presenter-next .presenter-slide-label');
    const textarea      = overlay.querySelector('.presenter-notes-input');
    const timerDisplay  = overlay.querySelector('.presenter-timer-display');
    textarea.value = service.getNote(service.index) || '';

    // Timer — persist start across reloads (device-scoped)
    let timerStart = null;
    try {
        const stored = win.localStorage?.getItem(TIMER_KEY);
        timerStart = stored ? Number(stored) : null;
    } catch { /* noop */ }
    if (!Number.isFinite(timerStart)) {
        timerStart = Date.now();
        try { win.localStorage?.setItem(TIMER_KEY, String(timerStart)); } catch { /* noop */ }
    }
    const tickTimer = () => {
        const elapsed = Math.max(0, Math.floor((Date.now() - timerStart) / 1000));
        const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const ss = String(elapsed % 60).padStart(2, '0');
        timerDisplay.textContent = mm + ':' + ss;
    };
    const intervalId = win.setInterval(tickTimer, 1000);
    tickTimer();

    // Note editing
    let saveTimeout = null;
    const onNotesInput = () => {
        if (saveTimeout) win.clearTimeout(saveTimeout);
        const text = textarea.value;
        saveTimeout = win.setTimeout(() => {
            eventBus.publish('INTENT_SLIDE_NOTE_UPDATE', {
                slide: service.index,
                text,
                timestamp: Date.now()
            });
            saveTimeout = null;
        }, 400);
    };
    textarea.addEventListener('input', onNotesInput);

    const subs = [];
    const sync = (slide, clicks) => {
        currentLabel.textContent = labelFor(service, slide);
        nextLabel.textContent = labelFor(service, (slide ?? service.index) + 1);
        textarea.value = service.getNote(slide) || '';
    };

    if (eventBus.subscribe) {
        subs.push(eventBus.subscribe('PRESENTER_SYNC', (payload) => {
            sync(payload?.slide, payload?.clicks);
        }));
        subs.push(eventBus.subscribe('SLIDE_CHANGED', (payload) => {
            sync(payload?.slide, payload?.clicks);
        }));
    }

    return () => {
        if (saveTimeout) win.clearTimeout(saveTimeout);
        win.clearInterval(intervalId);
        textarea.removeEventListener('input', onNotesInput);
        subs.forEach((fn) => fn && fn());
        unmountOverlay();
    };
}

function labelFor(service, idx) {
    const i = Number.isFinite(idx) ? idx : service.index;
    if (i < 0 || i >= service.slides.length) return '(end)';
    const slide = service.slides[i];
    return slide?.title || slide?.type || ('slide ' + (i + 1));
}
