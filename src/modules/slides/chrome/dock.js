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
 *
 * Phase 3.2 — aiui-native (factory-wrapping). All DOM construction routes
 * through `getComposer().mountTree(spec, container)`; no raw
 * `document.createElement` in chrome internals. The dock shell is spec-mounted;
 * click delegation and subscription-driven dataset mutations run on the
 * mounted DOM (see the Layer 2 archetype pattern in docs/architecture/SKILL.md).
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
// Import the badge factory directly (not the package index) so importing the
// dock does NOT pull the comments module's CSS side-effects — that would
// break raw-browser / non-Vite loading with a strict-MIME module error.
import { wireCommentsBadge } from '../../comments/ui/CommentsBadge.js';

export function initDock(container, eventBus, service, opts = {}) {
    if (!container || !eventBus) return () => {};
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return () => {};

    const commentsService = opts.commentsService || null;
    const useCommentsDrawer = Boolean(commentsService);
    const scopeOf = (idx) => 'deck:slide-' + (Number.isFinite(idx) ? idx : (service.index || 0));

    const publish = (name) => () => eventBus.publish(name, { timestamp: Date.now() });

    const toolDefs = [
        { label: 'Toggle sidebar', symbol: '☰', intent: 'INTENT_SLIDE_TOGGLE_RAIL' },
        { label: 'Toggle grid',    symbol: '▦', intent: 'INTENT_SLIDE_TOGGLE_GRID' },
        useCommentsDrawer
            ? { label: 'Comments on current slide', symbol: '💬', intent: 'INTENT_COMMENTS_OPEN_DRAWER' }
            : { label: 'Toggle comments on current slide (Phase 2.2)', symbol: '💬', intent: 'INTENT_SLIDE_TOGGLE_COMMENTS' },
        { label: 'Toggle drawing', symbol: '✎', intent: 'INTENT_SLIDE_TOGGLE_DRAWING' },
        { label: 'Fullscreen',     symbol: '⛶', intent: 'INTENT_SLIDE_TOGGLE_FS' },
        { label: 'Presenter',      symbol: '📺', intent: 'INTENT_SLIDE_OPEN_PRESENTER' },
        { label: 'Hide UI',        symbol: '◉', intent: 'INTENT_SLIDE_HIDE_UI' }
    ];

    // 1. Build spec tree (byte-identical to the legacy el() DOM it replaced).
    const dockSpec = spec('div', {
        className: 'noir-dock',
        attrs: { role: 'toolbar', 'aria-label': 'Slide controls' },
        children: [
            spec('button', {
                className: 'dock-btn',
                text: '←',
                attrs: { 'aria-label': 'Previous slide' },
                dataset: { intent: 'INTENT_SLIDE_PREV' }
            }),
            spec('span', {
                className: 'dock-counter',
                text: formatCounter(service.index, service.slides.length)
            }),
            spec('button', {
                className: 'dock-btn',
                text: '→',
                attrs: { 'aria-label': 'Next slide' },
                dataset: { intent: 'INTENT_SLIDE_NEXT' }
            }),
            spec('div', {
                className: 'dock-tools',
                children: toolDefs.map((t) => spec('button', {
                    className: 'dock-btn',
                    text: t.symbol,
                    attrs: { 'aria-label': t.label, 'title': t.label },
                    dataset: { intent: t.intent }
                }))
            })
        ]
    });

    // 2. Mount via composer (appends root to container; cleanup detaches it).
    const { root: dock, cleanup: unmountDock } = getComposer().mountTree(dockSpec, container, { documentRef: doc });
    const counter = dock.querySelector('.dock-counter');

    // 3. Wire events + subscriptions on the mounted DOM (same as before).
    const onClick = (e) => {
        const btn = e.target.closest('button[data-intent]');
        if (!btn) return;
        const intent = btn.dataset.intent;
        if (!intent) return;
        // The comments-drawer intent needs the current slide scope, unlike the
        // generic timestamp-only publishes.
        if (intent === 'INTENT_COMMENTS_OPEN_DRAWER') {
            eventBus.publish(intent, { scope: scopeOf(service.index), timestamp: Date.now() });
            return;
        }
        publish(intent)();
    };
    dock.addEventListener('click', onClick);

    const subs = [];
    let badgeWired = null;
    if (eventBus.subscribe) {
        subs.push(eventBus.subscribe('SLIDE_CHANGED', (payload) => {
            counter.textContent = formatCounter(payload?.slide, payload?.total);
            // Refresh the comments badge for the newly-current slide scope.
            badgeWired?.refresh();
        }));
        subs.push(eventBus.subscribe('UI_STATE_CHANGED', (payload) => {
            dock.dataset.uiHidden = payload?.uiHidden ? 'true' : 'false';
            dock.dataset.drawing  = payload?.drawing  ? 'true' : 'false';
            dock.dataset.railOpen = payload?.railOpen ? 'true' : 'false';
            dock.dataset.gridOpen = payload?.gridOpen ? 'true' : 'false';
        }));
    }

    // Phase 4.3 — decorate the comments button with a live open-count badge
    // when the drawer integration is active. wireCommentsBadge builds its own
    // badge element (aiui-native) and subscribes to COMMENT_COUNT_CHANGED.
    if (useCommentsDrawer) {
        const commentsBtn = dock.querySelector('button[data-intent="INTENT_COMMENTS_OPEN_DRAWER"]');
        if (commentsBtn) {
            // position:relative anchors the absolutely-positioned badge.
            commentsBtn.classList.add('dock-btn--badged');
            badgeWired = wireCommentsBadge(commentsBtn, {
                getScope: () => scopeOf(service.index),
                eventBus,
                service: commentsService,
                documentRef: doc
            });
        }
    }

    // 4. Return cleanup
    return () => {
        subs.forEach((fn) => fn && fn());
        badgeWired?.destroy();
        dock.removeEventListener('click', onClick);
        unmountDock();
    };
}

function formatCounter(slide, total) {
    const s = Number.isFinite(slide) ? slide + 1 : 1;
    const t = Number.isFinite(total) ? total : 0;
    return s + ' / ' + t;
}
