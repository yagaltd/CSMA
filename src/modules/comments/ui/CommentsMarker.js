/**
 * CommentsMarker — Phase 4.2.
 *
 * Renders pin markers on DOM elements that have OPEN comments in a scope.
 * For each open comment whose element anchor resolves to a live DOM node
 * (via AnchorResolver), a fixed-position pin is placed at the element's
 * top-right corner showing the open count for that element, colored by the
 * worst open status (reopened → red, open → amber).
 *
 * Clicking a pin publishes INTENT_COMMENTS_FOCUS {id} with the first open
 * comment id on that element. That same intent is what CommentsPopup (Phase
 * 4.2) listens for to open an anchored popover, and what CommentsDrawer
 * (Phase 4.1) listens for to highlight the comment. So a single pin click
 * drives both the popup and the drawer highlight — no new contracts needed.
 *
 * Lifecycle (events this controller reacts to):
 *   COMMENT_ADDED|RESOLVED|REOPENED|UPDATED|REMOVED → refresh()
 *
 * Repositioning: pins are position:fixed and track viewport coordinates, so
 * they reposition on window scroll/resize (passive listeners, cleaned up on
 * destroy).
 *
 * Archetype: aiui-native (Layer 2). All DOM via spec() + mountTree(). No
 * innerHTML; textContent for all data. State via data-* + CSS classes.
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';

const MUTATION_EVENTS = [
    'COMMENT_ADDED',
    'COMMENT_RESOLVED',
    'COMMENT_REOPENED',
    'COMMENT_UPDATED',
    'COMMENT_REMOVED'
];

/**
 * Create an anchor-marker controller.
 *
 * @param {object} opts
 * @param {object} opts.eventBus    — CSMA EventBus
 * @param {object} opts.service     — AnchorableCommentsService instance
 * @param {object} opts.resolver    — AnchorResolver instance
 * @param {HTMLElement} opts.container — host container (unused for pin mount,
 *        pins attach to document.body; kept for symmetry/future anchoring)
 * @param {string} opts.scope       — scope id to filter comments by
 * @param {Document} [opts.documentRef]
 * @returns {{ refresh(): void, destroy(): void }}
 */
export function createCommentsMarker({
    eventBus,
    service,
    resolver,
    container,
    scope,
    documentRef = null
}) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!eventBus || !service || !resolver || !scope || !doc) {
        return { refresh() {}, destroy() {} };
    }

    // element → { pin, commentIds:[], status } for currently-rendered pins
    const pins = new Map();
    const subs = [];

    const sub = (name, fn) => {
        const u = eventBus.subscribe?.(name, fn);
        if (typeof u === 'function') subs.push(u);
    };

    MUTATION_EVENTS.forEach((ev) => sub(ev, () => refresh()));

    function refresh() {
        const comments = (service.getByScope(scope) || [])
            .filter((c) => c.status === 'open' || c.status === 'reopened')
            .filter((c) => c.anchor_type === 'element');

        // Group open comments by their resolved DOM element.
        const byElement = new Map(); // element → { commentIds, reopened }
        for (const c of comments) {
            const el = resolver.resolve({ anchor_type: c.anchor_type, anchor: c.anchor }, { documentRef: doc });
            if (!el || typeof el.getBoundingClientRect !== 'function') continue;
            if (!byElement.has(el)) byElement.set(el, { commentIds: [], reopened: false });
            const entry = byElement.get(el);
            entry.commentIds.push(c.id);
            if (c.status === 'reopened') entry.reopened = true;
        }

        // Remove pins whose element no longer has open comments.
        for (const [el, info] of [...pins.entries()]) {
            if (!byElement.has(el)) {
                info.pin.remove();
                pins.delete(el);
            }
        }

        // Add or update pins.
        for (const [el, entry] of byElement) {
            const status = entry.reopened ? 'reopened' : 'open';
            let info = pins.get(el);
            if (!info) {
                const { root: pin } = getComposer().mountTree(spec('button', {
                    className: 'csma-comments-marker-pin',
                    attrs: {
                        type: 'button',
                        'aria-label': `${entry.commentIds.length} open comments on this element`
                    },
                    dataset: { status },
                    text: String(entry.commentIds.length)
                }), null, { documentRef: doc });
                doc.body.appendChild(pin);
                pin.addEventListener('click', () => onPinClick(entry.commentIds));
                info = { pin, commentIds: entry.commentIds, status };
                pins.set(el, info);
            } else {
                info.commentIds = entry.commentIds;
                info.status = status;
                info.pin.dataset.status = status;
                info.pin.textContent = String(entry.commentIds.length);
                info.pin.setAttribute('aria-label', `${entry.commentIds.length} open comments on this element`);
            }
        }

        reposition();
    }

    function onPinClick(commentIds) {
        if (!commentIds.length) return;
        // Focus the first open comment on this element → drives popup + drawer.
        if (typeof eventBus.publishSync === 'function') {
            eventBus.publishSync('INTENT_COMMENTS_FOCUS', { id: commentIds[0], timestamp: Date.now() });
        } else {
            eventBus.publish('INTENT_COMMENTS_FOCUS', { id: commentIds[0], timestamp: Date.now() });
        }
    }

    function reposition() {
        for (const [el, info] of pins) {
            if (!doc.body.contains(el)) {
                // element left the DOM during the frame; drop stale pin
                info.pin.remove();
                pins.delete(el);
                continue;
            }
            const rect = el.getBoundingClientRect();
            // Pin sits at the element's top-right corner.
            const top = Math.max(0, rect.top + 4);
            const left = Math.max(0, rect.right - 24);
            info.pin.style.top = top + 'px';
            info.pin.style.left = left + 'px';
        }
    }

    // Reposition on viewport changes (pins are fixed-position).
    const onScroll = () => reposition();
    const onResize = () => reposition();
    if (typeof window !== 'undefined') {
        window.addEventListener('scroll', onScroll, { passive: true, capture: true });
        window.addEventListener('resize', onResize, { passive: true });
    }

    function destroy() {
        subs.forEach((u) => { try { u(); } catch { /* best-effort */ } });
        subs.length = 0;
        if (typeof window !== 'undefined') {
            window.removeEventListener('scroll', onScroll, { capture: true });
            window.removeEventListener('resize', onResize);
        }
        for (const [, info] of pins) info.pin.remove();
        pins.clear();
    }

    // Initial render for comments that already exist at construction time.
    refresh();

    return { refresh, destroy };
}
