/**
 * AnnotationCommentService — wraps the annotation engine with CRUD,
 * queries, and EventBus events for annotation comments.
 *
 * All mutations go through Transaction → undo/redo.
 */
import { addAnnotation, removeAnnotation, addNodeAnnotation, addDocumentAnnotation } from '../engine/AnnotationOps.js';
import { MentionParser } from '../lib/MentionParser.js';

const VALID_STATUSES = new Set(['open', 'resolved', 'reopened']);

export class AnnotationCommentService {
    constructor(eventBus, sessionService) {
        this.eventBus = eventBus;
        this.session = sessionService;
        this.parser = new MentionParser();
        this._editorId = null;
        this._currentUserId = null;
        this._subscriptions = [];
        this.initialized = false;
    }

    // ===================================================================
    // Lifecycle
    // ===================================================================

    init({ editorId, currentUserId } = {}) {
        if (this.initialized) this.destroy();
        this.initialized = true;
        this._editorId = editorId || null;
        this._currentUserId = currentUserId || null;
    }

    destroy() {
        this._subscriptions.forEach(fn => { try { fn(); } catch {} });
        this._subscriptions = [];
        this._editorId = null;
        this._currentUserId = null;
        this.initialized = false;
    }

    // ===================================================================
    // Queries
    // ===================================================================

    /**
     * Get all comments, optionally filtered.
     * @param {object} [filter]
     * @param {string} [filter.status] — 'open', 'resolved', 'reopened'
     * @param {string} [filter.anchor_type] — 'text', 'node', 'document'
     * @param {string} [filter.author_id] — author ID to match
     * @param {string} [filter.assigned_to] — assignee ID to match
     * @param {string} [filter.search] — case-insensitive body search
     * @returns {Array<object>}
     */
    getComments(filter = {}) {
        if (!this.session || !this.session.doc) return [];
        const nodes = this.session.doc.nodes || {};
        const results = [];

        for (const [id, node] of Object.entries(nodes)) {
            if (node.type !== 'annotation_comment') continue;
            const p = node.payload || {};
            if (filter.status && p.status !== filter.status) continue;
            if (filter.anchor_type && node.anchor_type !== filter.anchor_type) continue;
            if (filter.author_id && p.author?.id !== filter.author_id) continue;
            if (filter.assigned_to && p.assigned_to?.id !== filter.assigned_to) continue;
            if (filter.search && !(p.body || '').toLowerCase().includes(filter.search.toLowerCase())) continue;
            results.push(this._toComment(id, node));
        }
        return results.sort((a, b) => (b.payload.created_at || 0) - (a.payload.created_at || 0));
    }

    /**
     * Get a single comment by ID.
     * @param {string} id
     * @returns {object|null}
     */
    getComment(id) {
        if (!this.session || !this.session.doc) return null;
        const node = this.session.doc.nodes[id];
        if (!node || node.type !== 'annotation_comment') return null;
        return this._toComment(id, node);
    }

    /**
     * Get comment statistics.
     * @returns {{ total: number, open: number, resolved: number, reopened: number, assignedToMe: number }}
     */
    getStats() {
        const comments = this.getComments();
        return {
            total: comments.length,
            open: comments.filter(c => c.payload.status === 'open').length,
            resolved: comments.filter(c => c.payload.status === 'resolved').length,
            reopened: comments.filter(c => c.payload.status === 'reopened').length,
            assignedToMe: this._currentUserId
                ? comments.filter(c => c.payload.assigned_to?.id === this._currentUserId).length
                : 0
        };
    }

    // ===================================================================
    // CRUD
    // ===================================================================

    /**
     * Add a comment. Anchor determines annotation type.
     * @param {object} anchor — { type: 'text'|'node'|'document', path?, start_offset?, end_offset?, node_path? }
     * @param {object} [payload] — { author?, body?, assigned_to?, thread_reply_to? }
     * @returns {string} comment node ID
     */
    addComment(anchor, payload = {}) {
        if (!this.session) throw new Error('Session not available');

        const fullPayload = {
            author: payload.author || { id: this._currentUserId || 'anonymous', name: 'Anonymous' },
            body: payload.body || '',
            created_at: Date.now(),
            edited_at: null,
            status: 'open',
            resolved_at: null,
            resolved_by: null,
            assigned_to: payload.assigned_to || null,
            thread_reply_to: payload.thread_reply_to || null
        };

        const tr = this.session.tr;

        switch (anchor.type) {
            case 'node':
                if (!anchor.node_path) throw new Error('node_path required for node anchor');
                addNodeAnnotation(tr, anchor.node_path, 'annotation_comment', fullPayload);
                break;
            case 'document':
                addDocumentAnnotation(tr, 'annotation_comment', fullPayload);
                break;
            case 'text':
            default:
                if (!anchor.path || anchor.start_offset === undefined || anchor.end_offset === undefined) {
                    throw new Error('path, start_offset, end_offset required for text anchor');
                }
                addAnnotation(tr, anchor.path, anchor.start_offset, anchor.end_offset, 'annotation_comment', fullPayload);
                break;
        }

        // Find the created annotation node ID from the transaction ops
        const commentId = this._findCreatedId(tr);

        this.session.apply(tr);

        // Parse mentions
        const mentions = this.parser.parse(fullPayload.body);

        this.eventBus.publish('ANNOTATION_COMMENT_ADDED', {
            editorId: this._editorId,
            commentId,
            anchor,
            payload: fullPayload,
            timestamp: Date.now()
        });

        if (mentions.length > 0) {
            this.eventBus.publish('MENTION_DETECTED', {
                source: 'annotation_comment',
                sourceId: commentId,
                body: fullPayload.body,
                mentions,
                context: {
                    anchor,
                    editorId: this._editorId,
                    documentId: this.session.documentId
                },
                timestamp: Date.now()
            });
        }

        return commentId;
    }

