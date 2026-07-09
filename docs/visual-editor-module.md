# visual-editor — CSMA Module Implementation Plan

> Scope: CSMA frontend only. Backend/edge companions for content
> persistence, collaboration, and publishing are specified as future
> contracts but not implemented here. This plan is informed by the
> architecture of [Svedit](https://github.com/michael/svedit) (Svelte 5
> rich editor) but is a greenfield vanilla-JS implementation adapted to
> CSMA's EventBus + CSS rendering model.

## Overview

**What**: A chromeless structured-content editor for CSMA. Model content
as a typed graph of nodes (documents, blocks, text, marks, annotations),
edit it through transactions with full undo/redo, and map native DOM
selections to an internal path+offset selection model.

**Why**: CSMA currently handles content as opaque blocks (`cms-content`
loads a JSON blob). This module makes content **structured and
editable** — each paragraph, image, list, and heading is a typed node
that other modules can inspect, transform, and render. It is the
foundation for visual page builders, rich blog editors, structured form
authors, and AI-assisted content composition.

**Not**: A WYSIWYG toolbar, a page builder UI, a CMS backend, or a
collaborative editing system. Those consume this module.

### Relationship to Svedit

| Svedit concept | CSMA adaptation |
|---|---|
| Svelte 5 `$state` / `$derived` | EventBus events + manual state propagation |
| Svelte components | Type II components (EventBus-driven DOM) |
| Svelte reactivity (auto re-render) | Explicit `publish` after every mutation |
| `Session`, `Transaction`, `doc_utils` | Ported to vanilla JS with identical public API shape |
| `Node.svelte`, `TextProperty.svelte` | Type II rendering components |
| `Command.svelte.js` | `CommandRegistry` — plain JS classes, no Svelte |
| `KeyMapper.svelte.js` | `KeyMapper` — plain JS, EventBus-integrated |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  EditorSession (Service)                                │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Document │  │  Selection   │  │  History Stack   │  │
│  │  Model   │  │  Model       │  │  (undo/redo)     │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
│       │               │                   │             │
│  ┌────┴───────────────┴───────────────────┴──────────┐  │
│  │              Transaction Engine                    │  │
│  │  create / set / delete / build  (atomic, COW)      │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │          Command Registry                         │  │
│  │  undo / redo / toggleMark / insertNode / …        │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │          KeyMapper (keyboard → command)            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐
│  CSMA EventBus  │    │  Rendering Surface   │
│  INTENT_EDITOR_*│    │  (Type II components) │
│  EDITOR_* events│    │  NodeRenderer         │
│  Contracts      │    │  TextPropertyEditor   │
└─────────────────┘    │  NodeArrayContainer   │
                       │  SelectionOverlay     │
                       └──────────────────────┘
```

### Data Flow

1. **User types/clicks** → DOM event → KeyMapper or command handler
2. **Command executes** → builds a `Transaction` with ops + inverse ops
3. **Transaction builds** — all ops mutate a copy-on-write draft `nodes` map;
   original document untouched until apply
4. **Session.apply(tr)** → validates transaction result → swaps `doc` →
   updates selection → pushes history entry → publishes `EDITOR_DOCUMENT_CHANGED`
5. **CSMA EventBus delivers event** → rendering components update DOM via
   CSS classes and `data-*` attributes

### Selection Model

Three selection types, matching svedit's model:

| Type | Target | Fields | Example |
|------|--------|--------|---------|
| `text` | Range within a text property | `path`, `anchor_offset`, `focus_offset` | Cursor in a paragraph |
| `node` | Range of nodes in a `node_array` | `path`, `anchor_offset`, `focus_offset` | Selecting two list items |
| `property` | A single property of a node | `path` | Focused on a title field |

`DocumentPath` = `Array<string | number>` — e.g. `["page_1", "body", 2, "content"]`.

## Module Structure

```
src/modules/visual-editor/
├── index.js                          # manifest + services + contracts export
├── README.md                         # Purpose, runtime integration, boundary
│
├── engine/                           # Core — zero DOM dependency
│   ├── DocumentSchema.js             # defineSchema, validateSchema, property types
│   ├── DocumentModel.js              # createDocument, validateDocument, doc.get(path), doc.inspect(path)
│   ├── DocumentDefaults.js           # fillNodeDefaults, fillDocumentDefaults, getPropertyDefault
│   ├── NodeValidator.js              # validateNode, validateNodeAgainstSchema, isIdValid
│   ├── ReferenceTraversal.js         # getReferencingNodeIds, traverse, traverseIds, buildReferenceCounts
│   ├── Transaction.js                # Transaction class: create/set/delete/build ops + COW draft
│   ├── TransactionOps.js             # applyOpToDraft, createDocumentDraft, cascadeDelete
│   ├── SelectionModel.js             # Selection types, validateSelection, getSelectionRange, isSelectionCollapsed
│   ├── SelectionUtils.js             # getSelectedMarks, getSelectedAnnotations, getSelectedRangeTypes
│   ├── TextOperations.js             # splitText, joinText, charSlice, getCharLength
│   ├── Transforms.js                 # breakTextNode, joinTextNode, setProperties, insertDefaultNode
│   ├── MarkOps.js                    # toggleMark, addMark, removeMark, canSwitchMarkType
│   └── AnnotationOps.js              # addAnnotation, removeAnnotation
│
├── services/
│   └── EditorSessionService.js       # Session: doc + selection + history + apply/undo/redo
│
├── commands/
│   ├── Command.js                    # Base Command class (isEnabled, execute)
│   ├── CommandRegistry.js            # Registry of named commands
│   ├── UndoCommand.js                # session.undo()
│   ├── RedoCommand.js                # session.redo()
│   ├── ToggleMarkCommand.js          # toggle bold/italic/link
│   ├── InsertNodeCommand.js          # insert default node type
│   ├── DeleteSelectionCommand.js     # delete selected text/nodes
│   └── SelectParentCommand.js        # navigate up the document tree
│
├── input/
│   └── KeyMapper.js                  # Keyboard shortcut → command mapping
│
├── rendering/                        # Type II components (DOM-aware)
│   ├── EditorSurface.js              # Main editing surface (mounts on container)
│   ├── NodeRenderer.js              # Renders a single node by type
│   ├── TextPropertyEditor.js         # contenteditable text with selection sync
│   ├── NodeArrayContainer.js         # Renders ordered list of child nodes
│   ├── SelectionOverlay.js           # Visual carets, selections, node selections
│   ├── NodeGapInserter.js            # Between-node insertion indicators
│   └── rendering.css                 # All editor visual states (8-state discipline)
│
├── ui/                               # Ancillary UI (Type II)
│   ├── EditorToolbar.js              # Optional formatting toolbar
│   └── editor-toolbar.css
│
├── contracts/
│   └── visual-editor-contracts.js    # EventBus contracts
│
└── adapters/
    └── EditorContentAdapter.js       # Bridge to cms-content module
