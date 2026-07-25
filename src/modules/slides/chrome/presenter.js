/**
 * presenter.js — presenter overlay (Type II).
 *
 * Only mounted when ?presenter=1 is in the URL (set on the SlideDeckService).
 * Subscribes to PRESENTER_SYNC (cross-tab from main deck) and SLIDE_CHANGED.
 * Publishes INTENT_SLIDE_NOTE_UPDATE.
 *
 * Layout: current slide preview + next slide preview + notes textarea + timer.
 * Notes persist to localStorage (device-scoped, same as bolt-slides).
 */

import { el } from '../layouts/_shared.js';

const TIMER_KEY = 'csma-slides-timer-start';

export function initPresenter(container, eventBus, service) {
    if (!container || !eventBus) return () => {};
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const win = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
    if (!doc || !win) return () => {};

    const overlay = el('div', { className: 'presenter-overlay' });
    container.appendChild(overlay);

    // Current slide preview
    const current = el('section', { className: 'presenter-current' });
    current.appendChild(el('p', { className: 'kicker', text: 'Current' }));
    const currentLabel = el('p', { className: 'presenter-slide-label', text: labelFor(service) });
    current.appendChild(currentLabel);

    // Next slide preview
    const next = el('section', { className: 'presenter-next' });
    next.appendChild(el('p', { className: 'kicker', text: 'Next' }));
    const nextLabel = el('p', { className: 'presenter-slide-label', text: labelFor(service, service.index + 1) });
    next.appendChild(nextLabel);

    // Notes textarea
    const notesWrap = el('section', { className: 'presenter-notes' });
    notesWrap.appendChild(el('label', {
        className: 'presenter-notes-label',
        text: 'Notes',
        attrs: { for: 'csma-presenter-notes' }
    }));
    const textarea = el('textarea', {
        className: 'presenter-notes-input',
        attrs: { id: 'csma-presenter-notes', maxlength: '5000', placeholder: 'Add talking points for this slide…' }
    });
    textarea.value = service.getNote(service.index) || '';
    notesWrap.appendChild(textarea);

    // Timer
    const timerWrap = el('section', { className: 'presenter-timer' });
    const timerDisplay = el('p', { className: 'presenter-timer-display', text: '00:00' });
    timerWrap.appendChild(timerDisplay);

    overlay.appendChild(current);
    overlay.appendChild(next);
    overlay.appendChild(notesWrap);
    overlay.appendChild(timerWrap);

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
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
}

function labelFor(service, idx) {
    const i = Number.isFinite(idx) ? idx : service.index;
    if (i < 0 || i >= service.slides.length) return '(end)';
    const slide = service.slides[i];
    return slide?.title || slide?.type || ('slide ' + (i + 1));
}
