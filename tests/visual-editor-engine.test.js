/**
 * Visual Editor Engine Tests
 *
 * Tests for the pure-JS (DOM-free) visual-editor engine: schema validation,
 * document model, node validation, text operations, transactions, transforms,
 * mark operations, selection model, and session undo/redo.
 *
 * All imports are from src/modules/visual-editor/ — no browser needed.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Schema
import {
    defineDocumentSchema,
    validateDocumentSchema,
    isPrimitiveType,
    getDefaultNodeType
} from '../src/modules/visual-editor/engine/DocumentSchema.js';

// Document model
import {
    createDocument,
    validateDocument,
    docGet,
    docInspect,
    docPropertyType,
    docKind
} from '../src/modules/visual-editor/engine/DocumentModel.js';

// Node validation
import {
    validateNode,
    isIdValid,
    validateConfigComponents
} from '../src/modules/visual-editor/engine/NodeValidator.js';

// Text operations
import {
    splitText,
    joinText,
    charSlice,
    getCharLength,
    adjustRangesForDeletion,
    adjustRangesForInsertion,
    areRangesExclusive
} from '../src/modules/visual-editor/engine/TextOperations.js';

// Transaction engine
import Transaction from '../src/modules/visual-editor/engine/Transaction.js';
import { createDocumentDraft, applyOpToDraft } from '../src/modules/visual-editor/engine/TransactionOps.js';

// Transforms
import {
    setProperties,
    breakTextNode,
    joinTextNode,
    insertDefaultNode
} from '../src/modules/visual-editor/engine/Transforms.js';

// Mark/annotation ops
import { toggleMark, addMark, removeMark } from '../src/modules/visual-editor/engine/MarkOps.js';

// Selection model
import {
    SELECTION_TYPES,
    validateSelection,
    getSelectionRange,
    isSelectionCollapsed,
    serializePath,
    isPathStringSegmentValid,
    createCursor,
    createTextSelection,
    createNodeSelection,
    createPropertySelection
} from '../src/modules/visual-editor/engine/SelectionModel.js';

import {
    getSelectedMarks,
    getSelectedAnnotations,
    getSelectedRangeTypes,
    canSwitchMarkType
} from '../src/modules/visual-editor/engine/SelectionUtils.js';

// Session
import { EditorSessionService } from '../src/modules/visual-editor/services/EditorSessionService.js';

// Document defaults
import {
    getPropertyDefault,
    fillNodeDefaults,
    fillDocumentDefaults
} from '../src/modules/visual-editor/engine/DocumentDefaults.js';

// ===========================================================================
// Test helpers
// ===========================================================================

/**
 * Build the test schema used across all engine tests.
 */
function makeTestSchema() {
    return defineDocumentSchema({
        doc: {
            kind: 'document',
            properties: {
                title: { type: 'string', default: '' },
                body: {
                    type: 'node_array',
                    node_types: ['paragraph', 'image', 'link', 'ref_holder'],
                    default_node_type: 'paragraph'
                }
            }
        },
        paragraph: {
            kind: 'text',
            properties: {
                content: {
                    type: 'text',
                    mark_types: ['bold', 'italic'],
                    annotation_types: ['comment']
                }
            }
        },
        image: {
            kind: 'block',
            properties: {
                src: { type: 'string', default: '' },
                alt: { type: 'string', default: '' }
            }
        },
        link: {
            kind: 'block',
            properties: {
                href: { type: 'string', default: '' },
                label: { type: 'string', default: '' }
            }
        },
        ref_holder: {
            kind: 'block',
            properties: {
                target: { type: 'node', node_types: ['paragraph'] }
            }
        },
        bold: {
            kind: 'mark',
            properties: {}
        },
        italic: {
            kind: 'mark',
            properties: {}
        },
        comment: {
            kind: 'annotation',
            properties: {
                body: { type: 'string', default: '' }
            }
        }
    });
}

const SCHEMA = makeTestSchema();

/**
 * Build a minimal valid document: one doc node + one paragraph in body.
 */
