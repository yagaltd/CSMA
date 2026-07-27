/**
 * CommentsDrawer — Phase 4.1.
 *
 * Generic, anchor-agnostic comment list drawer. Mounts its content into an
 * OverlayManager drawer shell (the archetype owns the slide-in panel, header,
 * backdrop, ESC dismissal, and focus trap). This module owns the drawer
 * CONTENT: a filter toolbar, the comment list with flat threaded replies,
 * inline edit/reply forms, and an add-comment composer.
 *
 * All mutations route through EventBus intents (the drawer never calls the
 * service directly) so the contract + rate-limit layer stays in control.
 *
 * Lifecycle (events this controller reacts to):
 *   COMMENTS_DRAWER_OPENED {scope}   → open(scope)
 *   COMMENTS_DRAWER_CLOSED           → close()
 *   COMMENT_ADDED|RESOLVED|REOPENED|
 *       UPDATED|REMOVED              → reRender (only while open)
 *   INTENT_COMMENTS_FOCUS {id}       → highlight + scroll the target comment
 *
 * Published intents (user gestures → service):
 *   INTENT_COMMENT_ADD / REPLY / RESOLVE / REOPEN / EDIT / DELETE
 *
 * Archetype: aiui-native (Layer 2). All DOM built via spec() +
 * getComposer().mountTree(). No innerHTML anywhere; textContent for all user
 * data. Visual state carried by data-* attributes and CSS classes.
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';

const FILTERS = [
    { value: 'open', label: 'Open' },
    { value: 'activity', label: 'Activity' },
    { value: 'all', label: 'All' }
];

const FOCUS_HIGHLIGHT_MS = 1200;

/**
 * Create a comments drawer controller bound to an OverlayManager.
 *
 * @param {object} opts
 * @param {object} opts.eventBus       — CSMA EventBus
 * @param {object} opts.service        — AnchorableCommentsService instance
 * @param {object} opts.overlayManager — createOverlayManager(...) result
 * @param {Document} [opts.documentRef]
 * @returns {{ open(scope?:string): void, close(): void, focus(id:string): void, isOpen(): boolean, destroy(): void }}
 */