    /**
     * Edit a comment's body.
     * @param {string} id
     * @param {string} body
     */
    editComment(id, body) {
        const comment = this.getComment(id);
        if (!comment) throw new Error(`Comment ${id} not found`);

        const newPayload = {
            ...comment.payload,
            body,
            edited_at: Date.now()
        };

        const tr = this.session.tr;
        tr.set([id, 'payload'], newPayload);
        this.session.apply(tr);

        this.eventBus.publish('ANNOTATION_COMMENT_UPDATED', {
            editorId: this._editorId,
            commentId: id,
            payload: newPayload,
            timestamp: Date.now()
        });
    }

    /**
     * Resolve a comment.
     * @param {string} id
     */
    resolveComment(id) {
        this._setStatus(id, 'resolved');
    }

    /**
     * Reopen a resolved comment.
     * @param {string} id
     */
    reopenComment(id) {
        this._setStatus(id, 'reopened');
    }

    /**
     * Reassign a comment to a different user.
     * @param {string} id
     * @param {string} userId
     */
    reassignComment(id, userId) {
        const comment = this.getComment(id);
        if (!comment) throw new Error(`Comment ${id} not found`);

        const newPayload = {
            ...comment.payload,
            assigned_to: { id: userId, name: userId }
        };

        const tr = this.session.tr;
        tr.set([id, 'payload'], newPayload);
        this.session.apply(tr);

        this.eventBus.publish('ANNOTATION_COMMENT_UPDATED', {
            editorId: this._editorId,
            commentId: id,
            payload: newPayload,
            timestamp: Date.now()
        });
    }

    /**
     * Delete a comment and all its annotation references.
     * @param {string} id
     */
    deleteComment(id) {
        const comment = this.getComment(id);
        if (!comment) throw new Error(`Comment ${id} not found`);

        const tr = this.session.tr;

        // Find and remove property references based on anchor type
        if (comment.anchor_type !== 'document') {
            this._removeAnnotationRefs(tr, id);
        }

        // Delete the annotation node itself
        tr.delete(id);
        this.session.apply(tr);

        this.eventBus.publish('ANNOTATION_COMMENT_UPDATED', {
            editorId: this._editorId,
            commentId: id,
            deleted: true,
            timestamp: Date.now()
        });
    }

    // ===================================================================
    // Internal helpers
    // ===================================================================

    /**
     * Set comment status.
     * @private
     */
    _setStatus(id, status) {
        if (!VALID_STATUSES.has(status)) throw new Error(`Invalid status: ${status}`);
        const comment = this.getComment(id);
        if (!comment) throw new Error(`Comment ${id} not found`);

        const now = Date.now();
        const newPayload = {
            ...comment.payload,
            status,
            resolved_at: status === 'resolved' ? now : comment.payload.resolved_at,
            resolved_by: status === 'resolved'
                ? { id: this._currentUserId || 'anonymous', resolved_at: now }
                : comment.payload.resolved_by
        };

        const tr = this.session.tr;
        tr.set([id, 'payload'], newPayload);
        this.session.apply(tr);

        const eventName = status === 'resolved'
            ? 'ANNOTATION_COMMENT_RESOLVED'
            : 'ANNOTATION_COMMENT_REOPENED';

        this.eventBus.publish(eventName, {
            editorId: this._editorId,
            commentId: id,
            payload: newPayload,
            timestamp: Date.now()
        });
    }

    /**
     * Convert a raw node to a comment view object.
     * @private
     */
    _toComment(id, node) {
        return {
            id,
            type: node.type,
            anchor_type: node.anchor_type || 'text',
            anchor_path: node.anchor_path || null,
            payload: node.payload || {}
        };
    }

    /**
     * Find the created annotation_comment node ID in the transaction ops.
     * @private
     */
    _findCreatedId(tr) {
        for (const op of (tr.ops || [])) {
            if (op[0] === 'create' && op[1] && op[1].type === 'annotation_comment') {
                return op[1].id;
            }
        }
        return null;
    }

    /**
     * Remove all property references to an annotation node.
     * @private
     */
    _removeAnnotationRefs(tr, annId) {
        if (!this.session.doc) return;
        const nodes = this.session.doc.nodes || {};

        for (const [id, node] of Object.entries(nodes)) {
            for (const [propKey, propVal] of Object.entries(node)) {
                if (propVal && typeof propVal === 'object' && Array.isArray(propVal.annotations)) {
                    const hasMatch = propVal.annotations.some(a => a.node_id === annId);
                    if (hasMatch) {
                        const newAnnotations = propVal.annotations.filter(a => a.node_id !== annId);
                        tr.set([id, propKey], { ...propVal, annotations: newAnnotations });
                        return; // Only one property references a given annotation
                    }
                }
            }
        }
    }
}