function makeMinimalDoc() {
    return {
        document_id: 'doc1',
        nodes: {
            doc1: {
                id: 'doc1',
                type: 'doc',
                title: 'Hello',
                body: {
                    nodes: ['para1'],
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
            }
        }
    };
}

/**
 * Build a doc with two paragraphs in body (for join/split transforms).
 */
function makeTwoParagraphDoc() {
    return {
        document_id: 'doc1',
        nodes: {
            doc1: {
                id: 'doc1',
                type: 'doc',
                title: 'Two paras',
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
                    content: 'First paragraph',
                    marks: [],
                    annotations: []
                }
            },
            para2: {
                id: 'para2',
                type: 'paragraph',
                content: {
                    content: 'Second paragraph',
                    marks: [],
                    annotations: []
                }
            }
        }
    };
}

/**
 * Deterministic ID generator for transactions.
 */
let _idCounter = 0;
function resetIdCounter() { _idCounter = 0; }
function generateId() { return `gen_${_idCounter++}`; }

/**
 * Create a transaction from a doc with deterministic IDs.
 * selection: null or a valid selection object.
 */
function makeTransaction(doc, selection = null) {
    return new Transaction(SCHEMA, doc, selection, { generate_id: generateId });
}

/**
 * Minimal mock EventBus for EditorSessionService.
 */
function makeMockEventBus() {
    return {
        publish() {},
        subscribe() { return () => {}; }
    };
}

// ===========================================================================
// 1. Schema validation
// ===========================================================================

describe('Schema validation', () => {
    it('accepts a well-formed schema', () => {
        expect(() => validateDocumentSchema(SCHEMA)).not.toThrow();
    });

    it('rejects a schema with unknown referenced node type', () => {
        const bad = defineDocumentSchema({
            doc: {
                kind: 'document',
                properties: {
                    body: {
                        type: 'node_array',
                        node_types: ['nonexistent'],
                        default_node_type: 'nonexistent'
                    }
                }
            }
        });
        expect(() => validateDocumentSchema(bad))
            .toThrow(/unknown node type "nonexistent"/i);
    });

    it('rejects a text node without "content" property', () => {
        const bad = defineDocumentSchema({
            text_node: {
                kind: 'text',
                properties: {
                    other: { type: 'string' }
                }
            }
        });
        expect(() => validateDocumentSchema(bad))
            .toThrow(/must define a "content" property of type text/i);
    });

    it('rejects a text node with multiple text properties', () => {
        const bad = defineDocumentSchema({
            text_node: {
                kind: 'text',
                properties: {
                    content: { type: 'text' },
                    body: { type: 'text' }
                }
            }
        });
        expect(() => validateDocumentSchema(bad))
            .toThrow(/must not define multiple text properties/i);
    });

    it('rejects an invalid node kind', () => {
        const bad = defineDocumentSchema({
            weird: {
                kind: 'garbage',
                properties: {}
            }
        });
        expect(() => validateDocumentSchema(bad))
            .toThrow(/invalid kind "garbage"/i);
    });
});

// ===========================================================================
// 2. Document validation
// ===========================================================================

