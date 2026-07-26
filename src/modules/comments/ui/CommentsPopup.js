/**
 * CommentsPopup — Phase 4.2.
 *
 * Anchored popover that lists the comments on a specific DOM element and
 * offers an inline add form pre-filled with that element's anchor.
 *
 * Trigger: listens for INTENT_COMMENTS_FOCUS {id} (the same intent the marker
 * publishes on pin click and the drawer highlights on). It resolves the
 * focused comment's anchor to a live element via AnchorResolver, then opens an
 * OverlayManager popover anchored at that element. The popover lists every
 * comment sharing that anchor (service.getByAnchor) plus a composer; the
 * composer's Add publishes INTENT_COMMENT_ADD with the ELEMENT anchor (not the
 * scope anchor the drawer uses), so new comments thread onto the same element.
 *
 * Published intents (user gestures → service):
 *   INTENT_COMMENT_ADD (element anchor) / RESOLVE / REOPEN / DELETE
 *
 * Limitation: text/point anchors resolve to null in Phase 4 (no live element),
 * so the popup cannot position for them and stays closed. That is expected —
 * real text/point resolution arrives when hosts register resolvers (Phase 5+).
 *
 * Archetype: aiui-native. No innerHTML; textContent for all user data.
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
 * Create a comments popup controller.
 *
 * @param {object} opts
 * @param {object} opts.eventBus       — CSMA EventBus
 * @param {object} opts.service        — AnchorableCommentsService instance
 * @param {object} opts.overlayManager — createOverlayManager(...) result
 * @param {object} opts.resolver       — AnchorResolver instance
 * @param {Document} [opts.documentRef]
 * @returns {{ destroy(): void }}
 */
