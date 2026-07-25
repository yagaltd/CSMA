/**
 * AnnotationHighlights — adds visual markers on DOM elements that have
 * annotation comments. Uses direct class injection (no overlay).
 *
 * Part of Phase 5: Rendering Components.
 */

/**
 * Initialize annotation highlights for a visual editor instance.
 *
 * @param {string} editorId
 * @param {object} sessionService — EditorSessionService instance
 * @param {object} eventBus — CSMA EventBus
 * @param {object} [annotationCommentService] — AnnotationCommentService instance
 * @returns {{ mount(container: HTMLElement): void, destroy(): void, refresh(): void }}
 */
export function initAnnotationHighlights(editorId, sessionService, eventBus, annotationCommentService) {
    let container = null;
    let badgeEl = null;
    const _unsubscribers = [];
    // Track which elements we've styled, so we can clean up on refresh
    let _styledElements = new Map(); // element → previous classList state

    // Color mapping for comment status
    const STATUS_COLORS = {
        open: '#f59e0b',       // amber
        resolved: '#22c55e',   // green
        reopened: '#ef4444'    // red
    };

    function mount(el) {
        container = el;
        badgeEl = document.createElement('div');
        badgeEl.className = 've-annotation-document-badge';
        badgeEl.style.display = 'none';
        badgeEl.addEventListener('click', () => {
            if (badgeEl._commentId) {
                eventBus.publish('SELECT_ANNOTATION', { commentId: badgeEl._commentId, editorId });
            }
        });
        container.appendChild(badgeEl);

        refresh();

        const events = [
            'ANNOTATION_COMMENT_ADDED',
            'ANNOTATION_COMMENT_UPDATED',
            'ANNOTATION_COMMENT_RESOLVED',
            'ANNOTATION_COMMENT_REOPENED',
            'EDITOR_DOCUMENT_CHANGED'
        ];
        for (const ev of events) {
            _unsubscribers.push(eventBus.subscribe(ev, () => refresh()));
        }

        _unsubscribers.push(eventBus.subscribe('SELECT_ANNOTATION', (details) => {
            if (!details || !details.commentId) return;
            const el = container.querySelector(`[data-annotation-id="${details.commentId}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Flash
                const origBg = el.style.background;
                el.style.background = 'rgba(245,158,11,0.3)';
                el.style.transition = 'background 0.3s';
                setTimeout(() => { el.style.background = origBg; }, 1500);
            }
        }));
    }

    function destroy() {
        _unsubscribers.forEach(fn => { try { fn(); } catch {} });
        _unsubscribers.length = 0;
        _clearAllStyles();
        _styledElements.clear();
        if (badgeEl) { badgeEl.remove(); badgeEl = null; }
        container = null;
    }

    function refresh() {
        if (!container) return;
        _clearAllStyles();

        // Get comments from the session document directly
        if (!sessionService || !sessionService.doc) return;
        const nodes = sessionService.doc.nodes || {};

        // Collect all annotation references from properties
        const commentRefs = []; // { node_id, pathStr, status }
        for (const [nodeId, node] of Object.entries(nodes)) {
            for (const [propKey, propVal] of Object.entries(node)) {
                if (propVal && typeof propVal === 'object' && Array.isArray(propVal.annotations)) {
                    for (const ann of propVal.annotations) {
                        const annNode = nodes[ann.node_id];
                        if (!annNode || annNode.type !== 'annotation_comment') continue;
                        const status = (annNode.payload && annNode.payload.status) || 'open';
                        commentRefs.push({
                            node_id: ann.node_id,
                            pathStr: nodeId + ',' + propKey,
                            status: status,
                            body: (annNode.payload && annNode.payload.body) || '',
                            anchor_type: annNode.anchor_type || 'text'
                        });
                    }
                }
            }
        }

        // Also find document-level annotations
        const docComments = [];
        for (const [id, node] of Object.entries(nodes)) {
            if (node.type === 'annotation_comment' && node.anchor_type === 'document') {
                docComments.push({ id, body: (node.payload && node.payload.body) || '' });
            }
        }

        // Apply styles to matching DOM elements
        for (const ref of commentRefs) {
            const el = container.querySelector(`[data-property-path="${ref.pathStr}"]`);
            if (el) {
                const color = STATUS_COLORS[ref.status] || STATUS_COLORS.open;
                // Store original state
                _styledElements.set(el, {
                    borderLeft: el.style.borderLeft,
                    paddingLeft: el.style.paddingLeft,
                    position: el.style.position
                });
                // Apply annotation style
                el.style.borderLeft = `3px solid ${color}`;
                el.style.paddingLeft = '12px';
                el.style.position = 'relative';
                el.setAttribute('data-annotation-id', ref.node_id);
                el.title = ref.body;

                // Add small status dot
                const dot = document.createElement('span');
                dot.className = 've-annotation-dot';
                dot.style.cssText = `position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:8px;height:8px;border-radius:50%;background:${color};z-index:2;`;
                dot.setAttribute('data-annotation-id', ref.node_id);
                el.appendChild(dot);
                _styledElements.set(dot, { _dot: true });
            }
        }

        // Document-level badge
        if (docComments.length > 0) {
            badgeEl.style.display = '';
            badgeEl.textContent = `💬 ${docComments.length} general comment${docComments.length > 1 ? 's' : ''}`;
            badgeEl._commentId = docComments[0].id;
        } else {
            badgeEl.style.display = 'none';
            badgeEl._commentId = null;
        }
    }

    function _clearAllStyles() {
        for (const [el, orig] of _styledElements) {
            if (orig._dot) {
                el.remove();
            } else {
                el.style.borderLeft = orig.borderLeft || '';
                el.style.paddingLeft = orig.paddingLeft || '';
                el.style.position = orig.position || '';
                el.removeAttribute('data-annotation-id');
                el.removeAttribute('title');
                // Remove any dot children
                const dots = el.querySelectorAll('.ve-annotation-dot');
                dots.forEach(d => d.remove());
            }
        }
        _styledElements.clear();
    }

    return { mount, destroy, refresh };
}