describe('Document validation', () => {
    it('accepts a well-formed document', () => {
        const doc = makeMinimalDoc();
        expect(() => validateDocument(doc, SCHEMA)).not.toThrow();
    });

    it('rejects a document where node key does not match node.id', () => {
        const doc = {
            document_id: 'doc1',
            nodes: {
                doc1: { id: 'wrong_id', type: 'doc', title: '', body: { nodes: [], marks: [], annotations: [] } }
            }
        };
        expect(() => validateDocument(doc, SCHEMA))
            .toThrow(/does not match node\.id/i);
    });
    it('rejects a property with wrong type', () => {
        const doc = {
            document_id: 'doc1',
            nodes: {
                doc1: {
                    id: 'doc1',
                    type: 'paragraph',
                    // content must be an object, not a string
                    content: 'just a string'
                }
            }
        };
        expect(() => validateDocument(doc, SCHEMA))
            .toThrow(/must be an object/i);
    });

    it('rejects a reference to a non-existent node', () => {
        const doc = {
            document_id: 'doc1',
            nodes: {
                doc1: {
                    id: 'doc1',
                    type: 'doc',
                    title: '',
                    body: { nodes: ['missing_node'], marks: [], annotations: [] }
                }
            }
        };
        expect(() => validateDocument(doc, SCHEMA))
            .toThrow(/non-existent node "missing_node"/i);
    });

    it('rejects a document with a self-referencing cycle', () => {
        // A node that references itself is a cycle.
        const cycleSchema = defineDocumentSchema({
            self_ref: {
                kind: 'block',
                properties: {
                    child: { type: 'node', node_types: ['self_ref'] }
                }
            }
        });
        const doc = {
            document_id: 'a',
            nodes: {
                a: { id: 'a', type: 'self_ref', child: 'a' }
            }
        };
        expect(() => validateDocument(doc, cycleSchema))
            .toThrow(/cyclic reference/i);
    });
});

// ===========================================================================
// 3. Document model — docGet / docInspect
// ===========================================================================

describe('Document model', () => {
    const doc = makeMinimalDoc();

    it('docGet resolves a node by string ID', () => {
        const node = docGet(SCHEMA, doc, 'para1');
        expect(node.id).toBe('para1');
        expect(node.type).toBe('paragraph');
    });

    it('docGet resolves a nested property path', () => {
        const content = docGet(SCHEMA, doc, ['para1', 'content', 'content']);
        expect(content).toBe('Hello world');
    });

    it('docGet resolves array indices through node_array path', () => {
        const node = docGet(SCHEMA, doc, ['doc1', 'body', 0]);
        expect(node.id).toBe('para1');
    });

    it('docInspect returns correct kind and metadata', () => {
        const info = docInspect(SCHEMA, doc, ['para1', 'content']);
        expect(info.kind).toBe('property');
        expect(info.type).toBe('text');
        expect(info.mark_types).toContain('bold');
        expect(info.annotation_types).toContain('comment');
    });

    it('docInspect on a node_array element returns node metadata', () => {
        const info = docInspect(SCHEMA, doc, ['doc1', 'body', 0]);
        expect(info.kind).toBe('node');
        expect(info.type).toBe('paragraph');
    });
});

// ===========================================================================
// 4. Node validation
// ===========================================================================

describe('Node validation', () => {
    beforeEach(() => { resetIdCounter(); });

    it('accepts a valid node', () => {
        const doc = makeMinimalDoc();
        expect(() => validateNode(doc.nodes.para1, SCHEMA, doc.nodes))
            .not.toThrow();
    });

    it('rejects a node with an invalid ID (starts with number)', () => {
        const bad = { id: '123bad', type: 'paragraph', content: { content: '', marks: [], annotations: [] } };
        expect(() => validateNode(bad, SCHEMA, {}))
            .toThrow(/invalid node id/i);
    });

    it('rejects a node ID containing "__"', () => {
        const bad = { id: 'foo__bar', type: 'paragraph', content: { content: '', marks: [], annotations: [] } };
        expect(() => validateNode(bad, SCHEMA, {}))
            .toThrow(/invalid node id/i);
    });

    it('rejects marks with overlapping ranges sharing the same node_id', () => {
        const node = {
            id: 'para_overlap',
            type: 'paragraph',
            content: {
                content: 'abcdef',
                marks: [
                    { start_offset: 0, end_offset: 4, node_id: 'm1' },
                    { start_offset: 2, end_offset: 6, node_id: 'm1' }  // overlaps with first
                ],
                annotations: []
            }
        };
        // Need both mark nodes to exist for full validation
        const nodes = {
            para_overlap: node,
            m1: { id: 'm1', type: 'bold' }
        };
        expect(() => validateNode(node, SCHEMA, nodes))
            .toThrow(/overlapping marks/i);
    });

    it('requireReferences: false skips reference existence checks', () => {
        const node = {
            id: 'para_ref',
            type: 'paragraph',
            content: {
                content: 'test',
                marks: [
                    { start_offset: 0, end_offset: 4, node_id: 'nonexistent_mark' }
                ],
                annotations: []
            }
        };
        // With require_references: false, missing mark node should not fail
        expect(() => validateNode(node, SCHEMA, {}, { require_references: false }))
            .not.toThrow();
        // With require_references: true, it should fail
        // (But marks don't trigger reference validation in the same way as node properties...)
        // The reference check applies to node/node_array types, not mark ranges.
    });
});

