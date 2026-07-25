/**
 * Visual Editor — History Module Integration
 *
 * Verifies that EditorSessionService delegates undo/redo to a HistoryService
 * instance (follow-up to src/modules/history/plan.md § "Out of scope").
 *
 * Covers:
 *   (a) apply() records a 'veditor:transaction' entry to the history log
 *   (b) undo() delegates to historyService.undo() and reverts the document
 *   (c) redo() delegates to historyService.redo() and re-applies the ops
 *   (d) canUndo / canRedo reflect the underlying history state
 *   (e) an injected HistoryService is used directly (DI path)
 *   (f) redo-branch truncation after undo+new-edit is handled by the module
 */
import { describe, it, expect, beforeEach } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import {
    EditorSessionService,
    defineDocumentSchema,
    createDocument
} from '../src/modules/visual-editor/index.js';
import { HistoryService } from '../src/modules/history/services/HistoryService.js';

// ---------------------------------------------------------------------------
// Shared helpers (mirrors visual-editor-integration.test.js)
// ---------------------------------------------------------------------------

function testSchema() {
    return defineDocumentSchema({
        page: {
            kind: 'document',
            properties: {
                body: {
                    type: 'node_array',
                    node_types: ['paragraph'],
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
                    mark_types: ['strong'],
                    annotation_types: [],
                    allow_newlines: true
                }
            }
        },
        strong: { kind: 'mark', properties: {} }
    });
}

