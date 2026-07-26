/**
 * CommentsBadge — Phase 4.1.
 *
 * Decorates a host button (dock button, toolbar chip, etc.) with a live count
 * badge driven by COMMENT_COUNT_CHANGED. The host owns the button; this helper
 * only appends a `.csma-comments-badge` child and keeps its number in sync.
 *
 * Scope handling: dock buttons are scoped to the "current" surface (e.g. the
 * current slide). Because that scope changes at runtime, callers pass a
 * `getScope()` function rather than a static string. The badge refreshes:
 *   - once on wiring
 *   - whenever COMMENT_COUNT_CHANGED fires for the current scope (or null/global)
 *   - whenever the caller invokes `refresh()` (e.g. from a SLIDE_CHANGED handler)
 *
 * Archetype: aiui-native. Badge element built via spec() + mountTree.
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';

/**
 * Wire a comment-count badge onto a host button.
 *
 * @param {HTMLElement} buttonEl            — the button to decorate
 * @param {object} opts
 * @param {() => (string|null)} opts.getScope — returns the current scope id
 * @param {object} opts.eventBus              — CSMA EventBus
 * @param {object} opts.service               — AnchorableCommentsService
 * @param {Document} [opts.documentRef]
 * @returns {{ refresh(): void, destroy(): void, badge: HTMLElement }}
 */
export function wireCommentsBadge(buttonEl, {
    getScope,
    eventBus,
    service,
    documentRef = null
}) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!buttonEl || !eventBus || !service || !doc) {
        return { refresh() {}, destroy() {}, badge: null };
    }

    let badge = buttonEl.querySelector(':scope > .csma-comments-badge');
    if (!badge) {
        const { root } = getComposer().mountTree(spec('span', {
            className: 'csma-comments-badge',
            attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' },
            dataset: { hasOpen: 'false' },
            text: '0'
        }), null, { documentRef: doc });
        badge = root;
        buttonEl.appendChild(badge);
    }

    function refresh() {
        const scope = typeof getScope === 'function' ? getScope() : null;
        const count = scope ? service.countOpen(scope) : service.countOpen();
        badge.textContent = String(count);
        badge.dataset.hasOpen = count > 0 ? 'true' : 'false';
    }

    function onCount(p) {
        const scope = typeof getScope === 'function' ? getScope() : null;
        // null/undefined payload scope = global count change; otherwise match.
        if (p?.scope === null || p?.scope === undefined || p?.scope === scope) {
            refresh();
        }
    }

    refresh();
    const unsub = eventBus.subscribe?.('COMMENT_COUNT_CHANGED', onCount);

    return {
        badge,
        refresh,
        destroy() { if (typeof unsub === 'function') { try { unsub(); } catch { /* best-effort */ } } }
    };
}