// ===========================================================================
// 5. Text operations
// ===========================================================================

describe('Text operations', () => {
    const textVal = (content, marks = [], annotations = []) =>
        ({ content, marks, annotations });

    it('splitText at position 0 creates an empty left half', () => {
        const [left, right] = splitText(textVal('hello'), 0);
        expect(left.content).toBe('');
        expect(right.content).toBe('hello');
    });

    it('splitText at middle produces correct halves with adjusted marks', () => {
        const val = textVal('abcdef', [
            { start_offset: 0, end_offset: 6, node_id: 'm1' }
        ]);
        const [left, right] = splitText(val, 3);
        expect(left.content).toBe('abc');
        expect(right.content).toBe('def');
        // Left mark covers 'abc'
        expect(left.marks).toEqual([{ start_offset: 0, end_offset: 3, node_id: 'm1' }]);
        // Right mark covers 'def' — offset shifted back to 0
        expect(right.marks).toEqual([{ start_offset: 0, end_offset: 3, node_id: 'm1' }]);
    });

    it('joinText concatenates content and shifts marks', () => {
        const left = textVal('abc', [
            { start_offset: 0, end_offset: 3, node_id: 'm1' }
        ]);
        const right = textVal('def', [
            { start_offset: 0, end_offset: 3, node_id: 'm1' }
        ]);
        const joined = joinText(left, right);
        expect(joined.content).toBe('abcdef');
        // The first mark (0..3) stays the same; second mark shifts by 3
        expect(joined.marks).toEqual([
            { start_offset: 0, end_offset: 3, node_id: 'm1' },
            { start_offset: 3, end_offset: 6, node_id: 'm1' }
        ]);
    });

    it('charSlice adjusts mark offsets correctly', () => {
        const val = textVal('hello world', [
            { start_offset: 0, end_offset: 11, node_id: 'm1' }
        ]);
        const sliced = charSlice(val, 6, 11); // 'world'
        expect(sliced.content).toBe('world');
        expect(sliced.marks).toEqual([{ start_offset: 0, end_offset: 5, node_id: 'm1' }]);
    });
    it('adjustRangesForDeletion filters zero-width ranges produced by trimming', () => {
        // Delete chars 0-3, which will trim the ranges and produce a zero-width one
        const ranges = [
            { start_offset: 0, end_offset: 0 },   // already zero-width
            { start_offset: 2, end_offset: 5 },
            { start_offset: 5, end_offset: 5 }     // already zero-width
        ];
        const adjusted = adjustRangesForDeletion(ranges, 0, 3);
        // range 0-0: end_offset(0) <= pos(0) → kept as 0-0 → filtered as zero-width
        // range 2-5: overlaps deletion at 0-3 → after trimming: new_start=0, new_end=2
        // range 5-5: end_offset(5) > pos(0), start_offset(5) >= pos+length(3) → shifted to 2-2 → filtered
        expect(adjusted.length).toBe(1);
        expect(adjusted[0].start_offset).toBe(0);
        expect(adjusted[0].end_offset).toBe(2);
    });
});

// ===========================================================================
// 6. Transaction — create
// ===========================================================================

