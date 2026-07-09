# Visual Editor Module

## Purpose

Structured content editor with typed nodes (document, block, text, mark,
annotation), transactional editing with undo/redo, and a schema-driven
document model. Modeled after the Svedit rich editor architecture but
implemented as vanilla JS on CSMA's EventBus + CSS rendering model.

## Runtime Integration

Loaded only when the `visual-editor` feature flag is enabled. The module
owns client-side editor state, EventBus contracts, and rendering components.
Multiple editor instances can coexist — each with its own `EditorSessionService`
identified by a unique `editorId`.

## Frontend / Backend Boundary

This is a frontend CSMA module. It must not store secrets, perform
authoritative content persistence, or handle collaborative editing (CRDT/OT).
Backend companions for content storage, real-time sync, and publishing
workflows should be implemented separately.

## Architecture

```
engine/          Core engine — zero DOM dependency
  DocumentSchema.js    Schema definition and validation
  DocumentDefaults.js  Property default values
  DocumentModel.js     Document creation, access (get/inspect), validation
  NodeValidator.js     Node-level validation
  ReferenceTraversal.js  Graph traversal and reference counting
  TextOperations.js    Split, join, slice annotated text
  TransactionOps.js    Low-level draft mutations (COW)
  Transaction.js       Atomic create/set/delete ops with undo/redo
  Transforms.js        Higher-level operations (break/join/insert)
  MarkOps.js           Mark toggle, add, remove
  AnnotationOps.js     Annotation add, remove
  SelectionModel.js    Selection types, validation, serialization
  SelectionUtils.js    Selection-aware mark/annotation queries

services/
  EditorSessionService.js   Session: doc + selection + history + EventBus

commands/
  Command.js           Base class
  CommandRegistry.js   Named command dispatch
  UndoCommand.js       Undo
  RedoCommand.js       Redo
  ToggleMarkCommand.js Bold/italic/link toggle
  InsertNodeCommand.js Insert default node
  DeleteSelectionCommand.js  Delete selection
  SelectParentCommand.js     Navigate up
  BreakNodeCommand.js  Enter → split paragraph
  JoinNodeCommand.js   Backspace at pos 0 → join

input/
  KeyMapper.js         Keyboard → command mapping

rendering/
  EditorSurface.js     Top-level mounting and lifecycle
  NodeRenderer.js      Node type → renderer registry
  TextPropertyEditor.js  contenteditable text with mark rendering
  NodeArrayContainer.js   Ordered child node list
  SelectionOverlay.js  Caret and selection highlights
  NodeGapInserter.js   Between-node insertion targets
  rendering.css        All editor visual states

ui/
  EditorToolbar.js     Formatting toolbar
  editor-toolbar.css

contracts/
  visual-editor-contracts.js   EventBus contracts

adapters/
  EditorContentAdapter.js      CMS blocks ↔ editor document bridge
```

## Usage

```js
// Define a schema
import { defineDocumentSchema } from 'visual-editor';

const schema = defineDocumentSchema({
    page: {
        kind: 'document',
        properties: {
            body: {
                type: 'node_array',
                node_types: ['paragraph', 'heading'],
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
                allow_newlines: true
            }
        }
    },
    heading: {
        kind: 'text',
        properties: {
            level: { type: 'integer', default: 2 },
            content: {
                type: 'text',
                mark_types: ['strong', 'emphasis'],
                allow_newlines: false
            }
        }
    },
    strong: { kind: 'mark', properties: {} },
    emphasis: { kind: 'mark', properties: {} }
});

// Initialize via EventBus
eventBus.publish('INTENT_EDITOR_INIT', {
    editorId: 'main-editor',
    schema,
    doc: { document_id: 'page_1', nodes: { page_1: { id: 'page_1', type: 'page', body: { nodes: [], marks: [], annotations: [] } } } },
    config: { generate_id: () => `node_${crypto.randomUUID()}` }
});

// Or directly
import { EditorSessionService } from 'visual-editor';
const session = new EditorSessionService(eventBus);
session.init({ editorId: 'main-editor', schema, doc, config });

// Edit via transactions
const tr = session.tr;
tr.create({ id: session.generateId(), type: 'paragraph' });
tr.set(['page_1', 'body'], { nodes: [newNodeId], marks: [], annotations: [] });
session.apply(tr);

// Undo/redo
session.undo();
session.redo();
```

## Tests

See tests for schema validation, document model, transaction engine,
undo/redo, transforms, mark operations, selection model, and integration
with cms-content module.

## Implementation Plan

See `docs/visual-editor-module.md` for the full implementation plan.
