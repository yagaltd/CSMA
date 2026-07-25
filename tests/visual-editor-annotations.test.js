/**
 * Visual Editor — Annotation Ops Tests
 *
 * Tests for text-level, node-level, and document-level annotation operations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    defineDocumentSchema,
    createDocument
} from '../src/modules/visual-editor/index.js';
import Transaction from '../src/modules/visual-editor/engine/Transaction.js';
import {
    addAnnotation,
    removeAnnotation,
    addNodeAnnotation,
    addDocumentAnnotation
} from '../src/modules/visual-editor/engine/AnnotationOps.js';

// ===========================================================================
// Test helpers
// ===========================================================================

let _idCounter = 0;

function resetIdCounter() { _idCounter = 0; }
function generateId() { return `gen_${_idCounter++}`; }

const testSchema = defineDocumentSchema({
    page: {
        kind: 'document',
        properties: {
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
            content: { type: 'text' }
        }
    },
    comment: {
        kind: 'annotation',
        properties: {}
    },
    annotation_comment: {
        kind: 'annotation',
        properties: {
            anchor_type: { type: 'string', default: 'text' },
            anchor_path: { type: 'array', nullable: true, default: null },
            payload: { type: 'object', default: {} }
        }
    }
});

function makeTestDoc() {
    return createDocument('page_1', {
        page_1: {
            id: 'page_1',
            type: 'page',
            body: { nodes: ['p1'], marks: [], annotations: [] }
        },
        p1: {
            id: 'p1',
            type: 'paragraph',
            content: { content: 'hello world', marks: [], annotations: [] }
        }
    }, testSchema);
}

function makeTransaction(doc, selection = null) {
    return new Transaction(testSchema, doc, selection, { generate_id: generateId });
}

// ===========================================================================
// addAnnotation — text-level
// ===========================================================================

describe('addAnnotation (text-level)', () => {
    beforeEach(() => {
        resetIdCounter();
    });

    it('creates an annotation with payload', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        addAnnotation(tr, ['p1', 'content'], 0, 5, 'annotation_comment', {
            body: 'test comment',
            author: { name: 'alice' }
        });

        // Annotation node should exist in the draft
        const annNode = tr.doc.nodes['gen_0'];
        expect(annNode).toBeDefined();
        expect(annNode.type).toBe('annotation_comment');
        expect(annNode.anchor_type).toBe('text');
        expect(annNode.payload).toEqual({ body: 'test comment', author: { name: 'alice' } });

        // Content should have the annotation reference
        const content = tr.get(['p1', 'content']);
        expect(content.annotations).toHaveLength(1);
        expect(content.annotations[0]).toEqual({
            start_offset: 0,
            end_offset: 5,
            node_id: 'gen_0'
        });
    });

    it('backward compat: annotation without payload uses old-style create', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        addAnnotation(tr, ['p1', 'content'], 0, 5, 'comment');

        const annNode = tr.doc.nodes['gen_0'];
        expect(annNode).toBeDefined();
        expect(annNode.type).toBe('comment');
        // Should NOT have anchor_type or payload (old-style creation)
        expect(annNode.anchor_type).toBeUndefined();
        expect(annNode.payload).toBeUndefined();

        const content = tr.get(['p1', 'content']);
        expect(content.annotations).toHaveLength(1);
        expect(content.annotations[0].node_id).toBe('gen_0');
    });

    it('does nothing when start_offset >= end_offset', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        addAnnotation(tr, ['p1', 'content'], 5, 5, 'comment');

        // No node should have been created
        expect(tr.doc.nodes['gen_0']).toBeUndefined();

        const content = tr.get(['p1', 'content']);
        expect(content.annotations).toHaveLength(0);
    });
});

// ===========================================================================
// removeAnnotation
// ===========================================================================

describe('removeAnnotation', () => {
    beforeEach(() => {
        resetIdCounter();
    });

    it('removes annotation from property and deletes the node', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        // First add an annotation
        addAnnotation(tr, ['p1', 'content'], 0, 5, 'annotation_comment', { body: 'test' });
        const annId = 'gen_0';

        // Confirm it exists
        expect(tr.doc.nodes[annId]).toBeDefined();
        expect(tr.get(['p1', 'content']).annotations).toHaveLength(1);

        // Remove it
        removeAnnotation(tr, ['p1', 'content'], annId);

        // Annotation reference should be gone
        expect(tr.get(['p1', 'content']).annotations).toHaveLength(0);

        // Annotation node should be deleted
        expect(tr.doc.nodes[annId]).toBeUndefined();
    });

    it('removeAnnotation with null path (document-level) deletes node without path access', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        // Create a document-level annotation
        addDocumentAnnotation(tr, 'annotation_comment', { body: 'doc comment' });
        const annId = 'gen_0';

        expect(tr.doc.nodes[annId]).toBeDefined();

        // Remove with null path — should not throw
        expect(() => {
            removeAnnotation(tr, null, annId);
        }).not.toThrow();

        // Node should be deleted
        expect(tr.doc.nodes[annId]).toBeUndefined();
    });

    it('is a no-op when annotation is not found in property', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        // Path exists but annotation ID doesn't match
        expect(() => {
            removeAnnotation(tr, ['p1', 'content'], 'nonexistent');
        }).not.toThrow();

        // Content should be unchanged
        const content = tr.get(['p1', 'content']);
        expect(content.annotations).toHaveLength(0);
    });
});

// ===========================================================================
// addNodeAnnotation
// ===========================================================================

describe('addNodeAnnotation', () => {
    beforeEach(() => {
        resetIdCounter();
    });

    it('creates node-level annotation with correct offsets', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        // p1 is at index 0 in body.nodes
        addNodeAnnotation(tr, ['page_1', 'body', 'p1'], 'annotation_comment', {
            body: 'node comment',
            author: { name: 'bob' }
        });

        // Annotation node should exist with correct properties
        const annNode = tr.doc.nodes['gen_0'];
        expect(annNode).toBeDefined();
        expect(annNode.type).toBe('annotation_comment');
        expect(annNode.anchor_type).toBe('node');
        expect(annNode.anchor_path).toEqual(['page_1', 'body', 'p1']);
        expect(annNode.payload).toEqual({ body: 'node comment', author: { name: 'bob' } });

        // Parent node_array should have the annotation
        const body = tr.get(['page_1', 'body']);
        expect(body.annotations).toHaveLength(1);
        expect(body.annotations[0]).toEqual({
            start_offset: 0,  // p1 is at index 0
            end_offset: 1,
            node_id: 'gen_0'
        });
    });

    it('returns early when parent has no nodes array', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        // Path that doesn't point to a node_array
        addNodeAnnotation(tr, ['p1', 'content', 'nonexistent'], 'annotation_comment');

        // No node created
        expect(tr.doc.nodes['gen_0']).toBeUndefined();
    });

    it('returns early when node not found in parent', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        // p1 exists, but not in page_1's body (actually p1 IS in body)
        // Use a node ID that doesn't exist in the array
        addNodeAnnotation(tr, ['page_1', 'body', 'p99'], 'annotation_comment');

        expect(tr.doc.nodes['gen_0']).toBeUndefined();
    });

    it('returns early for too-short path', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        addNodeAnnotation(tr, ['page_1'], 'annotation_comment');
        expect(tr.doc.nodes['gen_0']).toBeUndefined();

        addNodeAnnotation(tr, [], 'annotation_comment');
        expect(tr.doc.nodes['gen_0']).toBeUndefined();

        addNodeAnnotation(tr, null, 'annotation_comment');
        expect(tr.doc.nodes['gen_0']).toBeUndefined();
    });
});

// ===========================================================================
// addDocumentAnnotation
// ===========================================================================

describe('addDocumentAnnotation', () => {
    beforeEach(() => {
        resetIdCounter();
    });

    it('creates document-level annotation with no property reference', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        addDocumentAnnotation(tr, 'annotation_comment', { body: 'global note' });

        const annNode = tr.doc.nodes['gen_0'];
        expect(annNode).toBeDefined();
        expect(annNode.type).toBe('annotation_comment');
        expect(annNode.anchor_type).toBe('document');
        expect(annNode.anchor_path).toBe(null);
        expect(annNode.payload).toEqual({ body: 'global note' });
    });

    it('works without payload', () => {
        const doc = makeTestDoc();
        const tr = makeTransaction(doc);

        addDocumentAnnotation(tr, 'annotation_comment');

        const annNode = tr.doc.nodes['gen_0'];
        expect(annNode).toBeDefined();
        expect(annNode.anchor_type).toBe('document');
        // payload defaults to {} via schema default
        expect(annNode.payload).toEqual({});
    });
});