export function createCommentsPopup({
    eventBus,
    service,
    overlayManager,
    resolver,
    documentRef = null
}) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!eventBus || !service || !overlayManager || !resolver || !doc) {
        return { destroy() {} };
    }

    let popoverHandle = null;   // { close, el } from openPopover
    let contentEl = null;       // our popup root inside the popover shell
    let currentAnchor = null;   // the element anchor being shown
    let currentScope = null;    // scope for new comments added from the popup
    const subs = [];

    const sub = (name, fn) => {
        const u = eventBus.subscribe?.(name, fn);
        if (typeof u === 'function') subs.push(u);
    };

    sub('INTENT_COMMENTS_FOCUS', (p) => onFocus(p?.id));

    // Keep the open popover in sync with mutations (resolve/delete from within).
    MUTATION_EVENTS.forEach((ev) => sub(ev, () => {
        if (popoverHandle) render();
    }));

    function onFocus(id) {
        if (!id) return;
        const comment = service.focus(id);
        if (!comment) return;
        const envelope = { anchor_type: comment.anchor_type, anchor: comment.anchor };
        const el = resolver.resolve(envelope, { documentRef: doc });
        if (!el || typeof el.getBoundingClientRect !== 'function') return;
        openAt(el, envelope, comment.scope ?? null);
    }

    function openAt(anchorEl, anchor, scope) {
        // Close any prior popover (openPopover also closes existing, but we
        // reset our refs explicitly). currentAnchor/scope are set AFTER close
        // so close()'s nulling doesn't wipe the values render() needs.
        close();
        currentAnchor = anchor;
        currentScope = scope;
        contentEl = buildShell();
        popoverHandle = overlayManager.openPopover(contentEl, anchorEl, {
            onClose: () => {
                popoverHandle = null;
                contentEl = null;
                currentAnchor = null;
            }
        });
        wireEvents();
        render();
    }

    function close() {
        if (popoverHandle) popoverHandle.close();
        popoverHandle = null;
        contentEl = null;
        currentAnchor = null;
    }

    function buildShell() {
        const { root } = getComposer().mountTree(spec('div', {
            className: 'csma-comments-popup',
            attrs: { role: 'region', 'aria-label': 'Comments on this element' },
            children: [
                spec('div', { className: 'csma-comments-popup-list', attrs: { role: 'list' } }),
                spec('div', {
                    className: 'csma-comments-popup-add',
                    attrs: { role: 'group', 'aria-label': 'Add a comment to this element' },
                    children: [
                        spec('textarea', {
                            className: 'csma-comments-popup-input',
                            attrs: {
                                placeholder: 'Comment on this element…',
                                'aria-label': 'New comment body',
                                rows: '2',
                                maxlength: '20000'
                            }
                        }),
                        spec('button', {
                            className: 'csma-comments-popup-add-btn',
                            text: 'Add',
                            dataset: { action: 'add' },
                            attrs: { type: 'button' }
                        })
                    ]
                })
            ]
        }), null, { documentRef: doc });
        return root;
    }

    function wireEvents() {
        if (!contentEl) return;
        contentEl.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            if (action === 'add') {
                submitAdd();
                return;
            }
            const card = btn.closest('[data-id]');
            if (!card) return;
            const id = card.dataset.id;
            switch (action) {
                case 'resolve':
                    publish('INTENT_COMMENT_RESOLVE', { id, timestamp: Date.now() }); break;
                case 'reopen':
                    publish('INTENT_COMMENT_REOPEN', { id, timestamp: Date.now() }); break;
                case 'delete':
                    publish('INTENT_COMMENT_DELETE', { id, timestamp: Date.now() }); break;
                default: break;
            }
        });
    }

    function submitAdd() {
        const input = contentEl?.querySelector('.csma-comments-popup-input');
        const body = input?.value?.trim();
        if (!body || !currentAnchor) return;
        publish('INTENT_COMMENT_ADD', {
            scope: currentScope,
            anchor: currentAnchor,
            body,
            timestamp: Date.now()
        });
        if (input) input.value = '';
    }

    function publish(name, payload) {
        if (typeof eventBus.publishSync === 'function') eventBus.publishSync(name, payload);
        else eventBus.publish(name, payload);
    }

    function render() {
        if (!contentEl) return;
        const listEl = contentEl.querySelector('.csma-comments-popup-list');
        if (!listEl) return;
        listEl.replaceChildren();
        const comments = (service.getByAnchor(currentAnchor) || [])
            .filter((c) => c.status !== 'deleted');
        if (comments.length === 0) {
            const { root } = getComposer().mountTree(spec('div', {
                className: 'csma-comments-empty',
                attrs: { role: 'status' },
                text: 'No comments.'
            }), null, { documentRef: doc });
            listEl.appendChild(root);
            return;
        }
        const frag = doc.createDocumentFragment();
        for (const c of comments) frag.appendChild(buildComment(c).root);
        listEl.appendChild(frag);
    }

    function buildComment(c) {
        const open = c.status === 'open' || c.status === 'reopened';
        const actions = [];
        if (open) {
            actions.push(spec('button', { className: 'csma-comment-btn', text: 'Resolve', dataset: { action: 'resolve' }, attrs: { type: 'button' } }));
        } else if (c.status === 'resolved') {
            actions.push(spec('button', { className: 'csma-comment-btn', text: 'Reopen', dataset: { action: 'reopen' }, attrs: { type: 'button' } }));
        }
        actions.push(spec('button', { className: 'csma-comment-btn danger', text: 'Delete', dataset: { action: 'delete' }, attrs: { type: 'button' } }));

        return getComposer().mountTree(spec('article', {
            className: 'csma-comment csma-comment--popup',
            dataset: { id: c.id, status: c.status },
            attrs: { role: 'listitem' },
            children: [
                spec('div', {
                    className: 'csma-comment-meta',
                    children: [
                        spec('span', { className: 'csma-comment-author', text: authorName(c.author) }),
                        spec('span', { className: 'csma-comment-time', text: formatTime(c.created_at) }),
                        spec('span', {
                            className: 'csma-comment-status',
                            text: statusLabel(c.status),
                            dataset: { status: c.status }
                        })
                    ]
                }),
                spec('div', { className: 'csma-comment-body', text: c.body }),
                spec('div', { className: 'csma-comment-actions', children: actions })
            ]
        }), null, { documentRef: doc });
    }

    function destroy() {
        subs.forEach((u) => { try { u(); } catch { /* best-effort */ } });
        subs.length = 0;
        close();
    }

    return { destroy };
}

// ── shared formatters (duplicated from CommentsDrawer to keep this module
//    dependency-free; small enough that extraction isn't warranted for v1) ──

function authorName(author) {
    if (!author) return 'Anonymous';
    if (typeof author === 'string') return author;
    return author.name || author.displayName || author.id || 'Anonymous';
}

function statusLabel(status) {
    switch (status) {
        case 'open': return 'Open';
        case 'reopened': return 'Reopened';
        case 'resolved': return 'Resolved';
        case 'deleted': return 'Deleted';
        default: return status || '';
    }
}

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    try { return d.toLocaleString(); } catch { return ''; }
}
