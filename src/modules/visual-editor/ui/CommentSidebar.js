/**
 * CommentSidebar — a sidebar drawer that lists annotation comments
 * with filters, actions, and click-to-scroll.
 *
 * Part of Phase 6: Comment Sidebar.
 */

/**
 * Initialize the comment sidebar.
 *
 * @param {object}   eventBus       — CSMA EventBus
 * @param {object}   commentService — AnnotationCommentService instance
 * @returns {{ mount(container: HTMLElement): void, destroy(): void, toggle(): void }}
 */
export function initCommentSidebar(eventBus, commentService) {
    let container = null;
    let sidebarEl = null;
    let toggleBtn = null;
    let filterSelect = null;
    let searchInput = null;
    let listEl = null;
    let addCommentInput = null;
    let addCommentBtn = null;
    let savedSelection = null; // { path, startOffset, endOffset } saved from editor

    /**
     * Capture the current text selection inside a [data-path] element.
     * Called on mouseup/keyup inside the editor container.
     */
    function _captureSelection() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const ancestor = range.commonAncestorContainer;
        const ancestorEl = ancestor.nodeType === Node.TEXT_NODE
            ? ancestor.parentElement
            : (ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : null);
        const editorEl = ancestorEl?.closest?.('[data-path]');

        if (!editorEl) return;
        const rawPath = editorEl.getAttribute('data-path');
        if (!rawPath) return;

        const preRange = document.createRange();
        preRange.setStart(editorEl, 0);
        preRange.setEnd(range.startContainer, range.startOffset);
        const startOffset = preRange.toString().length;
        const endOffset = startOffset + range.toString().length;

        if (endOffset > startOffset) {
            savedSelection = {
                path: rawPath.split('.'),
                startOffset,
                endOffset,
                text: range.toString()
            };
            console.log('[CommentSidebar] Selection saved:', savedSelection.path.join('.'), `"${savedSelection.text.slice(0, 30)}"`);
        }
    }
    let isOpen = false;
    const _unsubscribers = [];

    /* ------------------------------------------------------------------ */

    /**
     * Append an <option> to a <select> element.
     * @private
     */
    function _addOption(selectEl, value, label) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        selectEl.appendChild(opt);
    }

    function mount(el) {
        container = el;

        // Create toggle button (visible when sidebar closed)
        toggleBtn = document.createElement('button');
        toggleBtn.className = 've-comment-toggle';
        toggleBtn.setAttribute('aria-label', 'Toggle comments');
        toggleBtn.addEventListener('click', toggle);
        container.appendChild(toggleBtn);

        // Capture text selections inside the editor (not sidebar)
        function selectionHandler() {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const node = sel.anchorNode;
            if (!node) return;
            // Only capture if selection is inside the editor container, not the sidebar
            const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            if (el && el.closest('[data-path]')) {
                _captureSelection();
            }
        }
        document.addEventListener('mouseup', selectionHandler);
        document.addEventListener('keyup', selectionHandler);
        _unsubscribers.push(() => document.removeEventListener('mouseup', selectionHandler));
        _unsubscribers.push(() => document.removeEventListener('keyup', selectionHandler));

        // Create sidebar drawer
        sidebarEl = document.createElement('div');
        sidebarEl.className = 've-comment-sidebar';

        // Add comment input
        const addCommentBar = document.createElement('div');
        addCommentBar.className = 've-comment-sidebar__add';

        addCommentInput = document.createElement('textarea');
        addCommentInput.className = 've-comment-sidebar__add-input';
        addCommentInput.placeholder = 'Add a comment... (select text first to anchor it)';
        addCommentInput.rows = 2;
        addCommentInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                _submitComment();
            }
        });
        addCommentBar.appendChild(addCommentInput);

        addCommentBtn = document.createElement('button');
        addCommentBtn.className = 've-comment-sidebar__add-btn';
        addCommentBtn.textContent = 'Post';
        addCommentBtn.addEventListener('click', () => _submitComment());
        addCommentBar.appendChild(addCommentBtn);

        sidebarEl.appendChild(addCommentBar);
        sidebarEl.setAttribute('aria-hidden', 'true');
        sidebarEl.setAttribute('role', 'complementary');

        // Filter bar
        const filterBar = document.createElement('div');
        filterBar.className = 've-comment-sidebar__filters';

        filterSelect = document.createElement('select');
        filterSelect.className = 've-comment-sidebar__filter-select';
        _addOption(filterSelect, 'all', 'All');
        _addOption(filterSelect, 'open', 'Open');
        _addOption(filterSelect, 'resolved', 'Resolved');
        _addOption(filterSelect, 'reopened', 'Reopened');
        filterSelect.addEventListener('change', render);
        filterBar.appendChild(filterSelect);

        searchInput = document.createElement('input');
        searchInput.className = 've-comment-sidebar__search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Search comments...';
        searchInput.addEventListener('input', render);
        filterBar.appendChild(searchInput);

        sidebarEl.appendChild(filterBar);

        // Comment list
        listEl = document.createElement('div');
        listEl.className = 've-comment-sidebar__list';
        listEl.setAttribute('role', 'list');
        listEl.setAttribute('aria-live', 'polite');
        sidebarEl.appendChild(listEl);

        container.appendChild(sidebarEl);

        // Subscribe to comment service events
        const events = [
            'ANNOTATION_COMMENT_ADDED',
            'ANNOTATION_COMMENT_UPDATED',
            'ANNOTATION_COMMENT_RESOLVED',
            'ANNOTATION_COMMENT_REOPENED',
        ];
        for (const ev of events) {
            _unsubscribers.push(eventBus.subscribe(ev, () => render()));
        }

        // Listen for SELECT_ANNOTATION to open sidebar to specific comment
        _unsubscribers.push(
            eventBus.subscribe('SELECT_ANNOTATION', (details) => {
                if (!isOpen) open();
                if (details && details.commentId) {
                    const card = listEl?.querySelector(`[data-comment-id="${details.commentId}"]`);
                    if (card && typeof card.scrollIntoView === 'function') {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            })
        );

        function _submitComment() {
            const body = addCommentInput?.value?.trim();
            if (!body || !commentService) return;

            let anchor = { type: 'document' };

            // Use saved selection (captured on mouseup/keyup in editor)
            if (savedSelection && savedSelection.endOffset > savedSelection.startOffset) {
                anchor = {
                    type: 'text',
                    path: savedSelection.path,
                    start_offset: savedSelection.startOffset,
                    end_offset: savedSelection.endOffset
                };
                console.log('[CommentSidebar] Using saved text anchor:', anchor);
                savedSelection = null; // consume it
            } else {
                console.log('[CommentSidebar] No saved selection, creating document-level comment');
            }

            try {
                commentService.addComment(anchor, { body });
                if (addCommentInput) addCommentInput.value = '';
                if (!isOpen) open();
                render();
            } catch (err) {
                console.error('[CommentSidebar] Failed to add comment:', err);
            }
        }

        // Keyboard shortcuts (document-level)
        function handleKeydown(e) {
            if (e.key === 'Escape' && isOpen) {
                close();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                if (!isOpen) open();
                if (addCommentInput) addCommentInput.focus();
                return;
            }
        }
        document.addEventListener('keydown', handleKeydown);
        _unsubscribers.push(() => document.removeEventListener('keydown', handleKeydown));

        render();
    }

    function destroy() {
        for (const unsub of _unsubscribers) {
            try { unsub(); } catch { /* ignore */ }
        }
        _unsubscribers.length = 0;
        if (sidebarEl) {
            sidebarEl.remove();
            sidebarEl = null;
        }
        if (toggleBtn) {
            toggleBtn.remove();
            toggleBtn = null;
        }
        filterSelect = null;
        searchInput = null;
        listEl = null;
        container = null;
        isOpen = false;
    }

    function toggle() {
        if (isOpen) close();
        else open();
    }

    function open() {
        if (!sidebarEl) return;
        isOpen = true;
        sidebarEl.setAttribute('aria-hidden', 'false');
        sidebarEl.classList.add('ve-comment-sidebar--open');
        if (toggleBtn) toggleBtn.classList.add('ve-comment-toggle--active');
        render();
    }

    function close() {
        if (!sidebarEl) return;
        isOpen = false;
        sidebarEl.setAttribute('aria-hidden', 'true');
        sidebarEl.classList.remove('ve-comment-sidebar--open');
        if (toggleBtn) toggleBtn.classList.remove('ve-comment-toggle--active');
    }

    function render() {
        if (!listEl || !toggleBtn) return;

        const filter = filterSelect ? filterSelect.value : 'all';
        const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const opts = {};
        if (filter !== 'all') opts.status = filter;
        if (search) opts.search = search;

        const comments = commentService.getComments(opts);
        const stats = commentService.getStats();

        // Update toggle badge
        toggleBtn.textContent = '\uD83D\uDCAC ' + (stats ? stats.open : 0);
        toggleBtn.setAttribute(
            'aria-label',
            (stats ? stats.open : 0) + ' open comments'
        );

        // Clear and render comment list
        listEl.textContent = '';

        if (comments.length === 0) {
            const empty = document.createElement('div');
            empty.className = 've-comment-sidebar__empty';
            empty.textContent = 'No comments yet';
            listEl.appendChild(empty);
            return;
        }

        for (const comment of comments) {
            const card = createCommentCard(comment);
            listEl.appendChild(card);
        }
    }

    function createCommentCard(comment) {
        const card = document.createElement('div');
        card.className =
            've-comment-card ve-comment-card--' +
            (comment.payload ? comment.payload.status : 'open');
        card.setAttribute('data-comment-id', comment.id);
        card.setAttribute('role', 'listitem');

        // Header: author + assignee + time
        const header = document.createElement('div');
        header.className = 've-comment-card__header';

        const authorEl = document.createElement('span');
        authorEl.className = 've-comment-card__author';
        authorEl.textContent =
            comment.payload && comment.payload.author
                ? comment.payload.author.name || 'Anonymous'
                : 'Anonymous';
        header.appendChild(authorEl);

        if (comment.payload && comment.payload.assigned_to) {
            const assignee = document.createElement('span');
            assignee.className = 've-comment-card__assignee';
            assignee.textContent =
                ' \u2192 ' + comment.payload.assigned_to.name;
            header.appendChild(assignee);
        }

        const timeEl = document.createElement('span');
        timeEl.className = 've-comment-card__time';
        timeEl.textContent = formatTime(
            comment.payload ? comment.payload.created_at : null
        );
        header.appendChild(timeEl);

        card.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 've-comment-card__body';
        body.textContent = comment.payload ? comment.payload.body || '' : '';
        card.appendChild(body);

        // Anchor location (if text or node anchored)
        if (
            comment.anchor_type &&
            comment.anchor_type !== 'document' &&
            comment.anchor_path &&
            comment.anchor_path.length
        ) {
            const location = document.createElement('div');
            location.className = 've-comment-card__location';
            location.textContent = comment.anchor_path.join(' \u203A ');
            card.appendChild(location);
        }

        // Actions
        const status = comment.payload ? comment.payload.status : 'open';
        const actions = document.createElement('div');
        actions.className = 've-comment-card__actions';

        if (status === 'open' || status === 'reopened') {
            const resolveBtn = document.createElement('button');
            resolveBtn.className =
                've-comment-card__action ve-comment-card__action--resolve';
            resolveBtn.textContent = 'Resolve';
            resolveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                commentService.resolveComment(comment.id);
            });
            actions.appendChild(resolveBtn);
        }

        if (status === 'resolved') {
            const reopenBtn = document.createElement('button');
            reopenBtn.className =
                've-comment-card__action ve-comment-card__action--reopen';
            reopenBtn.textContent = 'Reopen';
            reopenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                commentService.reopenComment(comment.id);
            });
            actions.appendChild(reopenBtn);
        }

        card.appendChild(actions);

        // Click-to-scroll: card click scrolls editor to the annotated element
        card.addEventListener('click', () => {
            eventBus.publish('SELECT_ANNOTATION', { commentId: comment.id, editorId: null });

            if (comment.anchor_type !== 'document') {
                const editorContainer = document.getElementById('editor-container');
                if (editorContainer) {
                    let target = null;

                    if (comment.anchor_type === 'node' && comment.anchor_path) {
                        const nodeId = comment.anchor_path[comment.anchor_path.length - 1];
                        target = editorContainer.querySelector('[data-node-id="' + nodeId + '"]');
                    } else if (comment.anchor_type === 'text') {
                        // Primary: match by anchor_path on comment node
                        if (comment.anchor_path && comment.anchor_path.length >= 2) {
                            const pathStr = comment.anchor_path.join(',');
                            target = editorContainer.querySelector('[data-property-path="' + pathStr + '"]');
                        }
                        // Fallback: walk document nodes to find the property referencing this comment
                        if (!target && commentService.session && commentService.session.doc) {
                            const nodes = commentService.session.doc.nodes || {};
                            for (const [nodeId, node] of Object.entries(nodes)) {
                                for (const [propKey, propVal] of Object.entries(node)) {
                                    if (propVal && typeof propVal === 'object' && Array.isArray(propVal.annotations)) {
                                        const match = propVal.annotations.find(a => a.node_id === comment.id);
                                        if (match) {
                                            const pathStr = nodeId + ',' + propKey;
                                            target = editorContainer.querySelector('[data-property-path="' + pathStr + '"]');
                                            if (target) break;
                                        }
                                    }
                                }
                                if (target) break;
                            }
                        }
                    }

                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Flash highlight
                        target.style.transition = 'background 0.3s';
                        target.style.background = 'var(--comment-highlight, rgba(245,158,11,0.3))';
                        setTimeout(() => {
                            target.style.background = '';
                            target.style.transition = '';
                        }, 2000);
                    }
                }
            }
        });

        card.style.cursor = 'pointer';

        return card;
    }

    function formatTime(ts) {
        if (!ts) return '';
        var diff = Date.now() - ts;
        var mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + 'm ago';
        var hours = Math.floor(mins / 60);
        if (hours < 24) return hours + 'h ago';
        var days = Math.floor(hours / 24);
        return days + 'd ago';
    }
    function setLoading(isLoading) {
        if (!listEl) return;
        if (isLoading) {
            listEl.textContent = '';
            for (let i = 0; i < 3; i++) {
                const skeleton = document.createElement('div');
                skeleton.className = 've-comment-card ve-comment-card--skeleton';
                const bar1 = document.createElement('div');
                bar1.style.cssText = 'height:14px;width:60%;background:var(--color-border,#e5e7eb);border-radius:4px;margin-bottom:8px';
                const bar2 = document.createElement('div');
                bar2.style.cssText = 'height:14px;width:80%;background:var(--color-border,#e5e7eb);border-radius:4px;margin-bottom:8px';
                const bar3 = document.createElement('div');
                bar3.style.cssText = 'height:14px;width:40%;background:var(--color-border,#e5e7eb);border-radius:4px';
                skeleton.appendChild(bar1);
                skeleton.appendChild(bar2);
                skeleton.appendChild(bar3);
                listEl.appendChild(skeleton);
            }
        } else {
            render();
        }
    }

    return { mount, destroy, toggle, setLoading };
}
