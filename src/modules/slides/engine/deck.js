/**
 * deck.js — DOM factory: slide stage, keyboard dispatch, hash sync.
 *
 * mountDeck(container, service, eventBus) wires up the entire deck:
 *   - Creates .deck > .slide-stage
 *   - Renders the current slide via the layout registry
 *   - Binds keyboard shortcuts → publishes intents (no direct service calls)
 *   - Syncs URL hash on SLIDE_CHANGED
 *   - Mounts chrome (dock, rail, grid) — presenter is opt-in via ?presenter=1
 *   - Mounts annotator overlay
 *   - Returns a cleanup function
 *
 * The keyboard map lives here (plan §6.1). Modifier keys and focus on form
 * fields are bypassed (so presenter notes still type normally).
 */

import { el } from '../layouts/_shared.js';
import { renderSlide } from '../layouts/index.js';
import { animateSlideTransition } from './transitions.js';
import { initAnnotator } from './annotator.js';
import { initDock } from '../chrome/dock.js';
import { initRail } from '../chrome/rail.js';
import { initGrid } from '../chrome/grid.js';
import { initPresenter } from '../chrome/presenter.js';
import { wireStatGridCountUps } from '../layouts/stat-grid.js';
import { wireBigNumberCountUp } from '../layouts/big-number.js';
import { syncBuildVisibility } from './build.js';

const KEY_MAP = {
    ArrowRight: 'INTENT_SLIDE_NEXT',
    ArrowDown:  'INTENT_SLIDE_NEXT',
    ' ':        'INTENT_SLIDE_NEXT',
    PageDown:   'INTENT_SLIDE_NEXT',
    ArrowLeft:  'INTENT_SLIDE_PREV',
    ArrowUp:    'INTENT_SLIDE_PREV',
    PageUp:     'INTENT_SLIDE_PREV',
    Home:       'INTENT_SLIDE_FIRST',
    End:        'INTENT_SLIDE_LAST',
    s: 'INTENT_SLIDE_TOGGLE_RAIL',
    S: 'INTENT_SLIDE_TOGGLE_RAIL',
    g: 'INTENT_SLIDE_TOGGLE_GRID',
    G: 'INTENT_SLIDE_TOGGLE_GRID',
    f: 'INTENT_SLIDE_TOGGLE_FS',
    F: 'INTENT_SLIDE_TOGGLE_FS',
    a: 'INTENT_SLIDE_TOGGLE_DRAWING',
    A: 'INTENT_SLIDE_TOGGLE_DRAWING',
    p: 'INTENT_SLIDE_OPEN_PRESENTER',
    P: 'INTENT_SLIDE_OPEN_PRESENTER',
    h: 'INTENT_SLIDE_HIDE_UI',
    H: 'INTENT_SLIDE_HIDE_UI',
    Escape: 'INTENT_SLIDE_ESCAPE'
};

/**
 * Mount the full deck on a container element.
 *
 * @param {HTMLElement} container
 * @param {object} service — SlideDeckService
 * @param {object} eventBus
 * @param {object} [opts] — `{ mountChrome=true, mountAnnotator=true }`
 * @returns {() => void} cleanup
 */