function testDoc(schema, paragraphText = 'Original text') {
    const pId = 'para_1';
    return createDocument('page_1', {
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
}

function setContent(session, text) {
    const tr = session.tr;
    tr.set(['para_1', 'content'], { content: text, marks: [], annotations: [] });
    session.apply(tr);
}

function contentOf(session) {
    return session.get(['para_1', 'content', 'content']);
}

// ---------------------------------------------------------------------------
// Tests — lazy (non-injected) ephemeral history
// ---------------------------------------------------------------------------

describe('EditorSessionService ↔ history module (lazy)', () => {
    let eventBus, session, schema, doc;

    beforeEach(() => {
        eventBus = new EventBus();
        session = new EditorSessionService(eventBus);
        schema = testSchema();
        doc = testDoc(schema);
        session.init({ editorId: 'vedit-hist', schema, doc });
    });

    it('exposes a historyService and starts empty', () => {
        expect(session.historyService).toBeInstanceOf(HistoryService);
        expect(session.historyService.getAll()).toHaveLength(0);
        expect(session.canUndo).toBe(false);
        expect(session.canRedo).toBe(false);
    });

    it('(a) apply() records a veditor:transaction entry to the log', () => {
        setContent(session, 'first edit');

        const all = session.historyService.getAll();
        expect(all).toHaveLength(1);
        const entry = all[0];
        expect(entry.intent).toBe('veditor:transaction');
        expect(entry.status).toBe('recorded');
        expect(entry.payload.ops.length).toBeGreaterThan(0);
        expect(entry.payload.inverse_ops.length).toBeGreaterThan(0);
        expect(entry.payload.doc_id).toBe(session.documentId);
        // meta channel marks these as editor-owned entries
        expect(entry.meta.channels).toContain('veditor');
    });

    it('publishes HISTORY_OP_RECORDED when apply() records', () => {
        const seen = [];
        eventBus.subscribe('HISTORY_OP_RECORDED', (p) => seen.push(p));

        setContent(session, 'recorded');

        expect(seen).toHaveLength(1);
        expect(seen[0].entry.intent).toBe('veditor:transaction');
    });

    it('(d) canUndo / canRedo track history state across edits', () => {
        expect(session.canUndo).toBe(false);
        expect(session.canRedo).toBe(false);

        setContent(session, 'one');
        expect(session.canUndo).toBe(true);
        expect(session.canRedo).toBe(false);

        setContent(session, 'two');
        expect(session.canUndo).toBe(true);
        expect(session.canRedo).toBe(false);
    });

    it('(b) undo() delegates and reverts the document to the prior state', () => {
        setContent(session, 'one');
        setContent(session, 'two');
        expect(contentOf(session)).toBe('two');

        session.undo();

        expect(contentOf(session)).toBe('one');
        expect(session.canUndo).toBe(true); // 'one' still undoable
        expect(session.canRedo).toBe(true); // 'two' redoable
    });

    it('(c) redo() delegates and re-applies the undone ops', () => {
        setContent(session, 'one');
        setContent(session, 'two');
        session.undo();
        expect(contentOf(session)).toBe('one');

        session.redo();

        expect(contentOf(session)).toBe('two');
        expect(session.canRedo).toBe(false);
        expect(session.canUndo).toBe(true);
    });

    it('undo/redo round-trip returns to the tip state', () => {
        setContent(session, 'a');
        setContent(session, 'b');
        setContent(session, 'c');

        session.undo(); // -> b
        session.undo(); // -> a
        session.undo(); // -> original
        expect(session.canUndo).toBe(false);

        session.redo(); // -> a
        session.redo(); // -> b
        session.redo(); // -> c
        expect(contentOf(session)).toBe('c');
        expect(session.canRedo).toBe(false);
    });

    it('(f) undo + new edit truncates the redo branch (handled by the module)', () => {
        setContent(session, 'one');
        setContent(session, 'two');
        session.undo(); // -> one, 'two' redoable
        expect(session.canRedo).toBe(true);

        setContent(session, 'three'); // truncates redo branch

        expect(session.canRedo).toBe(false);
        expect(contentOf(session)).toBe('three');
        expect(session.canUndo).toBe(true);
    });

    it('undo() on an empty log is a no-op', () => {
        expect(() => session.undo()).not.toThrow();
        expect(session.canUndo).toBe(false);
    });

    it('redo() with nothing undone is a no-op', () => {
        setContent(session, 'one');
        expect(() => session.redo()).not.toThrow();
        expect(session.canRedo).toBe(false);
    });

    it('historyLength reflects the recorded-entry count and survives undo', () => {
        expect(session.historyLength).toBe(0);
        setContent(session, 'one');
        expect(session.historyLength).toBe(1);
        setContent(session, 'two');
        expect(session.historyLength).toBe(2);
        session.undo(); // undo does not remove entries from the log
        expect(session.historyLength).toBe(2);
    });

    it('emits EDITOR_DOCUMENT_CHANGED with canUndo/canRedo reflecting history', () => {
        const events = [];
        eventBus.subscribe('EDITOR_DOCUMENT_CHANGED', (p) => events.push(p));

        setContent(session, 'one');
        const applyEvt = events[events.length - 1];
        expect(applyEvt.canUndo).toBe(true);
        expect(applyEvt.canRedo).toBe(false);

        session.undo();
        const undoEvt = events[events.length - 1];
        expect(undoEvt.canUndo).toBe(false);
        expect(undoEvt.canRedo).toBe(true);
    });

    it('destroy() resets history state', () => {
        setContent(session, 'one');
        expect(session.historyLength).toBe(1);

        session.destroy();

        expect(session.historyLength).toBe(0);
        expect(session.canUndo).toBe(false);
        expect(session.canRedo).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Tests — injected (DI) history path
// ---------------------------------------------------------------------------

describe('EditorSessionService ↔ history module (injected)', () => {
    let eventBus, injectedHistory, session, schema, doc;

    beforeEach(() => {
        eventBus = new EventBus();
        injectedHistory = new HistoryService(eventBus);
        session = new EditorSessionService(eventBus, { historyService: injectedHistory });
        schema = testSchema();
        doc = testDoc(schema);
        session.init({ editorId: 'vedit-inj', schema, doc });
    });

    it('uses the injected historyService instance, not a lazy one', () => {
        expect(session.historyService).toBe(injectedHistory);
    });

    it('records through the injected instance', () => {
        setContent(session, 'injected edit');
        expect(injectedHistory.getAll()).toHaveLength(1);
        expect(injectedHistory.canUndo()).toBe(true);
        expect(session.canUndo).toBe(true);
    });

    it('undo/redo operate through the injected instance', () => {
        setContent(session, 'a');
        setContent(session, 'b');
        session.undo();
        expect(contentOf(session)).toBe('a');
        expect(injectedHistory.canRedo()).toBe(true);

        session.redo();
        expect(contentOf(session)).toBe('b');
        expect(injectedHistory.canRedo()).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Tests — batching merges consecutive transactions into one entry
// ---------------------------------------------------------------------------

describe('EditorSessionService ↔ history module (batching)', () => {
    let eventBus, session, schema, doc;

    beforeEach(() => {
        eventBus = new EventBus();
        session = new EditorSessionService(eventBus);
        schema = testSchema();
        doc = testDoc(schema);
        session.init({ editorId: 'vedit-batch', schema, doc });
    });

    it('merges consecutive batched applies into a single history entry', () => {
        const tr1 = session.tr;
        tr1.set(['para_1', 'content'], { content: 'ab', marks: [], annotations: [] });
        session.apply(tr1, { batch: true });

        const tr2 = session.tr;
        tr2.set(['para_1', 'content'], { content: 'abcd', marks: [], annotations: [] });
        session.apply(tr2, { batch: true });

        // Two batched applies within the window collapse to one log entry.
        expect(session.historyService.getAll()).toHaveLength(1);
        const entry = session.historyService.getAll()[0];
        // Merged entry holds both transactions' ops.
        expect(entry.payload.ops.length).toBeGreaterThanOrEqual(2);
        expect(contentOf(session)).toBe('abcd');
    });

    it('undo of a batched entry reverts the whole merged span', () => {
        const tr1 = session.tr;
        tr1.set(['para_1', 'content'], { content: 'ab', marks: [], annotations: [] });
        session.apply(tr1, { batch: true });

        const tr2 = session.tr;
        tr2.set(['para_1', 'content'], { content: 'abcd', marks: [], annotations: [] });
        session.apply(tr2, { batch: true });

        session.undo();

        expect(contentOf(session)).toBe('Original text');
        expect(session.canUndo).toBe(false);
    });
});