export function createCommentsDrawer({
    eventBus,
    service,
    overlayManager,
    documentRef = null,
    // Optional host hooks keep this drawer generic (no slides coupling):
    //  scopeLabel(scope) -> string|null  renders a per-card scope chip
    //  onScopeNavigate(scope)            called when the scope chip is clicked
    //  enableElementPicker               show a "Comment on element" button that
    //                                    publishes INTENT_COMMENTS_START_PICK
    scopeLabel = null,
    onScopeNavigate = null,
    enableElementPicker = false,
    // scopeRail — optional host-provided thumbnail rail (slide picker).
    // { render: (railContainer: HTMLElement) => (() => void) }
    //   The host renders its scope cards (each carrying data-scope + data-active)
    //   into the container and returns a cleanup. The drawer toggles data-active
    //   on scope change and publishes INTENT_COMMENTS_OPEN_DRAWER on card click.
    scopeRail = null
}) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!eventBus || !service || !overlayManager || !doc) {
        return { open() {}, close() {}, focus() {}, isOpen() { return false; }, destroy() {} };
    }

    let currentScope = null;
    let filter = 'open';
    let overlayHandle = null;     // { close, el } from overlayManager.openDrawer
    let rootEl = null;            // our content root, lives inside the overlay body
    let listEl = null;            // .csma-comments-list
    let addInput = null;          // add-comment textarea
    let focusId = null;           // INTENT_COMMENTS_FOCUS target id
    let focusTimer = null;
    const editing = new Set();    // comment ids in inline-edit mode
    const replying = new Set();   // comment ids with an open reply form
    const subs = [];
    // ── scopeRail state ────────────────────────────────────────────
    let railContainer = null;
    let railRenderCleanup = null;  // cleanup returned by scopeRail.render()

    const sub = (name, fn) => {
        const u = eventBus.subscribe?.(name, fn);
        if (typeof u === 'function') subs.push(u);
    };

    // ── subscriptions ──────────────────────────────────────────────────
    sub('COMMENTS_DRAWER_OPENED', (p) => open(p?.scope ?? null));
    sub('COMMENTS_DRAWER_CLOSED', () => close());
    const reRenderIfOpen = () => { if (overlayHandle) reRender(); };
    sub('COMMENT_ADDED', reRenderIfOpen);
    sub('COMMENT_RESOLVED', reRenderIfOpen);
    sub('COMMENT_REOPENED', reRenderIfOpen);
    sub('COMMENT_UPDATED', reRenderIfOpen);
    sub('COMMENT_REMOVED', reRenderIfOpen);
    sub('INTENT_COMMENTS_FOCUS', (p) => focus(p?.id));

    // ── open / close ───────────────────────────────────────────────────

    function open(scope) {
        currentScope = scope ?? null;
        if (overlayHandle) {
            reRender();
            updateActiveRail();
            return;
        }
        rootEl = buildRoot();
        overlayHandle = overlayManager.openDrawer(rootEl, {
            title: 'Comments',
            onClose: () => {
                overlayHandle = null;
                rootEl = null;
                listEl = null;
                addInput = null;
                railContainer = null;
                editing.clear();
                replying.clear();
                if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
                if (railRenderCleanup) { try { railRenderCleanup(); } catch { /* best-effort */ } railRenderCleanup = null; }
            }
        });
        listEl = rootEl.querySelector('.csma-comments-list');
        addInput = rootEl.querySelector('.csma-comments-input');
        wireEvents();
        updateFilterAria();
        reRender();
        renderRail();
    }

    function close() {
        if (overlayHandle) overlayHandle.close();
    }

    function isOpen() { return overlayHandle !== null; }

    function focus(id) {
        if (!id) return;
        focusId = String(id);
        if (!overlayHandle) return;
        reRender();
        const el = listEl?.querySelector(`[data-id="${cssAttr(focusId)}"]`);
        if (el && typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'center' });
        }
        if (focusTimer) clearTimeout(focusTimer);
        focusTimer = setTimeout(() => { focusId = null; }, FOCUS_HIGHLIGHT_MS);
    }

    function destroy() {
        subs.forEach((u) => { try { u(); } catch { /* best-effort */ } });
        subs.length = 0;
        if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
        if (railRenderCleanup) { try { railRenderCleanup(); } catch { /* best-effort */ } railRenderCleanup = null; }
        close();
    }

    // ── DOM shell (mounted once per open) ──────────────────────────────

    function buildRoot() {
        const children = [];
        // scopeRail container is built once per open and reused across
        // re-renders. The host's render() is called into it on each open.
        if (scopeRail) {
            children.push(spec('div', { className: 'csma-comments-scoperail' }));
        }
        children.push(
            spec('div', {
                className: 'csma-comments-toolbar',
                    children: [
                        spec('div', {
                            className: 'csma-comments-filters',
                            attrs: { role: 'tablist', 'aria-label': 'Filter comments' },
                            children: FILTERS.map((f) => spec('button', {
                                className: 'csma-comments-filter',
                                text: f.label,
                                dataset: { filter: f.value },
                                attrs: { role: 'tab', type: 'button', 'aria-selected': 'false' }
                            }))
                        }),
                        spec('span', { className: 'csma-comments-count', text: '0' })
                    ]
                }),
                spec('div', {
                    className: 'csma-comments-list',
                    attrs: { role: 'list' }
                }),
                spec('div', {
                    className: 'csma-comments-add',
                    attrs: { role: 'group', 'aria-label': 'Add a comment' },
                    children: [
                        spec('textarea', {
                            className: 'csma-comments-input',
                            attrs: {
                                placeholder: 'Add a comment…',
                                'aria-label': 'New comment body',
                                rows: '2',
                                maxlength: '20000'
                            }
                        }),
                        spec('div', {
                            className: 'csma-comments-add-actions',
                            children: [
                                spec('button', {
                                    className: 'csma-comments-add-btn',
                                    text: 'Add',
                                    dataset: { action: 'add' },
                                    attrs: { type: 'button' }
                                }),
                                enableElementPicker
                                    ? spec('button', {
                                        className: 'csma-comment-btn',
                                        text: '📍 Element',
                                        dataset: { action: 'pick-element' },
                                        attrs: { type: 'button', title: 'Comment on a specific element' }
                                    })
                                    : null
                            ]
                        })
                    ]
                })
        );
        const tree = spec('div', {
            className: 'csma-comments-drawer',
            attrs: { role: 'region', 'aria-label': 'Comments for this scope' },
            children
        });
        const { root } = getComposer().mountTree(tree, null, { documentRef: doc });
        return root;
    }

    function wireEvents() {
        if (!rootEl) return;
        // scopeRail click — publish open-drawer intent to switch scope.
        // Cards carry data-scope on their root (set by the host's render).
        railContainer = rootEl.querySelector('.csma-comments-scoperail');
        if (railContainer) {
            railContainer.addEventListener('click', (e) => {
                const card = e.target.closest('[data-scope]');
                if (!card) return;
                publish('INTENT_COMMENTS_OPEN_DRAWER', { scope: card.dataset.scope, timestamp: Date.now() });
            });
        }
        rootEl.querySelector('.csma-comments-filters')?.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-filter]');
            if (!btn) return;
            filter = btn.dataset.filter;
            updateFilterAria();
            reRender();
        });
        const addContainer = rootEl.querySelector('.csma-comments-add');
        addContainer?.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            if (action === 'add') {
                submitAdd();
            } else if (action === 'pick-element') {
                // Hand off to the host's element picker, then close so the
                // user can see and click the slide content.
                publish('INTENT_COMMENTS_START_PICK', { scope: currentScope, timestamp: Date.now() });
                close();
            }
        });
        // Ctrl/Cmd+Enter in the composer submits too.
        addInput = rootEl.querySelector('.csma-comments-input');
        addInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submitAdd();
            }
        });
        listEl?.addEventListener('click', onListClick);
    }

    function updateFilterAria() {
        rootEl?.querySelectorAll('.csma-comments-filter').forEach((b) => {
            b.setAttribute('aria-selected', b.dataset.filter === filter ? 'true' : 'false');
        });
    }

    function onListClick(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const card = btn.closest('[data-id]');
        if (!card) return;
        const id = card.dataset.id;
        const action = btn.dataset.action;
        const scope = currentScope;

        switch (action) {
            case 'goto-scope':
                if (typeof onScopeNavigate === 'function' && btn.dataset.scope) onScopeNavigate(btn.dataset.scope);
                break;
            case 'locate':
                publish('INTENT_COMMENTS_FOCUS', { id, timestamp: Date.now() });
                break;
            case 'resolve':
                publish('INTENT_COMMENT_RESOLVE', { id, timestamp: Date.now() });
                break;
            case 'reopen':
                publish('INTENT_COMMENT_REOPEN', { id, timestamp: Date.now() });
                break;
            case 'delete':
                publish('INTENT_COMMENT_DELETE', { id, timestamp: Date.now() });
                break;
            case 'edit':
                editing.add(id); reRender(); break;
            case 'edit-cancel':
                editing.delete(id); reRender(); break;
            case 'edit-save': {
                const ta = card.querySelector('.csma-comment-edit-input');
                const body = ta?.value?.trim();
                if (body) publish('INTENT_COMMENT_EDIT', { id, body, timestamp: Date.now() });
                editing.delete(id); reRender(); break;
            }
            case 'reply':
                replying.add(id); reRender(); break;
            case 'reply-cancel':
                replying.delete(id); reRender(); break;
            case 'reply-save': {
                const ta = card.querySelector('.csma-comment-reply-input');
                const body = ta?.value?.trim();
                if (body) publish('INTENT_COMMENT_REPLY', { parentId: id, body, scope, timestamp: Date.now() });
                replying.delete(id); reRender(); break;
            }
            default: break;
        }
    }

    function submitAdd() {
        const body = addInput?.value?.trim();
        if (!body) return;
        publish('INTENT_COMMENT_ADD', {
            scope: currentScope,
            anchor: scopeAnchor(currentScope),
            body,
            timestamp: Date.now()
        });
        if (addInput) addInput.value = '';
    }

    function publish(name, payload) {
        if (typeof eventBus.publishSync === 'function') eventBus.publishSync(name, payload);
        else eventBus.publish(name, payload);
    }

    /** Per-card scope chip (e.g. "Slide 3"). Click navigates via onScopeNavigate. */
    function scopeChip(scope) {
        if (typeof scopeLabel !== 'function' || !scope) return null;
        const label = scopeLabel(scope);
        if (!label) return null;
        return spec('button', {
            className: 'csma-comment-scope',
            text: label,
            dataset: { action: 'goto-scope', scope: String(scope) },
            attrs: { type: 'button', title: 'Go to ' + label }
        });
    }

    // ── scopeRail rendering ────────────────────────────────────────────

    function renderRail() {
        if (!scopeRail || !rootEl) return;
        // Tear down the previous host render (cards + thumb cleanups).
        if (railRenderCleanup) { try { railRenderCleanup(); } catch { /* best-effort */ } railRenderCleanup = null; }
        railContainer = rootEl.querySelector('.csma-comments-scoperail');
        if (!railContainer) return;
        railContainer.replaceChildren();
        // Delegate card creation to the host. The host appends elements
        // (each carrying data-scope) into railContainer and returns a
        // cleanup that tears down any renderThumb observers.
        railRenderCleanup = scopeRail.render(railContainer) || null;
        updateActiveRail();
    }

    /** Toggle data-active on scope-rail cards to match currentScope. */
    function updateActiveRail() {
        if (!railContainer) return;
        const cards = railContainer.querySelectorAll('[data-scope]');
        cards.forEach((card) => {
            card.dataset.active = card.dataset.scope === currentScope ? 'true' : 'false';
        });
    }

    // ── list rendering ─────────────────────────────────────────────────

    function reRender() {
        if (!listEl) return;
        listEl.replaceChildren();
        const all = listComments();
        const roots = all.filter((c) => !c.parent_id);
        const byParent = new Map();
        for (const c of all) {
            if (c.parent_id) {
                if (!byParent.has(c.parent_id)) byParent.set(c.parent_id, []);
                byParent.get(c.parent_id).push(c);
            }
        }
        const frag = doc.createDocumentFragment();
        if (roots.length === 0) {
            const { root } = buildEmpty();
            frag.appendChild(root);
        } else {
            for (const r of roots) {
                const replies = byParent.get(r.id) || [];
                const { root } = buildComment(r, replies);
                frag.appendChild(root);
            }
        }
        listEl.appendChild(frag);
        updateCount(roots.length, all.length);
    }

    function listComments() {
        let items = service.getByScope(currentScope) || [];
        items = items.filter((c) => c.status !== 'deleted');
        if (filter === 'open') {
            items = items.filter((c) => (c.status === 'open' || c.status === 'reopened') && c.type !== 'system');
        } else if (filter === 'activity') {
            items = items.filter((c) => c.type === 'system' || c.type === 'annotation');
        }
        return items;
    }

    function buildEmpty() {
        const messages = {
            open: 'No open comments.',
            activity: 'No activity yet.',
            all: 'No comments yet.'
        };
        return getComposer().mountTree(spec('div', {
            className: 'csma-comments-empty',
            attrs: { role: 'status' },
            text: messages[filter] || 'No comments.'
        }), null, { documentRef: doc });
    }

    function buildComment(c, replies) {
        const open = c.status === 'open' || c.status === 'reopened';
        const focused = focusId && String(focusId) === String(c.id);
        const isEditing = editing.has(c.id);
        const isReplying = replying.has(c.id);

        const children = [
            spec('div', {
                className: 'csma-comment-meta',
                children: [
                    scopeChip(c.scope),
                    spec('span', { className: 'csma-comment-author', text: authorName(c.author) }),
                    spec('span', { className: 'csma-comment-time', text: formatTime(c.created_at) }),
                    spec('span', {
                        className: 'csma-comment-status',
                        text: statusLabel(c.status),
                        dataset: { status: c.status }
                    })
                ]
            })
        ];

        if (isEditing) {
            children.push(spec('textarea', {
                className: 'csma-comment-edit-input',
                text: c.body,
                attrs: { rows: '3', maxlength: '20000', 'aria-label': 'Edit comment' }
            }));
            children.push(spec('div', {
                className: 'csma-comment-form-actions',
                children: [
                    spec('button', { className: 'csma-comment-btn', text: 'Save', dataset: { action: 'edit-save' }, attrs: { type: 'button' } }),
                    spec('button', { className: 'csma-comment-btn ghost', text: 'Cancel', dataset: { action: 'edit-cancel' }, attrs: { type: 'button' } })
                ]
            }));
        } else {
            children.push(spec('div', { className: 'csma-comment-body', text: c.body }));
            children.push(spec('div', {
                className: 'csma-comment-actions',
                children: rootActions(c, open)
            }));
        }

        if (isReplying) {
            children.push(spec('div', {
                className: 'csma-comment-reply-form',
                children: [
                    spec('textarea', {
                        className: 'csma-comment-reply-input',
                        attrs: { rows: '2', maxlength: '20000', placeholder: 'Reply…', 'aria-label': 'Reply body' }
                    }),
                    spec('div', {
                        className: 'csma-comment-form-actions',
                        children: [
                            spec('button', { className: 'csma-comment-btn', text: 'Reply', dataset: { action: 'reply-save' }, attrs: { type: 'button' } }),
                            spec('button', { className: 'csma-comment-btn ghost', text: 'Cancel', dataset: { action: 'reply-cancel' }, attrs: { type: 'button' } })
                        ]
                    })
                ]
            }));
        }

        if (replies.length) {
            children.push(spec('div', {
                className: 'csma-comment-replies',
                attrs: { role: 'list' },
                children: replies.map((r) => replySpec(r))
            }));
        }

        const className = 'csma-comment'
            + (focused ? ' is-focused' : '');
        return getComposer().mountTree(spec('article', {
            className,
            dataset: { id: c.id, status: c.status, anchorType: c.anchor_type || '' },
            attrs: { role: 'listitem' },
            children
        }), null, { documentRef: doc });
    }

    function replySpec(r) {
        const open = r.status === 'open' || r.status === 'reopened';
        return spec('article', {
            className: 'csma-comment csma-comment--reply',
            dataset: { id: r.id, status: r.status, anchorType: r.anchor_type || '' },
            attrs: { role: 'listitem' },
            children: [
                spec('div', {
                    className: 'csma-comment-meta',
                    children: [
                        spec('span', { className: 'csma-comment-author', text: authorName(r.author) }),
                        spec('span', { className: 'csma-comment-time', text: formatTime(r.created_at) }),
                        spec('span', {
                            className: 'csma-comment-status',
                            text: statusLabel(r.status),
                            dataset: { status: r.status }
                        })
                    ]
                }),
                spec('div', { className: 'csma-comment-body', text: r.body }),
                spec('div', {
                    className: 'csma-comment-actions',
                    children: replyActions(r, open)
                })
            ]
        });
    }

    function rootActions(c, open) {
        const btns = [];
        // Locate on slide: jump to the element this comment is anchored to
        // (opens the popup via INTENT_COMMENTS_FOCUS). Only for element-anchored
        // comments that target a specific id (picker-created), not scope-level.
        if (c.anchor_type === 'element' && c.anchor && c.anchor.id) {
            btns.push(spec('button', {
                className: 'csma-comment-btn ghost',
                text: '📍',
                dataset: { action: 'locate' },
                attrs: { type: 'button', title: 'Show on slide', 'aria-label': 'Show this comment on the slide' }
            }));
        }
        if (open) {
            btns.push(spec('button', { className: 'csma-comment-btn', text: 'Resolve', dataset: { action: 'resolve' }, attrs: { type: 'button' } }));
        } else if (c.status === 'resolved') {
            btns.push(spec('button', { className: 'csma-comment-btn', text: 'Reopen', dataset: { action: 'reopen' }, attrs: { type: 'button' } }));
        }
        btns.push(spec('button', { className: 'csma-comment-btn ghost', text: 'Reply', dataset: { action: 'reply' }, attrs: { type: 'button' } }));
        btns.push(spec('button', { className: 'csma-comment-btn ghost', text: 'Edit', dataset: { action: 'edit' }, attrs: { type: 'button' } }));
        btns.push(spec('button', { className: 'csma-comment-btn danger', text: 'Delete', dataset: { action: 'delete' }, attrs: { type: 'button' } }));
        return btns;
    }

    function replyActions(r, open) {
        const btns = [];
        if (open) {
            btns.push(spec('button', { className: 'csma-comment-btn', text: 'Resolve', dataset: { action: 'resolve' }, attrs: { type: 'button' } }));
        } else if (r.status === 'resolved') {
            btns.push(spec('button', { className: 'csma-comment-btn', text: 'Reopen', dataset: { action: 'reopen' }, attrs: { type: 'button' } }));
        }
        btns.push(spec('button', { className: 'csma-comment-btn danger', text: 'Delete', dataset: { action: 'delete' }, attrs: { type: 'button' } }));
        return btns;
    }

    function updateCount(openRoots, totalAll) {
        const el = rootEl?.querySelector('.csma-comments-count');
        if (!el) return;
        el.textContent = filter === 'open' ? `${openRoots} open` : `${totalAll} total`;
    }

    // ── helpers ────────────────────────────────────────────────────────

    /**
     * Drawer-added comments have no specific element target. Use a scope-host
     * selector so the AnchorResolver can locate the scope container when it
     * carries `data-comments-scope="<scope>"`. When no such host exists the
     * resolver returns null gracefully (comment still stored + scoped).
     */
    function scopeAnchor(scope) {
        const sel = scope
            ? `[data-comments-scope="${cssAttr(scope)}"]`
            : '[data-comments-scope]';
        return { anchor_type: 'element', anchor: { selector: sel } };
    }

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

    function cssAttr(v) {
        return String(v).replace(/"/g, '\\"');
    }

    return { open, close, focus, isOpen, destroy };
}