export function mountDeck(container, service, eventBus, opts = {}) {
    if (!container || !service || !eventBus) return () => {};
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const win = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
    if (!doc || !win) return () => {};

    const mountChrome = opts.mountChrome !== false;
    const mountAnnotator = opts.mountAnnotator !== false;

    const deck = el('div', { className: 'deck' });
    const stage = el('div', { className: 'slide-stage' });
    deck.appendChild(stage);
    container.appendChild(deck);

    const cleanups = [];
    let currentSlideEl = null;
    let countUpCleanup = () => {};
    let buildBindings = [];

    // ─── Render loop ──────────────────────────────────────────────

    const renderCurrentSlide = (animated = false, direction = 'next') => {
        const config = service.getCurrentSlide();
        const newEl = renderSlide(config);
        if (!newEl) return;

        const attach = () => {
            if (currentSlideEl && currentSlideEl.parentNode) {
                currentSlideEl.parentNode.removeChild(currentSlideEl);
            }
            currentSlideEl = newEl;
            stage.appendChild(newEl);
            postMount(newEl, service.index);
        };

        if (animated && currentSlideEl) {
            cleanups.push(undefined); // reserve slot to drop after
            animateSlideTransition(stage, direction, attach).then(() => {
                // nothing else to do — animateSlideTransition handles cleanup
            });
        } else {
            attach();
        }
    };

    // Post-mount: wire up count-ups, build registration, tab clicks.
    const postMount = (slideEl, slideIndex) => {
        // Wire count-ups for stat-grid + big-number
        countUpCleanup();
        if (slideEl.dataset.layout === 'stat-grid') {
            countUpCleanup = wireStatGridCountUps(slideEl);
        } else if (slideEl.dataset.layout === 'big-number') {
            countUpCleanup = wireBigNumberCountUp(slideEl);
        }

        // Wire up build elements on this slide
        for (const unbind of buildBindings) unbind && unbind();
        buildBindings = [];
        const builds = slideEl.querySelectorAll('[data-build-step]');
        let maxStep = 0;
        builds.forEach((build) => {
            const step = Number(build.dataset.buildStep) || 1;
            maxStep = Math.max(maxStep, step);
            service.registerMax(step, slideIndex);
            syncBuildVisibility(build, service.clicks);
            buildBindings.push(bindBuildLocal(build, service));
        });

        // Tabs click handler (per-slide; minimal)
        const tabs = slideEl.querySelectorAll('[role="tab"]');
        if (tabs.length > 0) {
            const onTabClick = (e) => {
                const btn = e.target.closest('[role="tab"]');
                if (!btn) return;
                const tabIdx = btn.dataset.tab;
                slideEl.querySelectorAll('[role="tab"]').forEach((t) => {
                    t.dataset.active = t.dataset.tab === tabIdx ? 'true' : 'false';
                    t.setAttribute('aria-selected', t.dataset.tab === tabIdx ? 'true' : 'false');
                });
                slideEl.querySelectorAll('[role="tabpanel"]').forEach((p) => {
                    p.dataset.hidden = p.dataset.tab === tabIdx ? 'false' : 'true';
                });
            };
            slideEl.addEventListener('click', onTabClick);
            buildBindings.push(() => slideEl.removeEventListener('click', onTabClick));
        }
    };

    // Local build binding (subscribe to BUILD_ADVANCED for this slide).
    const bindBuildLocal = (buildEl, svc) => {
        if (!eventBus.subscribe) return () => {};
        const step = Number(buildEl.dataset.buildStep) || 1;
        const slideIdx = svc.index;
        return eventBus.subscribe('BUILD_ADVANCED', (payload) => {
            if (payload?.slide !== slideIdx) return;
            buildEl.dataset.visible = (payload?.click || 0) >= step ? 'true' : 'false';
        });
    };

    // ─── Event subscriptions ──────────────────────────────────────

    if (eventBus.subscribe) {
        cleanups.push(eventBus.subscribe('SLIDE_CHANGED', (payload) => {
            const direction = payload?.slide > service.index ? 'next' : 'prev';
            // Note: service.index already updated by the time SLIDE_CHANGED fires,
            // so compare against the previous render.
            renderCurrentSlide(true, direction);
        }));
    }

    // ─── Keyboard ─────────────────────────────────────────────────

    const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const tag = doc.activeElement?.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT' || doc.activeElement?.isContentEditable) return;

        const intent = KEY_MAP[e.key];
        if (intent) {
            e.preventDefault();
            eventBus.publish(intent, { timestamp: Date.now() });
        }
    };
    win.addEventListener('keydown', onKey);
    cleanups.push(() => win.removeEventListener('keydown', onKey));

    // ─── Touch swipe (mobile) ─────────────────────────────────────
    // Mirrors ArrowLeft / ArrowRight. Horizontal swipe → slide nav.
    // Vertical scroll and small drags are ignored. Pointer events cover
    // mouse + touch + pen uniformly.
    const SWIPE_THRESHOLD_PX = 50;
    const SWIPE_MAX_VERTICAL_PX = 75;
    let pointerStartX = null;
    let pointerStartY = null;
    let pointerActive = false;

    const onPointerDown = (e) => {
        // Ignore touches that begin on an interactive control (dock, rail,
        // grid, presenter inputs, annotator SVG).
        if (e.target.closest?.('button, a, input, textarea, select, [contenteditable="true"], .noir-dock, .slide-rail, .slide-grid, .annotator-overlay')) return;
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
        pointerActive = true;
    };
    const onPointerUp = (e) => {
        if (!pointerActive) return;
        pointerActive = false;
        const dx = e.clientX - pointerStartX;
        const dy = e.clientY - pointerStartY;
        if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;          // too short
        if (Math.abs(dy) > SWIPE_MAX_VERTICAL_PX) return;        // mostly vertical scroll
        const intent = dx < 0 ? 'INTENT_SLIDE_NEXT' : 'INTENT_SLIDE_PREV';
        eventBus.publish(intent, { timestamp: Date.now(), source: 'swipe' });
    };
    const onPointerCancel = () => { pointerActive = false; };

    stage.addEventListener('pointerdown', onPointerDown);
    win.addEventListener('pointerup', onPointerUp);
    win.addEventListener('pointercancel', onPointerCancel);
    cleanups.push(() => {
        stage.removeEventListener('pointerdown', onPointerDown);
        win.removeEventListener('pointerup', onPointerUp);
        win.removeEventListener('pointercancel', onPointerCancel);
    });

    // ─── Initial render ──────────────────────────────────────────

    renderCurrentSlide(false);

    // ─── Chrome + annotator ──────────────────────────────────────

    if (mountChrome) {
        if (service.isPresenter) {
            cleanups.push(initPresenter(deck, eventBus, service));
        } else {
            // Chrome overlays (dock / rail / grid) are position:fixed and must
            // escape .deck's containing block (.deck has position:fixed +
            // overflow:hidden, which some browsers treat as the containing
            // block for fixed descendants, clipping overlays). Append to body.
            const chromeHost = doc.body || deck;
            cleanups.push(initDock(chromeHost, eventBus, service));
            cleanups.push(initRail(chromeHost, eventBus, service));
            cleanups.push(initGrid(chromeHost, eventBus, service));
        }
    }

    if (mountAnnotator && !service.isPresenter) {
        cleanups.push(initAnnotator(stage, eventBus, service));
    }

    // ─── Cleanup ─────────────────────────────────────────────────

    return () => {
        for (const unbind of buildBindings) unbind && unbind();
        buildBindings = [];
        countUpCleanup();
        cleanups.forEach((fn) => fn && fn());
        cleanups.length = 0;
        if (currentSlideEl && currentSlideEl.parentNode) {
            currentSlideEl.parentNode.removeChild(currentSlideEl);
        }
        currentSlideEl = null;
        if (deck.parentNode) deck.parentNode.removeChild(deck);
    };
}

/**
 * Read the slide index from the URL hash (e.g. "#3" → index 2).
 * Returns null if no hash or hash invalid.
 */
export function readIndexFromHash(winRef) {
    const win = winRef || (typeof window !== 'undefined' ? window : null);
    if (!win?.location?.hash) return null;
    const raw = win.location.hash.replace(/^#/, '');
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return null;
    return Math.floor(n) - 1; // #1 → index 0
}
