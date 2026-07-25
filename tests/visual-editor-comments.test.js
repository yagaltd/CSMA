/**
 * Visual Editor — AnnotationCommentService Tests
 *
 * Tests CRUD, queries, EventBus events, and lifecycle for the
 * annotation comment service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AnnotationCommentService } from '../src/modules/visual-editor/services/AnnotationCommentService.js';
import { EditorSessionService } from '../src/modules/visual-editor/services/EditorSessionService.js';
import { defineDocumentSchema } from '../src/modules/visual-editor/engine/DocumentSchema.js';
import { ANNOTATION_COMMENT_SCHEMA } from '../src/modules/visual-editor/engine/AnnotationSchema.js';

// ===========================================================================
// Test helpers
// ===========================================================================

let _idCounter = 0;
function resetIdCounter() { _idCounter = 0; }
function generateId() { return `gen_${_idCounter++}`; }

function makeMockEventBus() {
    const self = {
        events: [],
        publish(name, payload) {
            self.events.push({ name, payload });
        },
        subscribe() {
            return () => {};
        }
    };
    return self;
}

function makeSilentEventBus() {
    return {
        publish() {},
        subscribe() { return () => {}; }
    };
}

function makeTestSchema() {
    return defineDocumentSchema({
        doc: {
            kind: 'document',
            properties: {
                title: { type: 'string', default: '' },
                body: {
                    type: 'node_array',
                    node_types: ['paragraph'],
                    default_node_type: 'paragraph'
                }
            }
        },
        paragraph: {
            kind: 'block',
            properties: {
                content: {
                    type: 'text',
                    annotation_types: ['annotation_comment']
                }
            }
        },
        ...ANNOTATION_COMMENT_SCHEMA
    });
}

function makeTestDoc() {
    return {
        document_id: 'doc1',
        nodes: {
            doc1: {
                id: 'doc1',
                type: 'doc',
                title: 'Test Doc',
                body: {
                    nodes: ['para1', 'para2'],
                    marks: [],
                    annotations: []
                }
            },
            para1: {
                id: 'para1',
                type: 'paragraph',
                content: {
                    content: 'Hello world',
                    marks: [],
                    annotations: []
                }
            },
            para2: {
                id: 'para2',
                type: 'paragraph',
                content: {
                    content: 'Second paragraph with @user:alice mention',
                    marks: [],
                    annotations: []
                }
            }
        }
    };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('AnnotationCommentService', () => {
    let mockBus, session, service, schema;

    beforeEach(() => {
        resetIdCounter();
        mockBus = makeMockEventBus();
        schema = makeTestSchema();

        const sessionBus = makeSilentEventBus();
        session = new EditorSessionService(sessionBus);
        session.init({
            editorId: 'editor-1',
            schema,
            doc: structuredClone(makeTestDoc()),
            config: { generate_id: generateId }
        });

        service = new AnnotationCommentService(mockBus, session);
        service.init({ editorId: 'editor-1', currentUserId: 'user-1' });
    });

    // ===================================================================
    // Lifecycle
    // ===================================================================

    describe('init / destroy', () => {
        it('initializes and destroys cleanly', () => {
            expect(service.initialized).toBe(true);
            expect(service._editorId).toBe('editor-1');
            expect(service._currentUserId).toBe('user-1');

            service.destroy();

            expect(service.initialized).toBe(false);
            expect(service._editorId).toBeNull();
            expect(service._currentUserId).toBeNull();
        });

        it('re-initializes safely', () => {
            service.init({ editorId: 'editor-2', currentUserId: 'user-2' });
            expect(service.initialized).toBe(true);
            expect(service._editorId).toBe('editor-2');
            expect(service._currentUserId).toBe('user-2');
        });

        it('defaults editorId and currentUserId when not provided', () => {
            service.destroy();
            service.init();
            expect(service._editorId).toBeNull();
            expect(service._currentUserId).toBeNull();
        });
    });

    // ===================================================================
    // addComment
    // ===================================================================

    describe('addComment', () => {
        it('creates a comment with text anchor and publishes event', () => {
            const commentId = service.addComment(
                { type: 'text', path: ['para1', 'content'], start_offset: 0, end_offset: 5 },
                { body: 'Nice work!' }
            );

            expect(commentId).toBeTruthy();
            expect(typeof commentId).toBe('string');

            const comment = service.getComment(commentId);
            expect(comment).toBeTruthy();
            expect(comment.type).toBe('annotation_comment');
            expect(comment.anchor_type).toBe('text');
            expect(comment.payload.body).toBe('Nice work!');
            expect(comment.payload.status).toBe('open');
            expect(comment.payload.author.id).toBe('user-1');

            // Verify ANNOTATION_COMMENT_ADDED event
            const addedEvent = mockBus.events.find(e => e.name === 'ANNOTATION_COMMENT_ADDED');
            expect(addedEvent).toBeTruthy();
            expect(addedEvent.payload.commentId).toBe(commentId);
            expect(addedEvent.payload.payload.body).toBe('Nice work!');
            expect(addedEvent.payload.anchor.type).toBe('text');
        });

        it('creates a comment with node anchor', () => {
            const commentId = service.addComment(
                { type: 'node', node_path: ['doc1', 'body', 'para1'] },
                { body: 'Node comment' }
            );

            const comment = service.getComment(commentId);
            expect(comment).toBeTruthy();
            expect(comment.anchor_type).toBe('node');
            expect(comment.anchor_path).toEqual(['doc1', 'body', 'para1']);

            const addedEvent = mockBus.events.find(e => e.name === 'ANNOTATION_COMMENT_ADDED');
            expect(addedEvent.payload.anchor.type).toBe('node');
        });

        it('creates a comment with document anchor', () => {
            const commentId = service.addComment(
                { type: 'document' },
                { body: 'Doc-level note' }
            );

            const comment = service.getComment(commentId);
            expect(comment).toBeTruthy();
            expect(comment.anchor_type).toBe('document');
        });

        it('throws when text anchor is missing required fields', () => {
            expect(() => service.addComment(
                { type: 'text', path: ['para1', 'content'] },
                { body: 'test' }
            )).toThrow('path, start_offset, end_offset required');
        });

        it('throws when node anchor is missing node_path', () => {
            expect(() => service.addComment(
                { type: 'node' },
                { body: 'test' }
            )).toThrow('node_path required for node anchor');
        });

        it('publishes MENTION_DETECTED when body contains @mentions', () => {
            service.addComment(
                { type: 'text', path: ['para2', 'content'], start_offset: 0, end_offset: 5 },
                { body: 'CC @user:alice and @team:editors pls review' }
            );

            const mentionEvent = mockBus.events.find(e => e.name === 'MENTION_DETECTED');
            expect(mentionEvent).toBeTruthy();
            expect(mentionEvent.payload.mentions).toHaveLength(2);
            expect(mentionEvent.payload.mentions[0].type).toBe('user');
            expect(mentionEvent.payload.mentions[0].id).toBe('alice');
            expect(mentionEvent.payload.mentions[1].type).toBe('team');
            expect(mentionEvent.payload.mentions[1].id).toBe('editors');
            expect(mentionEvent.payload.source).toBe('annotation_comment');
        });

        it('does not publish MENTION_DETECTED when body has no mentions', () => {
            mockBus.events.length = 0;
            service.addComment(
                { type: 'text', path: ['para1', 'content'], start_offset: 0, end_offset: 5 },
                { body: 'Just a regular comment' }
            );

            const mentionEvent = mockBus.events.find(e => e.name === 'MENTION_DETECTED');
            expect(mentionEvent).toBeFalsy();
        });

        it('defaults body to empty string', () => {
            const commentId = service.addComment(
                { type: 'document' }
            );

            const comment = service.getComment(commentId);
            expect(comment.payload.body).toBe('');
        });

        it('allows custom author override', () => {
            const commentId = service.addComment(
                { type: 'document' },
                { body: 'test', author: { id: 'custom-user', name: 'Custom' } }
            );

            const comment = service.getComment(commentId);
            expect(comment.payload.author.id).toBe('custom-user');
        });
    });

    // ===================================================================
    // getComments / getComment / getStats
    // ===================================================================

    describe('queries', () => {
        beforeEach(() => {
            service.addComment(
                { type: 'text', path: ['para1', 'content'], start_offset: 0, end_offset: 5 },
                { body: 'First comment', assigned_to: { id: 'user-2', name: 'User 2' } }
            );
            service.addComment(
                { type: 'text', path: ['para1', 'content'], start_offset: 6, end_offset: 11 },
                { body: 'Second note', assigned_to: { id: 'user-1', name: 'User 1' } }
            );
            service.addComment(
                { type: 'document' },
                { body: 'Document note' }
            );
        });

        it('getComments returns all comments sorted by created_at desc', () => {
            const comments = service.getComments();
            expect(comments).toHaveLength(3);
            expect(comments[0].payload.created_at).toBeGreaterThanOrEqual(comments[1].payload.created_at);
        });

        it('getComments filters by status', () => {
            const allComments = service.getComments();
            const firstId = allComments[0].id;
            service.resolveComment(firstId);

            const resolved = service.getComments({ status: 'resolved' });
            expect(resolved).toHaveLength(1);
            expect(resolved[0].id).toBe(firstId);

            const open = service.getComments({ status: 'open' });
            expect(open).toHaveLength(2);
        });

        it('getComments filters by anchor_type', () => {
            const docComments = service.getComments({ anchor_type: 'document' });
            expect(docComments).toHaveLength(1);
            expect(docComments[0].anchor_type).toBe('document');

            const textComments = service.getComments({ anchor_type: 'text' });
            expect(textComments).toHaveLength(2);
        });

        it('getComments filters by author_id', () => {
            const mine = service.getComments({ author_id: 'user-1' });
            expect(mine).toHaveLength(3); // All created by user-1 (current user)
        });

        it('getComments filters by assigned_to', () => {
            const assigned = service.getComments({ assigned_to: 'user-1' });
            expect(assigned).toHaveLength(1);
            expect(assigned[0].payload.assigned_to.id).toBe('user-1');
        });

        it('getComments filters by search (case-insensitive)', () => {
            const results = service.getComments({ search: 'first' });
            expect(results).toHaveLength(1);
            expect(results[0].payload.body).toBe('First comment');
        });

        it('getComment returns null for missing ID', () => {
            expect(service.getComment('nonexistent')).toBeNull();
        });

        it('getComment returns null when node is not annotation_comment', () => {
            expect(service.getComment('para1')).toBeNull();
        });

        it('getStats returns accurate counts', () => {
            const stats = service.getStats();
            expect(stats.total).toBe(3);
            expect(stats.open).toBe(3);
            expect(stats.resolved).toBe(0);
            expect(stats.reopened).toBe(0);
            expect(stats.assignedToMe).toBe(1); // One assigned to user-1
        });

        it('getComments returns empty array when no session', () => {
            const s = new AnnotationCommentService(mockBus, null);
            expect(s.getComments()).toEqual([]);
        });

        it('getComment returns null when no session', () => {
            const s = new AnnotationCommentService(mockBus, null);
            expect(s.getComment('any')).toBeNull();
        });
    });

    // ===================================================================
    // editComment
    // ===================================================================

    describe('editComment', () => {
        it('updates body and sets edited_at', () => {
            const commentId = service.addComment(
                { type: 'document' },
                { body: 'Original' }
            );

            mockBus.events.length = 0;
            service.editComment(commentId, 'Updated body');

            const comment = service.getComment(commentId);
            expect(comment.payload.body).toBe('Updated body');
            expect(comment.payload.edited_at).toBeGreaterThan(0);

            const updateEvent = mockBus.events.find(e => e.name === 'ANNOTATION_COMMENT_UPDATED');
            expect(updateEvent).toBeTruthy();
            expect(updateEvent.payload.commentId).toBe(commentId);
            expect(updateEvent.payload.payload.body).toBe('Updated body');
        });

        it('throws when comment not found', () => {
            expect(() => service.editComment('nonexistent', 'body'))
                .toThrow('Comment nonexistent not found');
        });
    });

    // ===================================================================
    // resolveComment / reopenComment
    // ===================================================================

    describe('resolveComment', () => {
        it('sets status to resolved and publishes event', () => {
            const commentId = service.addComment(
                { type: 'document' },
                { body: 'To resolve' }
            );

            mockBus.events.length = 0;
            service.resolveComment(commentId);

            const comment = service.getComment(commentId);
            expect(comment.payload.status).toBe('resolved');
            expect(comment.payload.resolved_at).toBeGreaterThan(0);
            expect(comment.payload.resolved_by.id).toBe('user-1');

            const resolvedEvent = mockBus.events.find(e => e.name === 'ANNOTATION_COMMENT_RESOLVED');
            expect(resolvedEvent).toBeTruthy();
        });

        it('throws for invalid comment ID', () => {
            expect(() => service.resolveComment('nonexistent'))
                .toThrow('Comment nonexistent not found');
        });

        it('throws for invalid status value', () => {
            expect(() => service._setStatus('never-exists', 'invalid'))
                .toThrow('Invalid status: invalid');
        });
    });

    describe('reopenComment', () => {
        it('sets status to reopened and publishes event', () => {
            const commentId = service.addComment(
                { type: 'document' },
                { body: 'To reopen' }
            );
            service.resolveComment(commentId);

            mockBus.events.length = 0;
            service.reopenComment(commentId);

            const comment = service.getComment(commentId);
            expect(comment.payload.status).toBe('reopened');

            const reopenedEvent = mockBus.events.find(e => e.name === 'ANNOTATION_COMMENT_REOPENED');
            expect(reopenedEvent).toBeTruthy();
        });
    });

    // ===================================================================
    // reassignComment
    // ===================================================================

    describe('reassignComment', () => {
        it('updates assigned_to and publishes event', () => {
            const commentId = service.addComment(
                { type: 'document' },
                { body: 'Assign me' }
            );

            mockBus.events.length = 0;
            service.reassignComment(commentId, 'user-3');

            const comment = service.getComment(commentId);
            expect(comment.payload.assigned_to.id).toBe('user-3');

            const updateEvent = mockBus.events.find(e => e.name === 'ANNOTATION_COMMENT_UPDATED');
            expect(updateEvent).toBeTruthy();
            expect(updateEvent.payload.payload.assigned_to.id).toBe('user-3');
        });

        it('throws when comment not found', () => {
            expect(() => service.reassignComment('nonexistent', 'user-3'))
                .toThrow('Comment nonexistent not found');
        });
    });

    // ===================================================================
    // deleteComment
    // ===================================================================

    describe('deleteComment', () => {
        it('deletes the comment node and publishes event', () => {
            const commentId = service.addComment(
                { type: 'document' },
                { body: 'To delete' }
            );

            mockBus.events.length = 0;
            service.deleteComment(commentId);

            expect(service.getComment(commentId)).toBeNull();

            const updateEvent = mockBus.events.find(e => e.name === 'ANNOTATION_COMMENT_UPDATED');
            expect(updateEvent).toBeTruthy();
            expect(updateEvent.payload.deleted).toBe(true);
            expect(updateEvent.payload.commentId).toBe(commentId);
        });

        it('deletes a text-anchored comment and removes annotation refs', () => {
            const commentId = service.addComment(
                { type: 'text', path: ['para1', 'content'], start_offset: 0, end_offset: 5 },
                { body: 'Text comment' }
            );

            // Verify it was added to the annotation array
            const contentBefore = session.get(['para1', 'content']);
            expect(contentBefore.annotations.some(a => a.node_id === commentId)).toBe(true);

            mockBus.events.length = 0;
            service.deleteComment(commentId);

            expect(service.getComment(commentId)).toBeNull();

            // Verify annotation ref was removed from the property
            const contentAfter = session.get(['para1', 'content']);
            expect(contentAfter.annotations.some(a => a.node_id === commentId)).toBe(false);
        });

        it('throws when comment not found', () => {
            expect(() => service.deleteComment('nonexistent'))
                .toThrow('Comment nonexistent not found');
        });
    });

    // ===================================================================
    // Session not available
    // ===================================================================

    describe('session not available', () => {
        it('addComment throws when session is null', () => {
            const s = new AnnotationCommentService(mockBus, null);
            expect(() => s.addComment({ type: 'document' }, { body: 'test' }))
                .toThrow('Session not available');
        });

        it('getComments returns empty array when session is null', () => {
            const s = new AnnotationCommentService(mockBus, null);
            expect(s.getComments()).toEqual([]);
        });
    });
});