describe('Transaction — create', () => {
    beforeEach(() => { resetIdCounter(); });

    it('creates a node in the draft and records the op', () => {
        const doc = makeMinimalDoc();
        const tr = makeTransaction(doc);

        tr.create({
            id: 'para2',
            type: 'paragraph',
            content: { content: 'new para', marks: [], annotations: [] }
        });

        expect(tr.get('para2')).toBeDefined();
        expect(tr.get(['para2', 'content', 'content'])).toBe('new para');
        expect(tr.ops.length).toBe(1);
        expect(tr.ops[0][0]).toBe('create');
        expect(tr.created_node_ids).toContain('para2');
    });

    it('fills defaults for omitted properties', () => {
        const doc = makeMinimalDoc();
        const tr = makeTransaction(doc);

        // Create image node without providing src/alt — defaults fill them in
        tr.create({ id: 'img1', type: 'image' });

        // The node now exists and has schema-defined properties with
        // type-correct default values (string for src, alt)
        const node = tr.get('img1');
        expect(node).toHaveProperty('src');
        expect(node).toHaveProperty('alt');
        // Node must survive re-validation after creation
        expect(() => tr.validateNode(node)).not.toThrow();
    });

    it('throws on duplicate node ID', () => {
        const doc = makeMinimalDoc();
        const tr = makeTransaction(doc);

        expect(() =>
            tr.create({ id: 'doc1', type: 'image' })
        ).toThrow(/already exists/i);
    });
});

// ===========================================================================
// 7. Transaction — set
// ===========================================================================

describe('Transaction — set', () => {
    beforeEach(() => { resetIdCounter(); });

    it('sets a property in the draft and records inverse', () => {
        const doc = makeMinimalDoc();
        const tr = makeTransaction(doc);

        const newContent = {
            content: 'updated',
            marks: [],
            annotations: []
        };
        tr.set(['para1', 'content'], newContent);

        expect(tr.get(['para1', 'content', 'content'])).toBe('updated');
        // inverse_ops should restore the original content
        const inverse = tr.inverse_ops.find(op => op[0] === 'set');
        expect(inverse).toBeDefined();
        expect(inverse[2].content).toBe('Hello world');
    });

    it('tracks modified_node_ids', () => {
        const doc = makeMinimalDoc();
        const tr = makeTransaction(doc);

        tr.set(['para1', 'content'], {
            content: 'changed',
            marks: [],
            annotations: []
        });

        expect(tr.modified_node_ids).toContain('para1');
    });

    it('throws when setting a path that does not point to a property', () => {
        const doc = makeMinimalDoc();
        const tr = makeTransaction(doc);

        // ['para1'] is a node path, not a property path — inspect throws
        expect(() => tr.set(['para1'], 'some value'))
            .toThrow(/property/i);
    });
});

// ===========================================================================
// 8. Transaction — delete + cascade
// ===========================================================================

describe('Transaction — delete + cascade', () => {
    beforeEach(() => { resetIdCounter(); });

    it('deletes a node from the draft', () => {
        const doc = makeMinimalDoc();
        const tr = makeTransaction(doc);

        expect(tr.get('para1')).toBeDefined();
        tr.delete('para1');
        expect(() => tr.get('para1')).toThrow(/not found/i);
        expect(tr.deleted_node_ids).toContain('para1');
    });

    it('cascade-deletes unreferenced nodes when a referencing node is removed', () => {
        // Build a doc where ref_holder holds the only reference to para_orphan.
        const doc = {
            document_id: 'doc1',
            nodes: {
                doc1: {
                    id: 'doc1',
                    type: 'doc',
                    title: '',
                    body: {
                        nodes: ['holder'],
                        marks: [],
                        annotations: []
                    }
                },
                holder: {
                    id: 'holder',
                    type: 'ref_holder',
                    target: 'para_orphan'
                },
                para_orphan: {
                    id: 'para_orphan',
                    type: 'paragraph',
                    content: {
                        content: 'I should disappear',
                        marks: [],
                        annotations: []
                    }
                }
            }
        };

        const tr = makeTransaction(doc);
        tr.delete('holder');

        // The ref_holder is gone
        expect(() => tr.get('holder')).toThrow(/not found/i);

        // The orphaned paragraph should be cascade-deleted
        expect(() => tr.get('para_orphan')).toThrow(/not found/i);
    });

    it('no-ops when deleting a non-existent node ID', () => {
        const doc = makeMinimalDoc();
        const tr = makeTransaction(doc);

        // Should not throw
        expect(() => tr.delete('nonexistent')).not.toThrow();
        expect(tr.ops.length).toBe(0);
    });
});

