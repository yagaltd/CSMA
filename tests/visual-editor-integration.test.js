/**
 * Visual Editor — Integration Tests
 *
 * Covers module manifest, contracts validation, EditorContentAdapter,
 * EditorSession lifecycle, and end-to-end editing smoke.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import {
    manifest,
    EditorContentAdapter,
    EditorSessionService,
    VisualEditorContracts,
    defineDocumentSchema,
    createDocument
} from '../src/modules/visual-editor/index.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Minimal valid schema for testing. */
function testSchema() {
    return defineDocumentSchema({
        page: {
            kind: 'document',
            properties: {
                body: {
                    type: 'node_array',
                    node_types: ['paragraph', 'list', 'block'],
                    mark_types: [],
                    annotation_types: [],
                    default_node_type: 'paragraph'
                }
            }
        },
        paragraph: {
            kind: 'text',
            properties: {
                content: {
                    type: 'text',
                    mark_types: ['strong', 'emphasis'],
                    annotation_types: [],
                    allow_newlines: true
                }
            }
        },
        list: {
            kind: 'block',
            properties: {
                ordered: { type: 'boolean', default: false },
                list_items: {
                    type: 'node_array',
                    node_types: ['list_item'],
                    mark_types: [],
                    annotation_types: [],
                    default_node_type: 'list_item'
                }
            }
        },
        list_item: {
            kind: 'text',
            properties: {
                content: {
                    type: 'text',
                    mark_types: ['strong', 'emphasis'],
                    annotation_types: [],
                    allow_newlines: true
                }
            }
        },
        block: {
            kind: 'block',
            properties: {
                data: { type: 'string', default: '' }
            }
        },
        strong: { kind: 'mark', properties: {} },
        emphasis: { kind: 'mark', properties: {} }
    });
}

/** Create a minimal valid document with the given schema. */
function testDoc(schema, paragraphText = 'Hello world') {
    const pId = 'para_1';
    const doc = createDocument('page_1', {
        page_1: {
            id: 'page_1',
            type: 'page',
            body: { nodes: [pId], marks: [], annotations: [] }
        },
        [pId]: {
            id: pId,
            type: 'paragraph',
            content: { content: paragraphText, marks: [], annotations: [] }
        }
    }, schema);
    return doc;
}

// ---------------------------------------------------------------------------
// 1. Module manifest
// ---------------------------------------------------------------------------

describe('Module manifest', () => {
    it('has correct module id', () => {
        expect(manifest.id).toBe('visual-editor');
    });

    it('lists editorSession as a service', () => {
        expect(manifest.services).toContain('editorSession');
    });

    it('has non-empty contracts including INTENT_EDITOR_INIT', () => {
        expect(manifest.contracts.length).toBeGreaterThan(0);
        expect(manifest.contracts).toContain('INTENT_EDITOR_INIT');
    });
});

// ---------------------------------------------------------------------------
// 2. Contracts validation
// ---------------------------------------------------------------------------