```

## Phase 1: Core Engine (no DOM, no rendering)

**Goal**: Document model + transaction engine + undo/redo, all testable
without a browser. This is the highest-value, lowest-risk phase.

### 1.1 Document Schema (`engine/DocumentSchema.js`)

Port from svedit `doc_utils.js` — schema definition and validation.

**Public API**:

```js
// Define a schema with type-checking identity function
export function defineDocumentSchema(schema) → schema

// Property type classification
export function isPrimitiveType(type) → boolean

// Get the default node type for a node_array/node property
export function getDefaultNodeType(propertyDefinition) → string | null

// Validate that all referenced node/mark/annotation types exist
export function validateDocumentSchema(schema) → void  // throws on error
```

**Schema shape** (identical to svedit):

```js
const blogSchema = defineDocumentSchema({
  page: {
    kind: 'document',
    properties: {
      body: {
        type: 'node_array',
        node_types: ['heading', 'paragraph', 'image', 'list'],
        mark_types: ['section'],
        annotation_types: ['comment'],
        default_node_type: 'paragraph'
      }
    }
  },
  paragraph: {
    kind: 'text',
    properties: {
      content: {
        type: 'text',
        mark_types: ['strong', 'emphasis', 'link'],
        annotation_types: ['comment'],
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
  image: {
    kind: 'block',
    properties: {
      src: { type: 'string' },
      alt: { type: 'string', default: '' },
      caption: { type: 'string', default: '' }
    }
  },
  list: {
    kind: 'block',
    properties: {
      ordered: { type: 'boolean', default: false },
      list_items: {
        type: 'node_array',
        node_types: ['list_item'],
        default_node_type: 'list_item'
      }
    }
  },
  list_item: {
    kind: 'text',
    properties: {
      content: {
        type: 'text',
        mark_types: ['strong', 'emphasis', 'link'],
        allow_newlines: true
      }
    }
  },
  strong:     { kind: 'mark',       properties: {} },
  emphasis:   { kind: 'mark',       properties: {} },
  link:       { kind: 'mark',       properties: { href: { type: 'string' } } },
  section:    { kind: 'mark',       properties: {} },
  comment:    { kind: 'annotation', properties: {} }
});
```

**Node kinds**: `document`, `block`, `text`, `mark`, `annotation`.

**Property types**: `string`, `number`, `integer`, `boolean`, `datetime`,
`string_array`, `number_array`, `boolean_array`, `integer_array`, `text`,
`node`, `node_array`.

**Text property shape**: `{ content: '', marks: [], annotations: [] }`
where marks/annotations are `[{ start_offset, end_offset, node_id }]`.

**Node array property shape**: `{ nodes: [], marks: [], annotations: [] }`
where nodes is `NodeId[]`.

**Node ID rules** (from svedit):
- String, non-empty
- Starts with letter (A-Z, a-z) or underscore
- Contains only letters, numbers, underscores, dashes
- Must not contain `__`

### 1.2 Document Defaults (`engine/DocumentDefaults.js`)

```js
// Get the default value for a property definition
export function getPropertyDefault(propertyDefinition) → any

// Fill omitted properties with schema defaults (shallow copy)
export function fillNodeDefaults(node, schema) → node

// Fill defaults across an entire document
export function fillDocumentDefaults(doc, schema) → doc
```

**Default mapping** (from svedit):
- `string` → `''`
- `integer` → `0`
- `number` → `0`
- `boolean` → `false`
- `text` → `{ content: '', marks: [], annotations: [] }`
- `node_array` → `{ nodes: [], marks: [], annotations: [] }`
- `*_array` → `[]`
- `node` → `undefined` (must be set explicitly)
- If `default` is declared in schema, use `structuredClone(propertyDefinition.default)`

### 1.3 Document Model (`engine/DocumentModel.js`)

```js
// Create a document from nodes map + document_id
export function createDocument(documentId, nodes, schema) → Document

// Full document validation (all nodes, all references, no cycles)
export function validateDocument(doc, schema) → void  // throws

// Get a node or property value at a DocumentPath
export function docGet(schema, doc, path) → any

// Inspect a path — returns { kind: 'property'|'node', ...metadata }
export function docInspect(schema, doc, path) → object

// Get the property type from schema
export function docPropertyType(schema, type, property) → string

// Get node kind from schema
export function docKind(schema, node) → 'document'|'block'|'text'|'mark'|'annotation'
```

**Document shape**:

```js
const doc = {
  document_id: 'page_1',
  nodes: {
    page_1: {
      id: 'page_1',
      type: 'page',
      body: {
        nodes: ['paragraph_1', 'image_1', 'paragraph_2'],
        marks: [],
        annotations: []
      }
    },
    paragraph_1: {
      id: 'paragraph_1',
      type: 'paragraph',
      content: {
        content: 'Hello world',
        marks: [
          { start_offset: 0, end_offset: 5, node_id: 'strong_1' }
        ],
        annotations: []
      }
    },
    strong_1: { id: 'strong_1', type: 'strong' },
    image_1: {
      id: 'image_1',
      type: 'image',
      src: '/img/photo.jpg',
      alt: 'A photo',
      caption: ''
    },
    paragraph_2: {
      id: 'paragraph_2',
      type: 'paragraph',
      content: { content: 'More text', marks: [], annotations: [] }
    }
  }
};
```

### 1.4 Node Validator (`engine/NodeValidator.js`)

```js
// Validate a single node against schema
// requireReferences: when true (default), validates that node/node_array
// properties reference nodes that exist in allNodes
export function validateNode(node, schema, allNodes, { requireReferences } = {}) → void

// Validate a node ID
export function isIdValid(id) → boolean

// Validate that config components cover all schema node types
export function validateConfigComponents(schema, config) → void
```

**Node validation checks** (from svedit):
1. Node type exists in schema
2. Node has an `id` property that is a valid ID
3. All required properties present (no undefined for properties without
   defaults)
4. Property values match declared types
5. `text` properties have `content`, `marks[]`, `annotations[]`
6. `node_array` properties have `nodes[]`, `marks[]`, `annotations[]`
7. Marks/annotations have valid `start_offset`/`end_offset` within bounds
8. Marks are mutually exclusive (no overlapping same-type marks)
9. Node references (`node`/`node_array.nodes`) point to existing nodes
   (when `requireReferences` is true)
10. Reference targets have the correct type according to `node_types`
11. No cyclic references (document node must not be reachable from itself)
12. `kind: 'text'` nodes have exactly one text property named `content`

### 1.5 Reference Traversal (`engine/ReferenceTraversal.js`)

```js
// Get all node IDs reachable from a starting node (BFS, depth-first)
// Returns [leafId, ..., rootId] — the starting node IS the last element
export function traverse(nodeId, schema, nodes) → NodeId[]

// Like traverse but returns IDs only, no node objects
export function traverseIds(nodeId, schema, nodes) → NodeId[]

// Find all node IDs that reference any of the target IDs
export function getReferencingNodeIds(schema, doc, targetIds) → NodeId[]

// Build a map of nodeId → reference count
export function buildReferenceCounts(doc, schema) → Map<NodeId, number>

// Visit every reference property in a node (for remapping IDs)
export function visitNodeReferences(node, schema, visitor) → void
```

### 1.6 Text Operations (`engine/TextOperations.js`)

Pure functions on text content strings + marks/annotations.

```js
// Split annotated text at position → [left, right]
export function splitText(textValue, position) → [AnnotatedText, AnnotatedText]

// Join two annotated text values → combined
export function joinText(left, right) → AnnotatedText

// Get character length of annotated text (content.length, not byte length)
export function getCharLength(textNode) → number

// Slice annotated text [start, end) → new AnnotatedText with adjusted marks
export function charSlice(textValue, start, end) → AnnotatedText

// Adjust mark/annotation ranges after a deletion at [pos, pos+length]
export function adjustRangesForDeletion(ranges, pos, length) → ranges

// Adjust mark/annotation ranges after an insertion at pos of length chars
export function adjustRangesForInsertion(ranges, pos, length) → ranges

// Check if two ranges are exclusive (non-overlapping)
export function areRangesExclusive(a, b) → boolean
```

Implementation note: marks/annotations that end up with `start_offset ===
end_offset` after adjustment MUST be removed (zero-width ranges are
invalid).

### 1.7 Transaction (`engine/Transaction.js`)

The core editing primitive. All document mutations flow through
transactions.

**Design** (ported from svedit `Transaction.svelte.js`):

```js
class Transaction {
  constructor(schema, doc, selection, config)

  // === Read operations (on the draft) ===
  get(path)           → any           // docGet on draft
  propertyType(type, property) → string
  kind(node)          → 'document'|'block'|'text'|'mark'|'annotation'
  inspect(path)       → object        // docInspect on draft
  validateNode(node)  → void

  // === Write operations (mutate draft + record ops + inverse) ===
  set(path, value)    → this          // Set a property value
  create(node)        → this          // Create a new node
  delete(id)          → this          // Delete a node (force-delete)
  setSelection(sel)   → this          // Set the selection after apply
  deleteSelection()   → this          // Delete selected text/nodes

  // === Higher-level operations ===
  build(nodeId, nodes) → NodeId       // Deep-clone a subgraph with new IDs
  toggleMark(markType) → this         // Toggle a mark on selection
  addAnnotation(annType) → this       // Add an annotation to selection
  removeAnnotation(annType) → this    // Remove an annotation from selection

  // === Selection analysis ===
  get availableMarkTypes() → string[]
  get availableAnnotationTypes() → string[]
  get selectedMarks() → Mark[]
  get activeMark() → Mark | null
  get selectedAnnotations() → Annotation[]
  get activeAnnotation() → Annotation | null
  get referencedNodes(nodeId) → NodeId[]
}
```

**Copy-on-write draft** (from svedit):

```js
function createDocumentDraft(doc) {
  // Shallow clone the nodes map — individual node objects are
  // copied on write by applyOpToDraft, so unchanged nodes keep
  // their identity.
  return { ...doc, nodes: { ...doc.nodes } };
}
```

**Ops format**: `[opName, ...args]` — e.g. `['set', ['para_1', 'content'], {...}]`,
`['create', nodeObject]`, `['delete', 'para_1']`.

**Inverse ops**: mirror of forward ops — `set` inverts to `set` with old value,
`create` inverts to `delete`, `delete` inverts to `create` with old node.

**Garbage collection** (`_cascadeDeleteUnreferencedNodes`):
When a `set` removes node references, check if those nodes are now
unreferenced. Use `buildReferenceCounts` for accurate ref-counting (a node
removed from one array may still be referenced elsewhere — including from a
node created earlier in the same transaction).

**Validation on `set`**:
- Path must point to a property
- Property type determines value shape validation
- `node` type: value must be a valid node ID string
- `node_array` type: value must have `.nodes` array of valid IDs
- `text` type: value must have `.content`, `.marks`, `.annotations`
- Track `changed_node_types` when `property_key === 'type'`

**Validation on `create`**:
- Node ID must be valid and not already exist
- Fill defaults for omitted properties
- Full `validateNode` on the filled node

**`build(nodeId, nodes)`**: Deep-clone a subgraph with all IDs remapped.
Useful for copy/paste and template insertion. BFS traversal → remap IDs →
`create` each node in order.

### 1.8 Transaction Ops (`engine/TransactionOps.js`)

Low-level draft mutation. Internal to Transaction — not public API.

```js
// Apply a single op to the draft (mutates draft.nodes in place with COW)
export function applyOpToDraft(draft, op) → void

// Create a shallow-copied draft from a document
export function createDocumentDraft(doc) → doc

// Cascade-delete nodes that have zero references after a set/delete
export function cascadeDeleteUnreferencedNodes(
  draft, schema, candidateIds, ops, inverseOps,
  createdNodeIds, modifiedNodeIds, deletedNodeIds
) → void
```

**Ops handled by `applyOpToDraft`**:

| Op | Args | Effect |
|----|------|--------|
| `set` | `[path, value]` | Deep-clone target node, set property |
| `create` | `[node]` | Insert into `draft.nodes[node.id]` |
| `delete` | `[id]` | Remove from `draft.nodes` |

`set` must deep-clone the target node before mutating (COW), so other
references to the old node object remain stable.

### 1.9 Transforms (`engine/Transforms.js`)

Higher-level document operations that compose `Transaction` ops. All
take `tr` as first argument.

```js
// Set multiple properties on a node at path
export function setProperties(tr, path, properties) → void

// Break a text node at the cursor (Enter key)
// Splits content, creates new node of same/default type, inserts after
export function breakTextNode(tr) → boolean   // false if not applicable

// Join this text node with the previous sibling (Backspace at position 0)
export function joinTextNode(tr) → boolean

// Insert a default node type at the current node selection
export function insertDefaultNode(tr) → boolean
```

**`breakTextNode` flow** (from svedit):
1. Guard: selection must be `text` type
2. Guard: enclosing node must be `kind: 'text'`
3. Guard: must be inside a `node_array` property
4. Delete non-collapsed selection first
5. Split text content at anchor_offset → `[left, right]`
6. Set current node's content to `left`
7. Create new node with `right` as content
8. Insert new node after current in parent `node_array`
9. Set selection to start of new node

**`joinTextNode` flow**:
1. Guard: selection must be `text` type with anchor_offset === 0
2. Guard: must be inside a `node_array` with a previous sibling
3. Get previous sibling's content
4. Prepend current content to previous sibling's content
5. Delete current node from `node_array`
6. Set selection to the join point

### 1.10 Mark Operations (`engine/MarkOps.js`)

```js
// Toggle a mark on the current selection
export function toggleMark(tr, markType) → void

// Add a mark to a text range
export function addMark(tr, path, startOffset, endOffset, markType) → void

// Remove a specific mark instance
export function removeMark(tr, path, markNodeId) → void

// Check if mark type can be switched (for ToggleMarkCommand.isEnabled)
export function canSwitchMarkType(selectedMarks, availableMarkTypes) → boolean
```

**`toggleMark` algorithm** (from svedit):

1. Get all marks touched by the selection
2. If selection is collapsed, extend to word boundaries
3. Group touched marks by type
4. For each touched type:
   - If exactly one instance exists and it fully contains the selection
     → remove it
   - Otherwise → create a new mark spanning the selection
5. Mutually exclusive: same-type marks cannot overlap
6. If a mark has no properties (e.g. `strong`):
   - One touched same-type mark covering the selection → remove
   - One touched different-type mark covering the selection → switch
     type (delete old, create new)
   - Multiple/mixed → do nothing (disambiguate by clear-first)

### 1.11 Annotation Operations (`engine/AnnotationOps.js`)

```js
// Add an annotation to a text range
export function addAnnotation(tr, path, startOffset, endOffset, annType) → void

// Remove an annotation by its node ID
export function removeAnnotation(tr, path, annNodeId) → void
```

Annotations differ from marks: they may overlap, they are data-only (no
visual rendering by the engine), and they never affect mark toggling.

### 1.12 Selection Model (`engine/SelectionModel.js`)

```js
// Selection types
export const SELECTION_TYPES = { TEXT: 'text', NODE: 'node', PROPERTY: 'property' };

// Validate a selection against session state
// Checks: path exists, offsets within bounds, selection type matches target
export function validateSelection(selection, session) → void  // throws

// Get the normalized range [start_offset, end_offset] from a selection
export function getSelectionRange(selection) → { start_offset, end_offset }

// Check if selection is collapsed (anchor === focus)
export function isSelectionCollapsed(selection) → boolean

// Serialize a DocumentPath to string (for caching, comparison)
export function serializePath(path) → string

// Check a path string segment is valid
export function isPathStringSegmentValid(segment) → boolean

// Assert a path string segment is valid (throws on invalid)
export function assertPathStringSegment(segment) → void
```

### 1.13 Selection Utilities (`engine/SelectionUtils.js`)

```js
// Get marks touched by the current selection
export function getSelectedMarks(schema, doc, selection) → Mark[]

// Get annotations touched by the current selection
export function getSelectedAnnotations(schema, doc, selection) → Annotation[]

// Get the set of mark types that touch the selection
export function getSelectedRangeTypes(ranges, type) → Set<string>
```

### 1.14 Editor Session (`services/EditorSessionService.js`)

The service is the CSMA integration point — it wraps the engine and
publishes events on the EventBus.

```js
class EditorSessionService {
  constructor(eventBus)

  // Initialize with schema, document, and config
  init({ schema, doc, config, selection }) → void

  // Destroy — clear state, unsubscribe
  destroy() → void

  // === Document access ===
  get documentId() → string
  get doc() → Document
  get schema() → DocumentSchema
  get config() → object

  // === Selection ===
  get selection() → Selection | null
  set selection(value) → void      // validates, then publishes EDITOR_SELECTION_CHANGED

  // === Read operations ===
  get(path) → any
  inspect(path) → object
  generateId() → string
  getSelectedNode() → object | null
  getAvailableMarkTypes() → string[]
  getAvailableAnnotationTypes() → string[]
  get selectedMarks() → Mark[]
  get activeMark() → Mark | null
  get selectedAnnotations() → Annotation[]
  get activeAnnotation() → Annotation | null

  // === Mutation ===
  get tr() → Transaction           // Create a new transaction

  apply(transaction, { batch } = {}) → this
    // Validates, swaps doc, updates selection, pushes history
    // Publishes EDITOR_DOCUMENT_CHANGED

  undo() → this
  redo() → this

  // === Undo/redo state ===
  get canUndo() → boolean
  get canRedo() → boolean
  get historyLength() → number
  get historyIndex() → number

  // === Lifecycle ===
  get isInitialized() → boolean
}
```

**History model** (from svedit):

```
history: Array<{
  ops: Op[],              // Forward ops
  inverse_ops: Op[],      // Inverse ops (applied in reverse for undo)
  selection_before: Selection | null,
  selection_after: Selection | null
}>
history_index: number     // -1 = no history, N = at position N
```

**Batching** (from svedit): consecutive `apply(tr, { batch: true })`
calls within a 1000ms window append to the same history entry. Non-batched
applies and applies after the window expire create new entries. This
prevents flood-undo for rapid typing without losing undo granularity.

**`session.apply(transaction)` flow**:

1. `validateTransactionResult(transaction)` — validates only affected
   nodes (created, modified) + nodes that reference deleted/modified IDs
2. If `transaction.ops.length > 0`, swap `this.doc = transaction.doc`
3. Update `this.selection` from `transaction.selection`
4. Truncate future history if undo was used before new edit
5. Push history entry (or merge if batching within window)
6. Publish `EDITOR_DOCUMENT_CHANGED` event

**Validation scope** (from svedit): Full document validation on every
apply is O(n) in node count. Instead, validate only the affected set:
created + modified nodes, plus nodes that reference deleted/modified
nodes (dangling reference check). A full referrer scan is needed only
when deletions or type changes exist.

### 1.15 Command System (`commands/`)

**Base class**:

```js
class Command {
  constructor(context)      // context = { session, editable, … }
  isEnabled() → boolean      // Override — determines if command is active
  execute() → void|Promise   // Override — perform the action
  get disabled() → boolean   // Computed: !isEnabled()
}
```

**Commands implemented**:

| Command | `isEnabled()` check | `execute()` |
|---------|---------------------|-------------|
| `UndoCommand` | `editable && session.canUndo` | `session.undo()` |
| `RedoCommand` | `editable && session.canRedo` | `session.redo()` |
| `ToggleMarkCommand` | `editable && selection && canSwitch` | `tr.toggleMark(type)` → `session.apply(tr)` |
| `InsertNodeCommand` | `editable && inside node_array` | `insertDefaultNode(tr)` → `session.apply(tr)` |
| `DeleteSelectionCommand` | `editable && !selectionCollapsed` | `tr.deleteSelection()` → `session.apply(tr)` |
| `SelectParentCommand` | `editable && path.length > 3` | `session.selectParent()` |
| `BreakNodeCommand` | `editable && text selection in text node` | `breakTextNode(tr)` → `session.apply(tr, {batch:true})` |
| `JoinNodeCommand` | `editable && cursor at pos 0 in text node` | `joinTextNode(tr)` → `session.apply(tr, {batch:true})` |
| `UndoCommand` | `editable && session.canUndo` | `session.undo()` |
| `RedoCommand` | `editable && session.canRedo` | `session.redo()` |

**CommandRegistry**:

```js
class CommandRegistry {
  constructor(session, context)
  register(name, CommandClass)  → void
  get(name)                     → Command
  execute(name)                 → void|Promise
  isEnabled(name)               → boolean
  getAll()                      → { [name]: Command }
}
```

### 1.16 KeyMapper (`input/KeyMapper.js`)

```js
class KeyMapper {
  constructor(commandRegistry)

  // Define a keymap: { keyCombo: 'commandName' }
  // Key combo format: 'Mod+Key' where Mod = Ctrl|Meta
  defineKeymap(map) → void

  // Handle a KeyboardEvent — returns true if handled
  handleKeyEvent(event) → boolean

  // Attach to a DOM element
  attach(element) → void     // adds 'keydown' listener

  // Detach from current element
  detach() → void

  destroy() → void
}
```

**Default keymap** (from svedit):

| Key | Command |
|-----|---------|
| `Mod+z` | `undo` |
| `Mod+Shift+z` / `Mod+y` | `redo` |
| `Mod+b` | `toggleMark:strong` |
| `Mod+i` | `toggleMark:emphasis` |
| `Mod+k` | `toggleMark:link` |
| `Enter` | `breakNode` |
| `Backspace` | `joinNode` or `deleteSelection` |
| `Delete` | `deleteSelection` |
| `Escape` | `selectParent` |

## Phase 2: Rendering Components

**Goal**: Type II CSMA components that render the document model into
editable DOM, synchronize native browser selections with the internal
selection model, and handle user input.

### 2.1 Design Principles for Rendering

1. **CSS handles rendering; JS handles state.** Visual states use
   `data-*` attributes and CSS classes. No inline styles.
2. **`contenteditable` for text, not the whole surface.** Only
   `TextPropertyEditor` uses `contenteditable`. Everything else is
   standard DOM.
3. **Selection sync is bidirectional.** Native DOM selection changes
   → update internal selection. Internal selection changes → restore
   DOM selection.
4. **8-state discipline** on every interactive element.
5. **No innerHTML.** Use `textContent` + `document.createTextNode`.

### 2.2 EditorSurface (`rendering/EditorSurface.js`)

The top-level component that owns the editing mount point.

```js
export function initEditorSurface(eventBus, container, config) {
  // Mounts editor into container element
  // Subscribes to EDITOR_DOCUMENT_CHANGED → re-render
  // Subscribes to EDITOR_SELECTION_CHANGED → update selection overlay
  // Returns cleanup function
}
```

**States**: `[data-state="idle"]`, `[data-state="editing"]`,
`[data-state="readonly"]`, `[data-state="loading"]`.

### 2.3 NodeRenderer (`rendering/NodeRenderer.js`)

Renders a single node based on its type. Uses a registry of type→renderer
mappings.

```js
class NodeRendererRegistry {
  register(nodeType, rendererFn) → void
  render(nodeId, container) → void
  unrender(nodeId) → void
}
```

Each renderer function receives `(node, container, context)` where
`context` = `{ session, eventBus, selection, config }`.

**Built-in renderers**:

| Node kind | Rendered as |
|-----------|-------------|
| `text` | `<div data-node-type="paragraph">` with TextPropertyEditor for `content` + other properties |
| `block` | `<div data-node-type="image">` with CustomProperty fields |
| `document` | Same as block, but top-level |

### 2.4 TextPropertyEditor (`rendering/TextPropertyEditor.js`)

The only `contenteditable` element. Handles text input, selection sync,
and inline mark/annotation rendering.

```js
export function initTextPropertyEditor(container, session, path, config) {
  // Creates a contenteditable div
  // Syncs content on 'input' events → builds Transaction → session.apply
  // Syncs DOM selection ↔ internal selection on 'selectionchange'
  // Renders marks as <span data-mark="strong"> wrappers
  // Returns cleanup function
}
```

**Selection sync strategy** (ported from svedit):

1. On `selectionchange`: read native `window.getSelection()`, map
   anchor/focus nodes + offsets back to internal `DocumentPath` +
   character offsets. Map is done by walking the DOM tree up to find
   the `data-node-id` attribute, then counting characters through
   sibling text nodes and mark wrappers.

2. On internal selection change: deserialize the `DocumentPath` +
   offsets into DOM node + offset, then `range.setStart/setEnd` +
   `selection.removeAllRanges/addRange`.

3. `compositionstart`/`compositionend` events for IME support: suppress
   selection sync during composition.

**Mark rendering**: Marks are rendered as inline `<span>` elements
with `data-mark="strong"` and `data-mark-id="node_123"` attributes.
Marks nest correctly (innermost first).

### 2.5 NodeArrayContainer (`rendering/NodeArrayContainer.js`)

Renders an ordered list of child nodes with gaps for insertion.

```js
export function initNodeArrayContainer(container, session, path, config) {
  // Renders child nodes in order
  // Inserts NodeGapInserter between each pair of children
  // Handles node selection (click to select, Shift+click to range)
  // Returns cleanup function
}
```

States: `[data-state="empty"]` when no children (shows placeholder).

### 2.6 SelectionOverlay (`rendering/SelectionOverlay.js`)

Visual feedback for the current selection — carets, text selections,
and node selections.

```js
export function initSelectionOverlay(container, session) {
  // Subscribes to EDITOR_SELECTION_CHANGED
  // Renders blinking caret for collapsed text selections
  // Renders highlight rectangles for non-collapsed text selections
  // Renders node selection borders for node selections
  // Returns cleanup function
}
```

**Caret**: Absolutely positioned thin div, animated with CSS
`@keyframes blink`. Color from `var(--primary)`.

**Text selection**: Absolutely positioned highlight rectangles using
`getClientRects()` from the native selection.

**Node selection**: `outline` or `box-shadow` on the selected node's
container element.

### 2.7 NodeGapInserter (`rendering/NodeGapInserter.js`)

Between-node insertion targets. Appears on hover between two nodes.

```js
export function initNodeGapInserters(container, session) {
  // Renders thin clickable lines between nodes
  // On click: insert default node type, focus it
  // On hover: shows insertion indicator
  // Returns cleanup function
}
```

States: `[data-state="hidden"]`, `[data-state="visible"]`,
`[data-state="active"]`.

### 2.8 Rendering CSS (`rendering/rendering.css`)

All visual states defined as CSS custom properties + 8-state discipline.

```css
/* Editor surface */
.editor-surface {
  --editor-caret-color: var(--primary);
  --editor-selection-bg: var(--primary-muted);
  --editor-gap-color: var(--border);
  --editor-gap-hover: var(--primary);
  /* … */
}

/* Text property editor */
.text-property[data-state="editing"] { /* … */ }
.text-property[data-state="readonly"] { /* … */ }

/* Mark spans */
[data-mark="strong"] { font-weight: var(--font-weight-bold); }
[data-mark="emphasis"] { font-style: italic; }
[data-mark="link"] { color: var(--primary); text-decoration: underline; }

/* Node gaps */
.node-gap { height: 2px; /* … */ }
.node-gap[data-state="visible"] { /* … */ }
.node-gap[data-state="active"] { /* … */ }

/* Caret blink */
@keyframes editor-caret-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .editor-caret { animation: none; }
}
```

## Phase 3: Integration

### 3.1 Module Manifest (`index.js`)

```js
import { EditorSessionService } from './services/EditorSessionService.js';
import { VisualEditorContracts } from './contracts/visual-editor-contracts.js';

export const manifest = {
  id: 'visual-editor',
  name: 'Visual Editor',
  version: '1.0.0',
  description: 'Structured content editor with typed nodes, transactions, and undo/redo',
  dependencies: [],
  services: ['editorSession'],
  contracts: Object.keys(VisualEditorContracts),
  contributes: {
    commands: [],
    navigation: [],
    panels: [],
    adapters: ['editorContent'],
    views: []
  }
};

export const services = { editorSession: EditorSessionService };
export const contracts = VisualEditorContracts;
export { EditorSessionService };
```

### 3.2 EventBus Contracts (`contracts/visual-editor-contracts.js`)

**Intents** (user/system requests):

```js
export const VisualEditorContracts = {
  // Initialize an editor session with schema + document
  INTENT_EDITOR_INIT: {
    version: 1,
    type: 'intent',
    owner: 'visual-editor',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    security: { rateLimits: { requests: 10, windowMs: 60000, scope: 'session' } },
    description: 'Initialize a visual editor session',
    schema: object({
      editorId: string(),
      schema: object(),              // DocumentSchema
      doc: object(),                // Document
      config: optional(object()),   // Session config
      selection: optional(object()) // Initial selection
    })
  },

  // Destroy an editor session
  INTENT_EDITOR_DESTROY: {
    version: 1,
    type: 'intent',
    owner: 'visual-editor',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    security: { rateLimits: { requests: 10, windowMs: 60000, scope: 'session' } },
    description: 'Destroy a visual editor session',
    schema: object({ editorId: string() })
  },

  // Execute a named command
  INTENT_EDITOR_COMMAND: {
    version: 1,
    type: 'intent',
    owner: 'visual-editor',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
    description: 'Execute an editor command by name',
    schema: object({
      editorId: string(),
      command: string(),
      args: optional(array(any()))
    })
  },

  // Get editor state
  INTENT_EDITOR_GET_STATE: {
    version: 1,
    type: 'intent',
    owner: 'visual-editor',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } },
    description: 'Request current editor state',
    schema: object({ editorId: string() })
  }
};
```

**Events** (state changes emitted by the module):

```js
  // Document changed
  EDITOR_DOCUMENT_CHANGED: {
    version: 1,
    type: 'event',
    owner: 'visual-editor',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Document content changed after transaction applied',
    schema: object({
      editorId: string(),
      documentId: string(),
      ops: array(any()),              // Applied ops (for delta sync)
      canUndo: boolean(),
      canRedo: boolean(),
      timestamp: number()
    })
  },

  // Selection changed
  EDITOR_SELECTION_CHANGED: {
    version: 1,
    type: 'event',
    owner: 'visual-editor',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Editor selection changed',
    schema: object({
      editorId: string(),
      selection: optional(object()),  // null = no selection
      availableMarkTypes: array(string()),
      availableAnnotationTypes: array(string()),
      activeMark: optional(string()),
      activeAnnotation: optional(string()),
      selectedNodeType: optional(string()),
      timestamp: number()
    })
  },

  // Editor ready
  EDITOR_READY: {
    version: 1,
    type: 'event',
    owner: 'visual-editor',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Editor session initialized and ready',
    schema: object({
      editorId: string(),
      documentId: string(),
      schemaNodeTypes: array(string()),
      timestamp: number()
    })
  },

  // Editor state response
  EDITOR_STATE: {
    version: 1,
    type: 'event',
    owner: 'visual-editor',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Current editor state in response to INTENT_EDITOR_GET_STATE',
    schema: object({
      editorId: string(),
      doc: object(),
      selection: optional(object()),
      canUndo: boolean(),
      canRedo: boolean(),
      historyLength: number(),
      historyIndex: number(),
      timestamp: number()
    })
  },

  // Editor error
  EDITOR_ERROR: {
    version: 1,
    type: 'event',
    owner: 'visual-editor',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Editor operation error',
    schema: object({
      editorId: string(),
      error: string(),
      code: optional(string()),
      timestamp: number()
    })
  }
};
```

### 3.3 Editor Content Adapter (`adapters/EditorContentAdapter.js`)

Bridge between `cms-content` module's JSON block format and the
visual-editor's node graph format.

```js
class EditorContentAdapter {
  constructor(eventBus, session)