// ===========================================================================
// 9. Transaction — build
// ===========================================================================

describe('Transaction — build', () => {
    beforeEach(() => { resetIdCounter(); });

    it('deep-clones a subgraph with new IDs', () => {
        const doc = makeTwoParagraphDoc();
        const tr = makeTransaction(doc);

        // build para1: clones para1 and its content/marks with all new IDs
        const newRootId = tr.build('para1', doc.nodes);

        expect(typeof newRootId).toBe('string');
        expect(newRootId).not.toBe('para1');

        // The clone should exist in the draft
        const clone = tr.get(newRootId);
        expect(clone.type).toBe('paragraph');
        expect(clone.content.content).toBe('First paragraph');

        // para2 should NOT have been cloned (it's not reachable from para1)
        // But wait — para1 is in doc1.body, which is a sibling reference in the node_array.
        // traverse('para1', schema, nodes) only follows forward references from para1.
        // para1 does NOT reference para2. So only para1 is cloned. Good.
    });
});

// ===========================================================================
// 10. Session — apply / undo / redo
// ===========================================================================

describe('Session — apply / undo / redo', () => {
    let session;

    beforeEach(() => {
        resetIdCounter();
        session = new EditorSessionService(makeMockEventBus());
        session.init({
            editorId: 'test-editor',
            schema: SCHEMA,
            doc: makeMinimalDoc(),
            config: { generate_id: generateId }
        });
    });

    it('apply swaps the document and updates selection', () => {
        const origDoc = session.doc;
        const tr = session.tr;

        tr.set(['para1', 'content'], {
            content: 'changed text',
            marks: [],
            annotations: []
        });
        tr.setSelection(createCursor(['para1', 'content'], 7));

        session.apply(tr);

        // Document should have changed
        expect(session.doc).not.toBe(origDoc);
        expect(session.get(['para1', 'content', 'content'])).toBe('changed text');
        // Selection should be updated
        expect(session.selection.anchor_offset).toBe(7);
    });

    it('apply pushes a history entry', () => {
        expect(session.history.length).toBe(0);
        expect(session.history_index).toBe(-1);
        expect(session.canUndo).toBe(false);

        const tr = session.tr;
        tr.set(['para1', 'content'], {
            content: 'modified',
            marks: [],
            annotations: []
        });
        session.apply(tr);

        expect(session.history.length).toBe(1);
        expect(session.history_index).toBe(0);
        expect(session.canUndo).toBe(true);
    });

    it('undo restores the previous document state', () => {
        const origContent = session.get(['para1', 'content', 'content']);

        const tr = session.tr;
        tr.set(['para1', 'content'], {
            content: 'modified',
            marks: [],
            annotations: []
        });
        session.apply(tr);

        expect(session.history_index).toBe(0);
        session.undo();

        expect(session.history_index).toBe(-1);
        expect(session.canUndo).toBe(false);
        expect(session.get(['para1', 'content', 'content'])).toBe(origContent);
    });

    it('redo restores the next state after undo', () => {
        const tr = session.tr;
        tr.set(['para1', 'content'], {
            content: 'modified',
            marks: [],
            annotations: []
        });
        session.apply(tr);
        session.undo();

        expect(session.canRedo).toBe(true);
        session.redo();

        expect(session.get(['para1', 'content', 'content'])).toBe('modified');
        expect(session.canRedo).toBe(false);
    });

    it('undo + new edit truncates future history', () => {
        // Edit 1
        const tr1 = session.tr;
        tr1.set(['para1', 'content'], {
            content: 'edit1',
            marks: [],
            annotations: []
        });
        session.apply(tr1);

        // Edit 2
        const tr2 = session.tr;
        tr2.set(['para1', 'content'], {
            content: 'edit2',
            marks: [],
            annotations: []
        });
        session.apply(tr2);

        expect(session.history.length).toBe(2);

        // Undo back to edit 1
        session.undo();
        expect(session.history_index).toBe(0);

        // New edit — this should truncate the future (edit 2)
        const tr3 = session.tr;
        tr3.set(['para1', 'content'], {
            content: 'edit3',
            marks: [],
            annotations: []
        });
        session.apply(tr3);

        expect(session.history.length).toBe(2); // edit 2 is gone
        expect(session.canRedo).toBe(false);
    });

    it('selection-only transactions do not trigger a doc swap or history entry', () => {
        const origDoc = session.doc;
        const origHistoryLen = session.history.length;

        const tr = session.tr;
        tr.setSelection(createCursor(['para1', 'content'], 5));

        // No ops — just selection change
        session.apply(tr);

        // doc should be the same object (no swap for no-op transactions)
        expect(session.doc).toBe(origDoc);
        // history should not grow for ops-free transactions
        expect(session.history.length).toBe(origHistoryLen);
        // But selection should be updated
        expect(session.selection.anchor_offset).toBe(5);
    });
});