describe('Contracts validation', () => {
    it('INTENT_EDITOR_INIT requires editorId', () => {
        const schema = VisualEditorContracts.INTENT_EDITOR_INIT.schema;
        const [err] = schema.validate({});
        expect(err).toBeTruthy();

        const [err2] = schema.validate({ editorId: 'ed1' });
        // Still fails — needs schema and doc too
        expect(err2).toBeTruthy();

        // All fields present with schema + doc passes
        const [err3] = schema.validate({
            editorId: 'ed1',
            schema: testSchema(),
            doc: testDoc(testSchema())
        });
        expect(err3).toBeFalsy();
    });

    it('INTENT_EDITOR_COMMAND requires editorId and command', () => {
        const schema = VisualEditorContracts.INTENT_EDITOR_COMMAND.schema;
        const [err] = schema.validate({});
        expect(err).toBeTruthy();

        const [err2] = schema.validate({ editorId: 'ed1' });
        expect(err2).toBeTruthy();

        const [err3] = schema.validate({ editorId: 'ed1', command: 'undo' });
        expect(err3).toBeFalsy();
    });

    it('invalid payload fails validation', () => {
        const schema = VisualEditorContracts.INTENT_EDITOR_INIT.schema;
        const [err] = schema.validate({ editorId: 42, schema: 'not-object', doc: null });
        expect(err).toBeTruthy();

        const [err2] = schema.validate(null);
        expect(err2).toBeTruthy();

        const [err3] = schema.validate(undefined);
        expect(err3).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// 3. EditorContentAdapter
// ---------------------------------------------------------------------------

describe('EditorContentAdapter', () => {
    it('blocksToDocument converts basic blocks', () => {
        const doc = EditorContentAdapter.blocksToDocument([
            { type: 'paragraph', content: 'First paragraph' },
            { type: 'heading', level: 1, content: 'Title' },
            { type: 'image', src: 'pic.png', alt: 'A picture' }
        ]);

        expect(doc).toBeTruthy();
        expect(doc.document_id).toBe('page_1');
        expect(doc.nodes).toBeTruthy();

        const pageNode = doc.nodes.page_1;
        expect(pageNode.type).toBe('page');
        expect(pageNode.body.nodes.length).toBe(3);

        // First node is paragraph
        const p1 = doc.nodes[pageNode.body.nodes[0]];
        expect(p1.type).toBe('paragraph');
        expect(p1.content.content).toBe('First paragraph');

        // Second node is heading
        const h1 = doc.nodes[pageNode.body.nodes[1]];
        expect(h1.type).toBe('heading');
        expect(h1.level).toBe(1);
        expect(h1.content.content).toBe('Title');

        // Third node is image
        const img = doc.nodes[pageNode.body.nodes[2]];
        expect(img.type).toBe('image');
        expect(img.src).toBe('pic.png');
        expect(img.alt).toBe('A picture');
    });

    it('documentToBlocks round-trips paragraph content', () => {
        const blocks = [
            { type: 'paragraph', content: 'Hello' },
            { type: 'paragraph', content: 'World' }
        ];

        const doc = EditorContentAdapter.blocksToDocument(blocks);
        const result = EditorContentAdapter.documentToBlocks(doc);

        expect(result).toHaveLength(2);
        expect(result[0].type).toBe('paragraph');
        expect(result[0].content).toBe('Hello');
        expect(result[1].type).toBe('paragraph');
        expect(result[1].content).toBe('World');
    });

    it('blocksToDocument handles list blocks with items correctly', () => {
        const doc = EditorContentAdapter.blocksToDocument([
            {
                type: 'ul',
                items: [
                    { content: 'Item A' },
                    { content: 'Item B' },
                    { content: 'Item C' }
                ]
            }
        ]);

        expect(doc).toBeTruthy();
        const pageNode = doc.nodes.page_1;
        expect(pageNode.body.nodes.length).toBe(1);

        const listId = pageNode.body.nodes[0];
        const listNode = doc.nodes[listId];
        expect(listNode.type).toBe('list');
        expect(listNode.ordered).toBe(false);
        expect(listNode.list_items.nodes).toHaveLength(3);

        // Each list item should be its own node in the nodes map
        const itemIds = listNode.list_items.nodes;
        for (const itemId of itemIds) {
            expect(doc.nodes[itemId]).toBeTruthy();
            expect(doc.nodes[itemId].type).toBe('list_item');
        }

        // Content should be preserved
        expect(doc.nodes[itemIds[0]].content.content).toBe('Item A');
        expect(doc.nodes[itemIds[1]].content.content).toBe('Item B');
        expect(doc.nodes[itemIds[2]].content.content).toBe('Item C');
    });

    it('blocksToDocument blanks disallowed image URL schemes', () => {
        const doc = EditorContentAdapter.blocksToDocument([
            { type: 'image', src: 'https://cdn.example/a.png', alt: 'ok' },
            { type: 'image', src: 'http://cdn.example/b.png' },
            { type: 'image', src: '/rel/path.png' },
            { type: 'image', src: 'data:image/png;base64,xx' },
            { type: 'image', src: 'javascript:alert(1)' },
            { type: 'image', src: 'vbscript:msgbox(1)' },
            { type: 'image', src: 'file:///etc/passwd' },
            { type: 'image', src: 'data:text/html,<script>x</script>' },
            { type: 'image', src: 'custom-scheme:payload' }
        ]);

        const pageNode = doc.nodes.page_1;
        const srcs = pageNode.body.nodes.map((id) => doc.nodes[id].src);

        expect(srcs[0]).toBe('https://cdn.example/a.png');
        expect(srcs[1]).toBe('http://cdn.example/b.png');
        expect(srcs[2]).toBe('/rel/path.png');
        expect(srcs[3]).toBe('data:image/png;base64,xx');
        // Fail closed: unknown / active schemes become empty
        expect(srcs[4]).toBe('');
        expect(srcs[5]).toBe('');
        expect(srcs[6]).toBe('');
        expect(srcs[7]).toBe('');
        expect(srcs[8]).toBe('');
    });


    it('registers editorContent adapter in manifest.contributes.adapters', () => {
        expect(manifest.contributes.adapters).toContain('editorContent');
    });
});

// ---------------------------------------------------------------------------
// 4. EditorSession lifecycle
// ---------------------------------------------------------------------------

describe('EditorSession lifecycle', () => {
    let eventBus;

    beforeEach(() => {
        eventBus = new EventBus();
    });

    it('init validates schema, sets initialized=true', () => {
        const session = new EditorSessionService(eventBus);
        const schema = testSchema();
        const doc = testDoc(schema);

        expect(session.initialized).toBe(false);
        expect(session.isInitialized).toBe(false);

        session.init({ editorId: 'ed1', schema, doc });

        expect(session.initialized).toBe(true);
        expect(session.isInitialized).toBe(true);
        expect(session.editorId).toBe('ed1');
        expect(session.documentId).toBe('page_1');
        expect(session.doc).toBeTruthy();
    });

    it('destroy clears state', () => {
        const session = new EditorSessionService(eventBus);
        const schema = testSchema();
        const doc = testDoc(schema);

        session.init({ editorId: 'ed1', schema, doc });
        expect(session.initialized).toBe(true);

        session.destroy();

        expect(session.initialized).toBe(false);
        expect(session.isInitialized).toBe(false);
        expect(session.schema).toBeNull();
        expect(session.doc).toBeNull();
        expect(session.config).toBeNull();
        expect(session._selection).toBeNull();
        expect(session.canUndo).toBe(false);
        expect(session.canRedo).toBe(false);
        expect(session.historyLength).toBe(0);
    });

    it('two sessions with different editorIds are isolated', () => {
        const schema = testSchema();
        const doc1 = testDoc(schema, 'Session 1 text');
        const doc2 = testDoc(schema, 'Session 2 text');

        const s1 = new EditorSessionService(new EventBus());
        const s2 = new EditorSessionService(new EventBus());

        s1.init({ editorId: 'ed1', schema, doc: doc1 });
        s2.init({ editorId: 'ed2', schema, doc: doc2 });

        // They have different editorIds
        expect(s1.editorId).toBe('ed1');
        expect(s2.editorId).toBe('ed2');

        // Their docs are independent
        expect(s1.doc).not.toBe(s2.doc);

        // Content differs
        const p1 = s1.doc.nodes[s1.doc.nodes.page_1.body.nodes[0]];
        const p2 = s2.doc.nodes[s2.doc.nodes.page_1.body.nodes[0]];
        expect(p1.content.content).toBe('Session 1 text');
        expect(p2.content.content).toBe('Session 2 text');

        // Mutating s1 doesn't affect s2
        const tr1 = s1.tr;
        tr1.set([p1.id, 'content'], {
            content: 'Modified in s1',
            marks: [],
            annotations: []
        });
        s1.apply(tr1);

        // s1 changed
        const p1After = s1.doc.nodes[s1.doc.nodes.page_1.body.nodes[0]];
        expect(p1After.content.content).toBe('Modified in s1');

        // s2 unchanged
        const p2After = s2.doc.nodes[s2.doc.nodes.page_1.body.nodes[0]];
        expect(p2After.content.content).toBe('Session 2 text');
    });
});

// ---------------------------------------------------------------------------
// 5. Integration smoke
// ---------------------------------------------------------------------------

describe('Integration smoke', () => {
    let eventBus, session, schema, doc;

    beforeEach(() => {
        eventBus = new EventBus();
        session = new EditorSessionService(eventBus);
        schema = testSchema();
        doc = testDoc(schema, 'Original text');
        session.init({ editorId: 'int-smoke', schema, doc });
    });

    it('transaction set + apply + undo chain', () => {
        const paragraphId = session.doc.nodes.page_1.body.nodes[0];

        // Step 1: modify paragraph text via transaction
        const tr1 = session.tr;
        tr1.set([paragraphId, 'content'], {
            content: 'Modified text',
            marks: [],
            annotations: []
        });
        session.apply(tr1);

        expect(session.canUndo).toBe(true);
        expect(session.canRedo).toBe(false);
        expect(session.historyLength).toBe(1);
        expect(session.doc.nodes[paragraphId].content.content).toBe('Modified text');

        // Step 2: modify again for a second history entry
        const tr2 = session.tr;
        tr2.set([paragraphId, 'content'], {
            content: 'Even more modified',
            marks: [],
            annotations: []
        });
        session.apply(tr2);

        expect(session.historyLength).toBe(2);
        expect(session.doc.nodes[paragraphId].content.content).toBe('Even more modified');

        // Step 3: undo once
        session.undo();
        expect(session.historyLength).toBe(2);
        expect(session.canUndo).toBe(true);
        expect(session.canRedo).toBe(true);
        expect(session.doc.nodes[paragraphId].content.content).toBe('Modified text');

        // Step 4: undo again — back to original
        session.undo();
        expect(session.canUndo).toBe(false);
        expect(session.canRedo).toBe(true);
        expect(session.doc.nodes[paragraphId].content.content).toBe('Original text');

        // Step 5: redo once
        session.redo();
        expect(session.canUndo).toBe(true);
        expect(session.canRedo).toBe(true);
        expect(session.doc.nodes[paragraphId].content.content).toBe('Modified text');

        // Step 6: redo second time — back to latest
        session.redo();
        expect(session.canUndo).toBe(true);
        expect(session.canRedo).toBe(false);
        expect(session.doc.nodes[paragraphId].content.content).toBe('Even more modified');
    });

    it('document round-trip via adapter: blocks → doc → edit → save', () => {
        // Use a schema that covers all types the adapter produces
        const fullSchema = defineDocumentSchema({
            page: {
                kind: 'document',
                properties: {
                    body: {
                        type: 'node_array',
                        node_types: ['paragraph', 'list', 'block'],
                        mark_types: [],
                        annotation_types: [],
                        default_node_type: 'paragraph'
                    }
                }
            },
            paragraph: {
                kind: 'text',
                properties: {
                    content: {
                        type: 'text',
                        mark_types: ['strong', 'emphasis'],
                        annotation_types: [],
                        allow_newlines: true
                    }
                }
            },
            list: {
                kind: 'block',
                properties: {
                    ordered: { type: 'boolean', default: false },
                    list_items: {
                        type: 'node_array',
                        node_types: ['list_item'],
                        mark_types: [],
                        annotation_types: [],
                        default_node_type: 'list_item'
                    }
                }
            },
            list_item: {
                kind: 'text',
                properties: {
                    content: {
                        type: 'text',
                        mark_types: ['strong', 'emphasis'],
                        annotation_types: [],
                        allow_newlines: true
                    }
                }
            },
            block: {
                kind: 'block',
                properties: {
                    data: { type: 'string', default: '' }
                }
            },
            strong: { kind: 'mark', properties: {} },
            emphasis: { kind: 'mark', properties: {} }
        });

        const blocks = [
            { type: 'paragraph', content: 'Intro paragraph' },
            { type: 'paragraph', content: 'Another paragraph' },
            { type: 'ul', items: [{ content: 'Point 1' }, { content: 'Point 2' }] }
        ];

        const adapterDoc = EditorContentAdapter.blocksToDocument(blocks);

        const s = new EditorSessionService(new EventBus());
        s.init({ editorId: 'round-trip', schema: fullSchema, doc: adapterDoc });

        // Edit first paragraph
        const paraId = s.doc.nodes.page_1.body.nodes[0];
        const tr = s.tr;
        tr.set([paraId, 'content'], {
            content: 'Updated intro',
            marks: [],
            annotations: []
        });
        s.apply(tr);

        // Save via adapter
        const adapter = new EditorContentAdapter(null, s);
        const saved = adapter.saveContent();

        expect(saved.blocks).toHaveLength(3);
        expect(saved.blocks[0].type).toBe('paragraph');
        expect(saved.blocks[0].content).toBe('Updated intro');
        expect(saved.blocks[2].type).toBe('ul');
        expect(saved.blocks[2].items).toHaveLength(2);

        // Undo and verify saveContent reflects reverted state
        s.undo();
        const savedAfterUndo = adapter.saveContent();
        expect(savedAfterUndo.blocks[0].content).toBe('Intro paragraph');

        // loadContent round-trip
        const loaded = adapter.loadContent({ id: 'test', blocks: savedAfterUndo.blocks });
        expect(loaded).toBeTruthy();
        expect(loaded.document_id).toBeTruthy();
        const pageNode = loaded.nodes[loaded.document_id];
        expect(pageNode.body.nodes.length).toBe(3);
    });
});