  // Convert CMS block format → visual-editor document
  static blocksToDocument(blocks, schema) → Document

  // Convert visual-editor document → CMS block format
  static documentToBlocks(doc, schema) → Block[]

  // Load content from cms-content module into editor
  async loadContent(contentId, schema) → Document

  // Save editor content back to cms-content module
  async saveContent(contentId) → void
}
```

**Conversion strategy**:
- Each CMS block type maps to a node type in the editor schema
- Flat block arrays → `node_array` body property
- Block properties → node properties
- Nested blocks → child nodes with references
- Lossless round-trip for known block types; unknown types become
  `UnknownNode` placeholders

### 3.4 Feature Flag

Add to `src/runtime/features.js`:

```js
'visual-editor': {
  feature: 'visual-editor',
  module: 'visual-editor',
  defaultEnabled: false
}
```

Load in the editorial/authoring wave (after `cms-content`, before
`content-workflow`).

### 3.5 Module Dependencies

| Depends on | Why |
|---|---|
| _(none required)_ | Core engine has no dependencies |
| `cms-content` (optional) | EditorContentAdapter bridges content loading |
| `content-workflow` (optional) | Publish/draft workflow consumes editor state |
| `ai-ui` (optional) | AI composer could generate/transform document nodes |

## File Inventory

| File | Source reference (svedit) | Estimated size | Phase |
|------|--------------------------|----------------|-------|
| `engine/DocumentSchema.js` | `doc_utils.js` (partial) | ~200 lines | 1 |
| `engine/DocumentDefaults.js` | `doc_utils.js` (partial) | ~100 lines | 1 |
| `engine/DocumentModel.js` | `doc_utils.js` + `types.d.ts` | ~250 lines | 1 |
| `engine/NodeValidator.js` | `doc_utils.js` (validate_node) | ~300 lines | 1 |
| `engine/ReferenceTraversal.js` | `doc_utils.js` + `utils.js` | ~150 lines | 1 |
| `engine/TextOperations.js` | `utils.js` (partial) | ~200 lines | 1 |
| `engine/Transaction.js` | `Transaction.svelte.js` | ~600 lines | 1 |
| `engine/TransactionOps.js` | `doc_utils.js` (apply ops) | ~250 lines | 1 |
| `engine/Transforms.js` | `transforms.svelte.js` | ~150 lines | 1 |
| `engine/MarkOps.js` | `Transaction.svelte.js` (partial) + `doc_utils.js` | ~200 lines | 1 |
| `engine/AnnotationOps.js` | `Transaction.svelte.js` (partial) | ~80 lines | 1 |
| `engine/SelectionModel.js` | `utils.js` + `types.d.ts` | ~150 lines | 1 |
| `engine/SelectionUtils.js` | `doc_utils.js` (partial) | ~100 lines | 1 |
| `services/EditorSessionService.js` | `Session.svelte.js` | ~400 lines | 1 |
| `commands/Command.js` | `Command.svelte.js` | ~80 lines | 1 |
| `commands/CommandRegistry.js` | new | ~100 lines | 1 |
| `commands/UndoCommand.js` | `Command.svelte.js` (partial) | ~20 lines | 1 |
| `commands/RedoCommand.js` | `Command.svelte.js` (partial) | ~20 lines | 1 |
| `commands/ToggleMarkCommand.js` | `Command.svelte.js` (partial) | ~50 lines | 1 |
| `commands/InsertNodeCommand.js` | `transforms.svelte.js` | ~40 lines | 1 |
| `commands/DeleteSelectionCommand.js` | new | ~30 lines | 1 |
| `commands/SelectParentCommand.js` | `Command.svelte.js` (partial) | ~20 lines | 1 |
| `commands/BreakNodeCommand.js` | new (wraps breakTextNode) | ~30 lines | 1 |
| `commands/JoinNodeCommand.js` | new (wraps joinTextNode) | ~30 lines | 1 |
| `input/KeyMapper.js` | `KeyMapper.svelte.js` | ~150 lines | 1 |
| `rendering/EditorSurface.js` | new | ~200 lines | 2 |
| `rendering/NodeRenderer.js` | `Node.svelte` + `CustomProperty.svelte` | ~250 lines | 2 |
| `rendering/TextPropertyEditor.js` | `TextProperty.svelte` | ~400 lines | 2 |
| `rendering/NodeArrayContainer.js` | `NodeArrayProperty.svelte` | ~250 lines | 2 |
| `rendering/SelectionOverlay.js` | `NodeCaret.svelte` + `NodeSelectionMarkers.svelte` | ~200 lines | 2 |
| `rendering/NodeGapInserter.js` | `NodeGap.svelte` | ~200 lines | 2 |
| `rendering/rendering.css` | new | ~300 lines | 2 |
| `ui/EditorToolbar.js` | new (optional UI) | ~100 lines | 2 |
| `ui/editor-toolbar.css` | new | ~80 lines | 2 |
| `contracts/visual-editor-contracts.js` | new | ~200 lines | 3 |
| `adapters/EditorContentAdapter.js` | new | ~150 lines | 3 |
| `index.js` | module pattern | ~20 lines | 3 |
| `README.md` | module pattern | ~60 lines | 3 |
| **Total** | | **~5,700 lines** | |

## Test Strategy

### Phase 1 Tests (engine)

All engine tests are pure JS — no browser needed. Run with Vitest.

**`tests/visual-editor-engine.test.js`**:

1. **Schema validation**
   - Valid schema passes `validateDocumentSchema`
   - Missing referenced node type throws
   - Missing referenced mark type throws
   - `kind: 'text'` without `content` property throws
   - `kind: 'text'` with multiple text properties throws
   - Custom defaults respected

2. **Document validation**
   - Valid document passes `validateDocument`
   - Missing required property throws
   - Wrong property type throws
   - Invalid node reference throws
   - Cycle detection catches self-references and indirect cycles
   - `fillNodeDefaults` fills all missing optional properties
   - `fillDocumentDefaults` fills across entire document

3. **Document model**
   - `docGet` resolves node by ID
   - `docGet` resolves nested property paths
   - `docGet` resolves array indices in `node_array`
   - `docInspect` returns correct kind and metadata
   - `docPropertyType` returns correct type strings
   - `docKind` classifies all five kinds

4. **Node validation**
   - Valid node passes
   - Invalid ID throws
   - ID with `__` throws
   - Marks with overlapping same type throws
   - Marks with out-of-bounds offsets throws
   - `requireReferences: false` skips reference checks

5. **Text operations**
   - `splitText` at position 0 → empty left
   - `splitText` at position N → correct split with adjusted marks
   - Splitting inside a mark bisects it
   - `joinText` concatenates content and adjusts marks
   - `charSlice` adjusts mark offsets correctly
   - `adjustRangesForDeletion` removes zero-width ranges
   - `adjustRangesForInsertion` shifts ranges correctly

6. **Transaction — create**
   - Creates node in draft
   - Records create op + delete inverse op
   - Tracks created_node_ids
   - Fills defaults for omitted properties
   - Throws on duplicate ID
   - Throws on invalid node

7. **Transaction — set**
   - Sets property in draft
   - Records set op + set inverse op with old value
   - Tracks modified_node_ids
   - Throws on non-property path
   - Throws on wrong value type
   - Cascade-deletes orphaned node references

8. **Transaction — delete**
   - Removes node from draft
   - Records delete op + create inverse op
   - Tracks deleted_node_ids
   - Cascade-deletes orphaned referenced nodes
   - No-op on non-existent ID (warns)

9. **Transaction — build**
   - Deep-clones subgraph with new IDs
   - Remaps all internal references
   - Fills defaults on new nodes
   - Returns the new root ID

10. **Transaction — marks**
    - `toggleMark` on collapsed selection extends to word
    - `toggleMark` adds mark spanning selection
    - `toggleMark` removes mark fully containing selection
    - `toggleMark` switches mark type when single different-type mark touched
    - `toggleMark` does nothing for mixed touched types
    - Same-type marks stay mutually exclusive

11. **Transaction — deleteSelection**
    - Deletes selected text range
    - Adjusts marks/annotations after deletion
    - Deletes selected nodes from node_array
    - No-op on collapsed selection

12. **Transforms**
    - `breakTextNode` splits paragraph at cursor
    - `breakTextNode` respects default_node_type
    - `breakTextNode` returns false outside text nodes
    - `joinTextNode` joins with previous sibling
    - `joinTextNode` returns false at non-zero cursor position
    - `setProperties` sets multiple properties in one tr

13. **Session — apply/undo/redo**
    - `apply` swaps doc and updates selection
    - `apply` pushes history entry
    - `undo` restores previous state
    - `redo` restores next state
    - `undo` + new edit truncates future history
    - `canUndo`/`canRedo` reflect correct state
    - Batching merges ops within 1000ms window
    - Non-batched apply starts new history entry
    - Non-document ops (selection-only) don't trigger doc swap

14. **Selection model**
    - Valid text selection passes
    - Out-of-bounds offsets throw
    - Non-existent path throws
    - `isSelectionCollapsed` correct for equal offsets
    - `getSelectionRange` normalizes anchor/focus order
    - `getSelectedMarks` returns only touching marks
    - `getSelectedAnnotations` returns only touching annotations

15. **Commands**
    - `UndoCommand.isEnabled` reflects `session.canUndo`
    - `ToggleMarkCommand.isEnabled` reflects selection state
    - `CommandRegistry.execute` calls command.execute
    - KeyMapper dispatches to CommandRegistry

### Phase 2 Tests (rendering)

Browser tests — use Vitest with jsdom or Playwright.

**`tests/visual-editor-rendering.test.js`**:

1. EditorSurface mounts and unmounts cleanly
2. NodeRenderer renders text node with contenteditable
3. NodeRenderer renders block node with custom properties
4. TextPropertyEditor syncs content to session on input
5. TextPropertyEditor renders marks as spans
6. NodeArrayContainer renders children in order
7. NodeArrayContainer shows empty state when no children
8. SelectionOverlay shows caret for collapsed selection
9. SelectionOverlay hides for null selection
10. NodeGapInserter triggers insert on click
11. Keyboard: Enter breaks text node
12. Keyboard: Backspace at position 0 joins nodes
13. Keyboard: Mod+b toggles bold
14. Keyboard: Mod+z undoes last change

### Phase 3 Tests (integration)

**`tests/visual-editor-integration.test.js`**:

1. Module loads through ModuleManager
2. Contracts registered correctly
3. EditorContentAdapter round-trips blocks → nodes → blocks
4. EDITOR_DOCUMENT_CHANGED fires with correct shape
5. EDITOR_SELECTION_CHANGED fires on selection change
6. INTENT_EDITOR_COMMAND routes to CommandRegistry
7. Teardown: destroy() removes all listeners
8. Multiple editor instances are isolated
9. Integration with cms-content: load → edit → save

## Dependencies on Other Modules

| Module | Relationship |
|--------|-------------|
| `cms-content` | EditorContentAdapter bridges content ↔ editor. Loads content blocks, converts to editor document, saves back. Optional — visual-editor works standalone with direct document injection. |
| `content-workflow` | Consumes EDITOR_DOCUMENT_CHANGED to track dirty state. Provides draft/publish/review status. Optional. |
| `ai-ui` | AI composer could generate/transform document nodes via INTENT_EDITOR_COMMAND. Optional. |
| `form-management` | Editor can render form fields within content. Optional integration point. |
| `storage` | Local draft persistence via IndexedDB. Optional auto-save. |
| `sync-queue` | Queued persistence of editor changes to backend. Optional. |
| `network-status` | Offline indicator. Optional. |
| `auth` | Gating editability on auth state. Optional. |
| `notifications` | Edit conflict notifications. Optional. |

None are hard dependencies — the engine is self-contained.

## Acceptance Criteria

For the module to be considered complete:

### Phase 1 (Core Engine)

- [ ] All engine files exist under `src/modules/visual-editor/engine/`
- [ ] `EditorSessionService` loads via ModuleManager
- [ ] Schema definition, validation, and defaults work correctly
- [ ] Document creation, validation, and traversal work correctly
- [ ] Transaction create/set/delete/build produce correct ops + inverse ops
- [ ] Transaction COW draft does not mutate original document
- [ ] Mark toggle produces correct document state for all edge cases
  (collapsed, expanded, mixed, empty)
- [ ] Text operations (split, join, slice) correctly adjust mark/annotation
  offsets
- [ ] Session apply/undo/redo produce correct document state
- [ ] History batching merges within 1000ms window
- [ ] `canUndo`/`canRedo` reflect correct state after every mutation
- [ ] All Commands execute correctly through CommandRegistry
- [ ] KeyMapper dispatches defined key combos to correct commands
- [ ] Module contracts are registered and validate payloads
- [ ] `destroy()` cleans up all subscriptions and state
- [ ] Phase 1 tests pass (15 groups, ~80 test cases)
- [ ] No inline styles in any source
- [ ] No `innerHTML` usage
- [ ] Zero dependencies on Svelte or any framework
- [ ] `npm run security-check` passes
- [ ] `npm audit` has zero vulnerabilities
- [ ] Module documented in `docs/visual-editor-module.md` (this document)

### Phase 2 (Rendering)

- [ ] EditorSurface mounts and renders document into DOM
- [ ] TextPropertyEditor provides contenteditable text input
- [ ] Text input syncs to session via transactions
- [ ] Marks render as styled spans
- [ ] NodeArrayContainer renders child nodes in order with gaps
- [ ] SelectionOverlay shows caret and text/node selections
- [ ] NodeGapInserter allows insertion between nodes
- [ ] Keyboard shortcuts trigger correct commands
- [ ] Undo/redo keyboard shortcuts work
- [ ] 8-state discipline applied to all interactive elements
- [ ] All CSS uses `var(--token)` — no raw colors/pixels
- [ ] Respects `prefers-reduced-motion`
- [ ] Renders correctly in light, dark, and contrast themes
- [ ] Phase 2 tests pass

### Phase 3 (Integration)

- [ ] EditorContentAdapter converts cms-content blocks ↔ editor documents
  losslessly for known block types
- [ ] Module loads behind feature flag only
- [ ] Multiple editor instances are isolated (separate sessions)
- [ ] All EventBus contracts validated
- [ ] Integration with cms-content module verified
- [ ] Phase 3 tests pass
- [ ] `npm run build` succeeds
- [ ] `npm run verify:frontend-routes` passes

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| **Selection ↔ DOM mapping complexity** (svedit's Svedit.svelte is 58KB) | Phase 2 only implements text selection mapping. Node/property selection deferred. Use `contenteditable` + `window.getSelection()` which is well-understood. |
| **Performance with large documents** | COW draft (not full clone per op). `validateTransactionResult` validates only affected nodes, not full document. Viewport culling (deferred to Phase 2 rendering). |
| **Mark rendering and nesting** | Marks render as flat spans with `data-mark` attributes. Nesting complexity avoided — CSS handles visual layering. |
| **IME/composition support** | `compositionstart`/`compositionend` event handling from svedit. Browser-tested pattern. |
| **Cross-browser contenteditable quirks** | Use the svedit team's known workarounds (documented in their codebase). Default to Chromium+Firefox; Safari is tier 2. |
| **Round-trip fidelity with cms-content blocks** | Explicit conversion functions with tests. Unknown block types become `UnknownNode` — never silently dropped. |
| **Module size** (~5,700 lines) | Engine (~3,200 lines) can ship independently. Rendering (~2,000 lines) is opt-in. Contracts/adapters (~500 lines). |

## What Is NOT Included

Deliberately out of scope for the CSMA module:

- **Collaborative editing** (OT/CRDT). Requires backend companion.
- **Rich paste from external sources** (HTML → nodes). Requires a
  paste sanitizer. svedit has `paste_utils.js` as reference.
- **Drag-and-drop node reordering**. Can be added as a separate
  rendering component later.
- **Image/media upload integration**. Delegate to `file-upload` module.
- **Table editing**. Tables are complex enough to warrant their own
  node renderers — deferred.
- **Backend persistence**. The module is frontend-only. Persistence
  is the responsibility of `cms-content`, `sync-queue`, or a backend
  companion.
- **Real-time preview**. The module edits a document model; preview
  rendering is a separate consumer.
- **Toolbar UI**. `EditorToolbar.js` is a minimal reference
  implementation. Full toolbar design is app-specific.