// ===========================================================================
// 11. Transforms — breakTextNode / joinTextNode
// ===========================================================================

describe('Transforms', () => {
    beforeEach(() => { resetIdCounter(); });

    it('breakTextNode splits a paragraph at the cursor position', () => {
        const doc = makeTwoParagraphDoc();
        // Cursor in para1's content at position 6 ("First " → "paragraph")
        const selection = createCursor(['doc1', 'body', 0, 'content'], 6);
        const tr = makeTransaction(doc, selection);

        expect(tr.get(['para1', 'content', 'content'])).toBe('First paragraph');

        const result = breakTextNode(tr);
        expect(result).toBe(true);

        // para1 content should be truncated to "First "
        expect(tr.get(['para1', 'content', 'content'])).toBe('First ');

        // A new paragraph should have been created with "paragraph"
        const bodyNodes = tr.get(['doc1', 'body', 'nodes']);
        expect(bodyNodes.length).toBe(3); // was 2, now 3
        const newParaId = bodyNodes[1]; // inserted at position 1 (after para1 at index 0)
        const newPara = tr.get(newParaId);
        expect(newPara.type).toBe('paragraph');
        expect(newPara.content.content).toBe('paragraph');

        // Cursor should be at position 0 of the new paragraph
        expect(tr.selection.anchor_offset).toBe(0);
        expect(tr.selection.path).toEqual([newParaId, 'content']);
    });

    it('joinTextNode joins with the previous sibling', () => {
        const doc = makeTwoParagraphDoc();
        // Cursor at position 0 of para2's content
        const selection = createCursor(['doc1', 'body', 1, 'content'], 0);
        const tr = makeTransaction(doc, selection);

        const result = joinTextNode(tr);
        expect(result).toBe(true);

        // para1 should now contain "First paragraphSecond paragraph"
        expect(tr.get(['para1', 'content', 'content'])).toBe('First paragraphSecond paragraph');

        // para2 should be deleted
        const bodyNodes = tr.get(['doc1', 'body', 'nodes']);
        expect(bodyNodes.length).toBe(1); // was 2, now 1
        expect(bodyNodes).not.toContain('para2');

        // Cursor should be at the join point (end of original para1's content)
        expect(tr.selection.anchor_offset).toBe(15); // "First paragraph".length
    });
});

// ===========================================================================
// 12. Mark toggle
// ===========================================================================

describe('Mark toggle', () => {
    beforeEach(() => { resetIdCounter(); });

    it('toggleMark adds a mark to a collapsed text selection (extended to word)', () => {
        const doc = makeMinimalDoc();
        // Cursor at position 1 of "Hello world" → inside "Hello"
        const selection = createCursor(['para1', 'content'], 1);
        const tr = makeTransaction(doc, selection);

        toggleMark(tr, 'bold');

        // Should have created a bold mark node and added it to the content
        const content = tr.get(['para1', 'content']);
        const boldMark = content.marks.find(
            m => tr.get(m.node_id)?.type === 'bold'
        );
        expect(boldMark).toBeDefined();
        // Word expansion: cursor at 1 → "Hello" is at 0-5
        expect(boldMark.start_offset).toBe(0);
        expect(boldMark.end_offset).toBe(5);
    });

    it('toggleMark removes a mark that fully contains the selection', () => {
        const doc = makeMinimalDoc();
        // Create a doc where para1 already has a bold mark covering 0-5
        doc.nodes.para1.content = {
            content: 'Hello world',
            marks: [{ start_offset: 0, end_offset: 5, node_id: 'bold1' }],
            annotations: []
        };
        doc.nodes.bold1 = { id: 'bold1', type: 'bold' };

        // Select the full bold range
        const selection = createTextSelection(['para1', 'content'], 0, 5);
        const tr = makeTransaction(doc, selection);

        toggleMark(tr, 'bold');

        // The mark that fully contains 0-5 should be removed
        const content = tr.get(['para1', 'content']);
        const boldMarks = content.marks.filter(
            m => tr.get(m.node_id)?.type === 'bold'
        );
        expect(boldMarks.length).toBe(0);
    });
});

// ===========================================================================
// 13. Selection model
// ===========================================================================

describe('Selection model', () => {
    it('isSelectionCollapsed returns true when anchor equals focus', () => {
        const sel = createCursor(['para1', 'content'], 5);
        expect(isSelectionCollapsed(sel)).toBe(true);
    });

    it('isSelectionCollapsed returns false when anchor differs from focus', () => {
        const sel = createTextSelection(['para1', 'content'], 0, 10);
        expect(isSelectionCollapsed(sel)).toBe(false);
    });

    it('isSelectionCollapsed returns true for null selection', () => {
        expect(isSelectionCollapsed(null)).toBe(true);
    });

    it('getSelectionRange normalizes anchor/focus so start <= end', () => {
        // Focus before anchor — range should normalize
        const sel = { type: 'text', path: ['p', 'c'], anchor_offset: 10, focus_offset: 3 };
        const range = getSelectionRange(sel);
        expect(range.start_offset).toBe(3);
        expect(range.end_offset).toBe(10);
    });

    it('getSelectionRange works when anchor/focus already ordered', () => {
        const sel = createTextSelection(['p', 'c'], 1, 9);
        const range = getSelectionRange(sel);
        expect(range.start_offset).toBe(1);
        expect(range.end_offset).toBe(9);
    });

    it('createCursor creates a collapsed selection', () => {
        const sel = createCursor(['n', 'prop'], 7);
        expect(sel.type).toBe('text');
        expect(sel.anchor_offset).toBe(7);
        expect(sel.focus_offset).toBe(7);
    });

    it('serializePath joins path segments with __', () => {
        expect(serializePath(['a', 'b', 1])).toBe('a__b__1');
    });
});

// ===========================================================================
// 14. URL validation (via node validation)
// ===========================================================================

describe('URL validation', () => {
    it('rejects javascript: scheme on image.src', () => {
        const node = {
            id: 'img1',
            type: 'image',
            src: 'javascript:alert(1)',
            alt: ''
        };
        expect(() => validateNode(node, SCHEMA, {}))
            .toThrow(/disallowed url scheme "javascript:"/i);
    });

    it('allows https: and relative URLs on image.src', () => {
        const imageWithHttps = {
            id: 'img2',
            type: 'image',
            src: 'https://example.com/pic.png',
            alt: ''
        };
        expect(() => validateNode(imageWithHttps, SCHEMA, {}))
            .not.toThrow();

        const imageWithRelative = {
            id: 'img3',
            type: 'image',
            src: './images/pic.png',
            alt: ''
        };
        expect(() => validateNode(imageWithRelative, SCHEMA, {}))
            .not.toThrow();

        const imageWithRootRelative = {
            id: 'img4',
            type: 'image',
            src: '/assets/logo.svg',
            alt: ''
        };
        expect(() => validateNode(imageWithRootRelative, SCHEMA, {}))
            .not.toThrow();
    });
});
