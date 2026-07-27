# Plan — `mindmap` module

> Status: building — phases 1–3, 7–8 complete. Phases 10–19 define the
> interactive surface (click, keyboard, drag, pan/zoom, context menu).
> Gap analysis vs mind-elixir-core completed 2025-07-25.
> Order: **3 of 3** (after `history` and `agent-context`).

## Goal

Interactive, local-first mindmap for the MorphMap project, built
natively on CSMA. Headless: we port only the layout math from
`mind-elixir-core` and let CSMA own all DOM, state, persistence, and
undo/redo. The map is the source of truth in IndexedDB; markdown is a
derived serialization format used solely for agent context, never for
runtime rendering or storage.

## Background

The earlier `README.md` (still on disk) was confused in three ways:

1. It imported `mind-elixir/lite`, which renders its own DOM via custom
   elements — not actually headless.
2. It treated SQLite / SSMA / Rust core as a near-term concern; this is
   out of scope for v1 (local-first single user).
3. It implied markdown was the runtime model (leftover from the abandoned
   markmap approach at `~/Documents/vibe/markmap`). It is not — markdown
   is one of several agent-context formats.

This plan supersedes that design. The old README is preserved at the
bottom of this file under **Archived design (superseded)**.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Agent transport day 1 | In-browser API only | Ship surface first; MCP later |
| History migration | Hard cut | CSMA still in development, breakage OK |
| v1 scope | All 8 features | View, edit, status, collapse, undo/redo, drag, multi-map, search |
| mind-elixir vendoring | Port to plain JS | Full control over ~450 LOC core, no build coupling |

## Dependencies

- **Consumes:**
  - `history` — undo/redo + op log
  - `agent-context` — registers serializers for the `maps` store
  - `ai-ui` — secure component composer (mounts `mind-node`, etc.)
  - `storage` — IDB primitive
  - `runtime/EventBus`, `runtime/Contracts`, `runtime/ModuleManager`
- **Consumed by:** tile host shells / compositors (future), MCP bridge (future).

## Architecture

```
src/modules/mindmap/
├── plan.md                              ← this file
├── README.md                            ← written at end of phase 20
├── index.js                             ← manifest + service export + serializers
├── contracts/
│   └── mindmap-contracts.js             ← MINDMAP_* event schemas
├── services/
│   ├── MindmapService.js                ← tree CRUD, EventBus, history integration
│   ├── MindmapStore.js                  ← IDB adapter (uses storage module)
│   ├── LayoutEngine.js                  ← ported from mind-elixir layout.ts
│   ├── ConnectorGeometry.js             ← ported from svg.ts + generateBranch.ts
│   ├── MarkdownCodec.js                 ← NodeObj tree ↔ markdown (context only)
│   ├── Search.js                        ← in-map filter / fuzzy match
│   ├── KeyboardHandler.js               ← keydown → service calls (phase 11)
│   └── ViewportController.js            ← pan/zoom transform state (phase 13)
├── serializers/
│   ├── toMarkdown.js                    ← registered with agent-context
│   ├── toAscii.js
│   └── toMinimalJson.js
├── ui/
│   └── ContextMenu.js                   ← right-click menu (phase 17)
├── i18n/
│   └── mindmap-en.json                  ← English labels (phase 18)
└── vendor/
    └── MIND_ELIXIR_LICENSE              ← MIT, attribution for the port

src/ui/components/
├── mind-node/      { manifest.json, mind-node.css, mind-node.demo.html }
├── mind-node/        { manifest.json, mind-node.css, mind-node.demo.html }
└── connector-line/   { manifest.json, connector-line.css, connector-line.demo.html }
```

## What we port from `mind-elixir-core`

| Source file | LOC | What we keep | What we drop |
|---|---|---|---|
| `src/utils/layout.ts` | 97 | Tree → x,y positioning, subtree height calc, left/right split | — |
| `src/utils/svg.ts` | 244 | SVG path helpers between two rectangles | DOM-dependent helpers |
| `src/utils/generateBranch.ts` | 107 | Parent → child connector `d` attribute | Direct DOM writes |
| `src/utils/layout-ssr.ts` | 321 | Reference for the DOM-free layout call signature | We write our own thin wrapper |
| `src/types/index.ts` | 245 | `NodeObj` shape (adapted; see below) | TS-specific syntax |

Total ported logic: ~**450 LOC** as plain ES modules. MIT license preserved
in `vendor/MIND_ELIXIR_LICENSE`; each ported file gets a header comment
attributing `mind-elixir-core` and linking the upstream.

**We do NOT port / do NOT import:** `index.ts`, `methods.ts`,
`nodeOperation.ts`, `linkDiv.ts`, `interact.ts`, `mouse.ts`, or anything
under `src/plugin/` (context menu, toolbar, keypress, draggable,
operation history, selection, export image). CSMA replaces all of these.

## NodeObj shape (runtime model)

```js
{
  id: string,                            // crypto.randomUUID()
  topic: string,
  schemaType: 'mindmap/branch' | 'mindmap/leaf',
  status: 'pending' | 'in_progress' | 'done' | 'blocked' | 'abandoned',
  tag?: 'module' | 'feature' | 'phase' | 'research' | 'brainstorm' | 'log',
  children: NodeObj[],                   // branches only; leaves have []
  expanded: boolean,                     // branches only
  direction: 0 | 1,                      // branches only (0 right, 1 left)
  metadata: {
    specPath?: string,                   // leaves: link to .spec file
    bottleneck?: 'blocking' | 'risky' | 'standard' | 'time' | 'verify',
    note?: string,
    leafCount: number,                   // branches: derived
    doneCount: number,                   // branches: derived
  },
  updatedAt: number
}
```

## Storage design (IDB)

Two stores in the same CSMA DB:

| Store | Key | Value | Purpose |
|---|---|---|---|
| `maps` | `mapId` | `{ id, name, rootId, updatedAt }` | Map metadata index |
| `map_nodes` | `nodeId` | `NodeObj` | One record per node |

**Why per-node, not per-map snapshot:** multi-map + drag-drop reorder
benefit from granular writes; node-level records also let search and
filter queries hit just the relevant subset without loading whole maps.

History module writes to its own store (`map_ops`, managed by the
history module, not by mindmap). Mindmap calls `history.record('mindmap',
{ op, nodeId, before, after })` on every mutating call; undo/redo
replays the inverse.

**v1 does NOT implement:** SSMA gateway sync, SQLite mirror, multi-device
conflict resolution. Single-user local only.

## Public API — `MindmapService`

```js
class MindmapService {
  init({ eventBus, storage, history, agentContext, aiui }) {}
  destroy() {}

  // maps
  createMap(name) → mapId
  listMaps() → MapInfo[]
  loadMap(mapId) → NodeObj (root)
  deleteMap(mapId) → void

  // nodes (each records to history, fires event)
  addBranch(parentId, topic, meta?) → NodeObj
  addLeaf(parentId, topic, meta?) → NodeObj
  updateNode(nodeId, changes) → NodeObj
  updateStatus(nodeId, status) → NodeObj
  removeNode(nodeId) → { removed: nodeId[], cascaded: string[] }
  moveNode(nodeId, newParentId, index?) → NodeObj

  // structure
  collapse(nodeId, collapsed) → void
  findNode(nodeId) → NodeObj | null
  getSubtree(nodeId, { maxDepth }) → NodeObj

  // undo/redo (proxies history module)
  undo() → { op, nodeId } | null
  redo() → { op, nodeId } | null
  canUndo() / canRedo() → bool

  // search
  search(mapId, query, { status?, tag? }) → SearchResult[]

  // serialization (registered with agent-context, also callable directly)
  toMarkdown(mapId, { filter, depth } = {}) → string
  toAscii(mapId, opts) → string
  toMinimalJson(mapId, opts) → object
}
```

## Contracts

```js
MINDMAP_NODE_ADDED         // { mapId, nodeId, parentId, node }
MINDMAP_NODE_REMOVED       // { mapId, nodeId, cascaded: string[] }
MINDMAP_NODE_UPDATED       // { mapId, nodeId, changes, previousStatus? }
MINDMAP_STRUCTURE_CHANGED  // { mapId, nodeId, operation, details }
MINDMAP_NODE_MOVED         // { mapId, nodeId, fromParent, toParent, index }
MINDMAP_COLLAPSED          // { mapId, nodeId, collapsed }
MINDMAP_MAP_CREATED        // { mapId, name }
MINDMAP_MAP_DELETED        // { mapId }
```

All validated via `runtime/Contracts`. Unknown events default-denied.

## Agent-context serializers

Registered in `mindmap/index.js` manifest:

```js
contributes: {
  contextSerializers: [
    { store: 'map_nodes', format: 'markdown', fn: 'toMarkdown',
      label: 'Mindmap (markdown)', default: true },
    { store: 'map_nodes', format: 'ascii', fn: 'toAscii',
      label: 'Mindmap (ascii tree)' },
    { store: 'map_nodes', format: 'json', fn: 'toMinimalJson',
      label: 'Mindmap (minimal JSON)' }
  ]
}
```

Markdown output shape (token-efficient for LLMs):

```markdown
## e2e-test 🔄 [phase]  (3/5)
- ✅ init + plan + delegate verified
- ✅ scout: recon · researcher: research
- ⬜ test /morphmap-review
  - 🔴 blocking
```

Rules: nesting via indentation, status emoji inline, no UUIDs, counts
inline on branch headers, filterable by status/tag.

## Implementation phases

### Phase 1 — Port layout (no CSMA coupling)

1. Hand-port `layout.ts` → `LayoutEngine.js` as pure functions: given a
   `NodeObj` tree + options, return `{ nodes: [{id, x, y, w, h}],
   links: [{from, to}] }`.
2. Hand-port `svg.ts` + `generateBranch.ts` → `ConnectorGeometry.js`:
   given two rectangles, return an SVG path `d` attribute.
3. Vendored files include header attribution + pointer to
   `vendor/MIND_ELIXIR_LICENSE`.

**Test:** `tests/mindmap/layout-engine.test.js` — golden layouts for
small known trees (root with 3 branches, branch with 5 leaves, deep
3-level tree, left/right split). All deterministic: same input → same
output bytes.

### Phase 2 — Components (Type I, CSS-only state)

1. Run `npm run create-component mind-node`, `mind-node`,
   `connector-line`.
2. Author CSS per the spec in `plan/components.md` (existing file, kept).
   States via `data-status`. All visual variables come from generated
   design tokens — no inline styles.
3. Write `.demo.html` for each with hardcoded sample NodeObj data.

**Test:** visual inspection in `showcase/`-style standalone page; contract
test asserts each component has a manifest, a CSS file, and renders
without errors in jsdom.

### Phase 3 — MindmapService skeleton

1. Implement `MindmapService.js` with `init`, map CRUD, node CRUD.
2. Wire EventBus events per the contracts above. Every mutator records
   to history via `history.record('mindmap', { ... })`.
3. Implement `MindmapStore.js` (IDB adapter over `storage` module for
   `maps` and `map_nodes` stores).

**Test:** `tests/mindmap/mindmap-service.test.js` — create map, add
branch, add leaf, update status, remove cascades, all events fire with
valid payloads.

### Phase 4 — Render loop (ai-ui integration)

1. On `loadMap`, traverse tree, call `LayoutEngine`, then ask `ai-ui` to
   mount `mind-node` / `mind-node` components at computed positions.
2. Draw `connector-line` SVG paths via `ConnectorGeometry` into a single
   SVG layer.
3. On any `MINDMAP_*` event, recompute affected layout region and update
   DOM via `ai-ui` ops (no full re-render).

**Test:** `tests/mindmap/render.test.js` (jsdom) — after `addBranch`,
the DOM contains one new mind-node element with correct
`data-status`; after `removeNode`, the element is gone.

### Phase 5 — Undo/redo + collapse + status

1. Implement `undo()` / `redo()` as proxies to `history`, applying the
   inverse op to the in-memory tree and IDB.
2. Implement `collapse()` / `expand()` — purely visual (CSS class + layout
   recompute), still recorded to history.
3. Wire keyboard shortcuts (via CSMA keyboard module when present,
   fallback to direct listeners).

**Test:** `tests/mindmap/undo-redo.test.js` — record sequence of 10
ops, undo to start, redo to end, tree matches original. Collapse events
round-trip.

### Phase 6 — Drag-drop reorder (SUPERSEDED — see Phase 14)

> **Note (2025-07-25):** The original plan assumed HTML5 drag-drop on
> individual elements. After reviewing mind-elixir-core's
> `nodeDraggable.ts`, the correct approach is pointer-event-driven drag
> with a ghost element, insert-preview indicators, and edge auto-scroll.
> Phase 14 below replaces this phase entirely.

1. ~~Implement HTML5 drag-drop on `mind-node` / `mind-node`~~ —
   **replaced** by pointer-event drag in Phase 14.
2. ~~On drop, call `moveNode`~~ — kept, but trigger is pointer-up on ghost.

### Phase 7 — Multi-map + search

1. Multi-map: `listMaps`, `loadMap`, `deleteMap`, switch active map.
2. `Search.js` — fuzzy match over `topic` + filter by `status` / `tag`;
   returns `SearchResult[]` with path-from-root for highlighting.

**Test:** `tests/mindmap/search.test.js` — fuzzy match scoring, filter
combinations, empty result handling.

### Phase 8 — Markdown codec + agent-context registration

1. Implement `MarkdownCodec.js` + `toMarkdown`, `toAscii`, `toMinimalJson`
   serializers.
2. Register via manifest `contributes.contextSerializers` (verified
   working in the agent-context plan).
3. Manual test: call `agentContext.get({ store: 'map_nodes', format:
   'markdown' })` from a demo page, observe compact text output.

**Test:** `tests/mindmap/markdown-codec.test.js` — round-trip
(NodeObj → markdown → parse → NodeObj) preserves tree shape, statuses,
tags. Filter test: `filter: { status: ['blocked'] }` returns only
matching branches/leaves.

### Phase 9 — Demo page (v1, partial)

1. ✅ `demo/mindmap.html` — standalone page with sample MorphMap data.
2. ⬜ Write `mindmap/README.md` (concise — supersedes this plan).
3. ⬜ Update `docs/architecture/SKILL.md` and `docs/patterns/SKILL.md`.

> **Note (2025-07-25):** The demo page is a debug harness — buttons
> exercise the service layer, but the canvas has zero interactive
> behaviour (no click, no keyboard, no drag, no pan/zoom). Phases 10–19
> add the interaction surface. Phase 20 ships the final demo v2.

---

## Interaction layer (phases 10–19)

> These phases fill the gap identified in the 2025-07-25 comparison
> with mind-elixir-core. CSMA provides reusable infra (EventBus,
> Contracts, History, i18n, design tokens, overlay-manager) and a
> proven keyboard pattern (visual-editor KeyMapper). The canvas
> interaction layer — pointer events, drag, pan/zoom, context menu —
> is entirely new code.

### Phase 10 — Click selection + double-click edit + inline editing

**Motivation:** mind-elixir-core `mouse.ts` → `handlePointerDown`,
`handleDoubleClick`, `nodeOperation.ts` → `beginEdit`. The demo has
no way to select a node by clicking it or edit its text in place.

1. Add `selected` data attribute to mind-node / mind-node CSS
   (outline + accent colour from design tokens).
2. Single-click on a node → clear previous selection, set `data-selected`
   on the clicked element, fire `MINDMAP_NODE_SELECTED` event.
3. Ctrl/Cmd-click → toggle selection (multi-select). Publish
   `MINDMAP_NODES_SELECTED` with array of selected node IDs.
4. Double-click on a selected node → open inline edit:
   - Replace node text with a contentEditable span or input.
   - Enter or blur commits → call `updateNode(nodeId, { topic })`.
   - Escape cancels → restore original text.
5. Click on empty canvas area → clear selection.

**New service methods:** none (UI-only behaviour, uses existing
`updateNode`).

**New contracts:**
```js
MINDMAP_NODE_SELECTED     // { mapId, nodeId }
MINDMAP_NODES_SELECTED    // { mapId, nodeIds: string[] }
MINDMAP_SELECTION_CLEARED // { mapId }
MINDMAP_NODE_EDIT_START   // { mapId, nodeId }
MINDMAP_NODE_EDIT_END     // { mapId, nodeId, committed: boolean }
```

**Test:** `tests/mindmap/selection.test.js` — click selects, ctrl-click
multi-selects, canvas click clears, double-click opens editor, Enter
commits, Escape cancels.

### Phase 11 — Keyboard navigation + shortcuts

**Motivation:** mind-elixir-core `plugin/keypress.ts` — full keyboard
control. CSMA has the `KeyMapper.js` pattern from visual-editor to
reuse, but the key handlers themselves are mindmap-specific.

1. Create `services/KeyboardHandler.js` — a class that attaches
   `keydown` on the canvas container and dispatches to service calls.
   Follow the `KeyMapper` pattern (normalize Mod key, defineKeymap).
2. Default keymap:

| Key | Action |
|-----|--------|
| ArrowUp / ArrowDown | Move selection to prev/next sibling |
| ArrowLeft / ArrowRight | Move selection to parent / first child |
| Enter | Insert sibling after selected node |
| Shift+Enter | Insert sibling before selected node |
| Ctrl/Cmd+Enter | Insert parent (wrap selected) |
| Tab | Add child to selected node |
| Delete / Backspace | Remove selected node(s) |
| F1 | Center map (toCenter) |
| F2 | Begin inline edit on selected node |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Y / Ctrl+Shift+Z | Redo |
| Ctrl/Cmd+C | Copy selected nodes to clipboard |
| Ctrl/Cmd+X | Cut selected nodes |
| Ctrl/Cmd+V | Paste as children of selected node |
| Ctrl/Cmd+= | Zoom in |
| Ctrl/Cmd+- | Zoom out |
| Ctrl/Cmd+0 | Reset zoom to 1.0 |
| Ctrl/Cmd+K then Ctrl+0 | Collapse all branches |
| Ctrl/Cmd+K then Ctrl+= | Expand all branches |
| Ctrl/Cmd+K then 1–9 | Expand to depth N |
| Ctrl+ArrowLeft/Right | Switch to left-only / right-only layout |
| Ctrl+ArrowUp | Switch to side (both) layout |
| Ctrl+ArrowDown | Switch to top-down layout |
| Alt+ArrowUp / PageUp | Move selected node up (reorder) |
| Alt+ArrowDown / PageDown | Move selected node down (reorder) |

3. Keyboard handler publishes a `MINDMAP_KEYBOARD_SHORTCUT` event for
   debugging / extensibility.
4. Handler is disabled when inline editing is active (pass-through).

**New service methods needed:**
```js
insertSibling(nodeId, position)  // 'before' | 'after'
insertParent(nodeId)             // wrap node in new parent
moveUp(nodeId)                   // reorder sibling up
moveDown(nodeId)                 // reorder sibling down
copyNodes(nodeIds)               // deep-clone to clipboard stash
pasteNodes(nodeIds, parentId)    // paste stashed nodes
```

**Test:** `tests/mindmap/keyboard.test.js` — dispatch synthetic
KeyboardEvents, assert correct service method called.

### Phase 12 — Box/marquee selection + Ctrl multi-select

**Motivation:** mind-elixir-core `plugin/selection.ts` (uses viselect
library). Selecting multiple nodes at once is essential for batch
operations (delete, move, copy, summary).

1. Integrate `viselect` (same library mind-elixir uses, ~10 KB) or
   implement a minimal box-select (~60 lines):
   - Pointer-down on canvas background → track pointer-move → draw
     selection rectangle.
   - On pointer-up, find all node elements intersecting the rectangle.
   - Select them (set `data-selected`, publish `MINDMAP_NODES_SELECTED`).
   - With Ctrl/Cmd held, add to existing selection; without, replace.
2. No new service methods needed. Purely UI behaviour.
3. Selection rectangle styled via design tokens (semi-transparent
   accent background, accent border).

**Test:** `tests/mindmap/box-select.test.js` — simulate pointer events
over jsdom, assert correct nodes selected.

### Phase 13 — Pan + zoom

**Motivation:** mind-elixir-core `mouse.ts` (panHelper),
`interact.ts` (scale, move, toCenter), `plugin/keypress.ts`
(handleWheelZoom). The demo has static `overflow: auto` —
unacceptable for a real mindmap.

1. Wrap the node layer in a transform group (CSS `transform:
   translate(x, y) scale(s)` on the `.node-layer` element). SVG
   connector layer gets the same transform.
2. Pan:
   - Mouse wheel (without Ctrl) → `move(-deltaX, -deltaY)`.
   - Shift+wheel → horizontal pan only.
   - Space + mouse drag → grab-pan (change cursor to `grab`/`grabbing`).
   - Touch drag (single finger) → pan.
3. Zoom:
   - Ctrl+wheel → cursor-centered scale with min/max limits (0.2–1.4).
     Math: `scale(newScale, {x: cursorX, y: cursorY})` keeps the point
     under the cursor fixed.
   - Two-finger pinch on touch → zoom (track distance change).
   - Toolbar buttons or keyboard for step zoom.
4. `toCenter()` — reset transform to center the root node in the
   viewport.
5. `scaleFit()` — auto-scale so all nodes are visible.

**New module:** `services/ViewportController.js` — manages transform
state (tx, ty, scale), exposes `move`, `scale`, `toCenter`,
`scaleFit`, `scrollIntoView(nodeId)`. Publishes `MINDMAP_VIEWPORT_CHANGED`
event with debounced throttling (16 ms).

**New contracts:**
```js
MINDMAP_VIEWPORT_CHANGED  // { mapId, tx, ty, scale }
```

**Test:** `tests/mindmap/viewport.test.js` — set scale, assert transform
string; pan by delta, assert cumulative position; toCenter re-centers
root.

### Phase 14 — Pointer-event drag-drop with ghost + insert preview

**Motivation:** mind-elixir-core `plugin/nodeDraggable.ts` (~300 lines).
HTML5 drag-drop (original Phase 6) is wrong for mindmaps — it can't do
insert-preview (before/after/in indicators) or edge auto-scroll. This
phase replaces Phase 6 entirely.

1. On pointer-down on a selected node → record start position.
2. If pointer moves > 5px (drag threshold) → enter drag mode:
   - Create a ghost element (clone of dragged node, semi-transparent,
     follows cursor).
   - Dragged nodes get `opacity: 0.5`.
   - On pointer-move, hit-test (`document.elementFromPoint` with y
     offset) to find potential drop target.
   - Drop target classification:
     - Cursor near top of target → `before` (insert as previous sibling).
     - Cursor near bottom of target → `after` (insert as next sibling).
     - Cursor in middle of target → `in` (insert as child).
     - Top-down layout: left edge = `before`, right edge = `after`,
       centre = `in`.
   - Show insert preview indicator (coloured line at insert position).
   - Edge auto-scroll: if cursor within 50px of canvas edge, pan in
     that direction at 20 px/100ms.
3. On pointer-up with valid target → call `moveNodeBefore`,
   `moveNodeAfter`, or `moveNodeIn` on MindmapService.
4. On Escape or pointer-cancel → cancel drag, restore opacity, remove
   ghost.
5. Multi-node drag: if multiple nodes are selected, drag all as a group.

**New service methods:**
```js
moveNodeBefore(nodeIds, targetId)  // move as previous sibling
moveNodeAfter(nodeIds, targetId)   // move as next sibling
moveNodeIn(nodeIds, targetId)      // move as children
```
These wrap the existing `moveNode` with position semantics.

**Test:** `tests/mindmap/drag-drop.test.js` — simulate pointer events,
assert correct service call for before/after/in. Assert invalid drops
(leaf as target for "in", self-drop, descendant-drop) are rejected.

### Phase 15 — Insert sibling / insert parent / move up-down

**Motivation:** mind-elixir-core `nodeOperation.ts` — insertSibling,
insertParent, moveUpNode, moveDownNode. These are service-level
gaps; the keyboard handler and context menu depend on them.

1. **`insertSibling(nodeId, position)`** — create new node, insert
   before or after `nodeId` in parent's `children` array. Record to
   history. Fire `MINDMAP_NODE_ADDED`.
2. **`insertParent(nodeId)`** — create new branch, replace `nodeId` in
   its parent's children with the new branch, move `nodeId` as child
   of the new branch. Record to history. Fire `MINDMAP_STRUCTURE_CHANGED`.
3. **`moveUp(nodeId)` / `moveDown(nodeId)`** — swap `nodeId` with its
   previous/next sibling in the parent's `children` array. Record to
   history. Fire `MINDMAP_NODE_MOVED`.

**Test:** `tests/mindmap/sibling-parent-ops.test.js` — insert sibling
correct position, insert parent wraps correctly, move up/down swaps.

### Phase 16 — Copy/paste nodes

**Motivation:** mind-elixir-core `plugin/keypress.ts` →
handleSetNodesClip. Clipboard operations are essential for power users.

1. **Copy:** On Ctrl+C with selected nodes, deep-clone the selected
   node trees (refresh UUIDs), serialize to JSON with a magic marker
   (`"MIND-ELIXIR-WAIT-COPY"` → use CSMA-specific marker), write to
   `navigator.clipboard.writeText()`.
2. **Cut:** Copy + delete selected nodes.
3. **Paste:** On Ctrl+V with a selected target node, read clipboard,
   detect the magic marker, parse node trees, call `addBranch` or
   `addLeaf` for each under the target. If no magic marker, fire a
   `MINDMAP_PASTE_EXTERNAL` event for optional `pasteHandler` callback.
4. In-memory clipboard stash as fallback for environments where
   `navigator.clipboard` is unavailable.

**New service methods:**
```js
copyNodes(nodeIds)               // returns deep-cloned trees
pasteNodes(trees, parentId)      // inserts cloned trees under parent
```

**Test:** `tests/mindmap/copy-paste.test.js` — copy two nodes, paste
under another, assert tree shape. Cut removes originals.

### Phase 17 — Context menu

**Motivation:** mind-elixir-core `plugin/contextMenu.ts`. CSMA has no
generic context menu module — this is new. Provides discoverability
for right-click users.

1. Create `ui/ContextMenu.js` — a reusable class that:
   - Renders a `<ul>` positioned absolutely at the click point.
   - Supports `disabled` class on menu items (e.g., root node can't
     be removed or moved up).
   - Auto-dismisses on click outside, Escape, or after an action.
   - Positions within viewport bounds (if menu would overflow, flip
     to the other side).
2. Default menu items (use CSMA i18n for labels):

| Item | Action | Disabled for root? |
|------|--------|--------------------|
| Add child | `addChild(selectedNode)` | No |
| Add parent | `insertParent(selectedNode)` | Yes |
| Add sibling (after) | `insertSibling(selectedNode, 'after')` | Yes |
| Remove node | `removeNode(selectedNode)` | Yes |
| Focus mode | `focusNode(selectedNode)` | Yes |
| Cancel focus | `cancelFocus()` | — |
| Move up | `moveUp(selectedNode)` | Yes |
| Move down | `moveDown(selectedNode)` | Yes |
| Summary | `createSummary(selectedNodes)` (future) | — |

3. Wire to `container.oncontextmenu` → `preventDefault()` → show menu.
4. Publish `MINDMAP_CONTEXT_MENU_OPEN` / `_CLOSE` events.

**New dependency:** `i18n` module (already in CSMA) for menu labels.

**Test:** `tests/mindmap/context-menu.test.js` — right-click on node
shows menu, click "Add child" calls `addChild`, menu dismisses.
Root node has disabled items.

### Phase 18 — Theme + i18n wiring

**Motivation:** mind-elixir-core has light/dark theme auto-detection
and 18 languages. CSMA already has `i18n` module and design tokens
for light/dark. Wire them into mindmap-specific labels and CSS.

1. Define mindmap-specific token overrides in
   `src/style/token-overrides.json` (mindmap node colours, connector
   stroke, selection outline, ghost opacity, expander colour).
2. Support `data-theme="light|dark"` on the canvas container;
   default to `prefers-color-scheme`.
3. Mindmap labels (context menu, toolbar tooltips, status messages)
   go through CSMA's `I18n` service. Load a `mindmap` translation
   bundle in `init()`.

**New file:** `i18n/mindmap-en.json` — English labels. Other locales
deferred (CSMA i18n has 18+ but mindmap only needs en for v1).

**Test:** `tests/mindmap/theme-i18n.test.js` — toggling theme changes
CSS custom properties; locale change updates context menu labels.

### Phase 19 — Global layout direction + toolbar

**Motivation:** mind-elixir-core `interact.ts` (initLeft/Right/Side/
Down). The service already stores per-node `direction`, but there's
no global toggle. The toolbar gives quick access.

1. `MindmapService` new methods:
   ```js
   setLayoutDirection(direction)  // 0=left, 1=right, 2=side, 3=down
   getLayoutDirection()           // returns current global direction
   ```
   Sets a map-level `layoutDirection` property. When switching layout,
   iterates all root children and sets their `direction` field, then
   fires `MINDMAP_STRUCTURE_CHANGED` so the renderer re-lays-out.
2. Toolbar UI: four buttons (left layout, right layout, side layout,
   top-down layout) using SVG icons (reuse mind-elixir's icons or
   CSMA's icon system). Positioned in the canvas corner, visible only
   on hover (like mind-elixir).
3. Also add: zoom in/out buttons, center button, fullscreen toggle
   (reuse overlay-manager pattern for fullscreen).

**Test:** `tests/mindmap/layout-direction.test.js` — switch to side
layout, assert root children split left/right; switch to top-down,
assert all children direction=3.

### Phase 20 — Demo page v2 (final)

1. Rewrite `demo/mindmap.html` as a full interactive mindmap:
   - All phases 10–19 integrated.
   - Sample MorphMap data preloaded.
   - Status line shows selected node path + keyboard shortcut hints.
   - Toolbar visible on canvas hover.
2. Write `mindmap/README.md` — concise user-facing docs.
3. Update `docs/architecture/SKILL.md` and `docs/patterns/SKILL.md`
   with mindmap as a worked example of CSMA module composition.
4. Run `npm run check:design` and `npm run check:responsive`.
5. Mark plan complete; archive this file as `plan.v1.md`.

## Tests

`tests/mindmap/`:

| Phase | Test file | Status |
|-------|-----------|--------|
| 1 | `layout-engine.test.js` | ✅ |
| 1 | `connector-geometry.test.js` | ✅ |
| 3 | `mindmap-service.test.js` | ✅ |
| 4 | `render.test.js` | ⬜ |
| 5 | `undo-redo.test.js` | ✅ |
| 7 | `search.test.js` | ✅ |
| 8 | `markdown-codec.test.js` | ✅ |
| 8 | `contracts-test.js` | ✅ |
| 10 | `selection.test.js` | ⬜ |
| 11 | `keyboard.test.js` | ⬜ |
| 12 | `box-select.test.js` | ⬜ |
| 13 | `viewport.test.js` | ⬜ |
| 14 | `drag-drop.test.js` | ⬜ |
| 15 | `sibling-parent-ops.test.js` | ⬜ |
| 16 | `copy-paste.test.js` | ⬜ |
| 17 | `context-menu.test.js` | ⬜ |
| 18 | `theme-i18n.test.js` | ⬜ |
| 19 | `layout-direction.test.js` | ⬜ |

Property-based via `fast-check`:

- For any random tree of depth ≤ 5 and branch factor ≤ 6,
  `LayoutEngine` produces non-overlapping rectangles.
- For any sequence of mutations, after `undo()` to start, the tree
  equals the original (deep equality).

## Out of scope (v1)

- Backend sync via SSMA gateway → SQLite (deferred until backend exists).
- Cross-links / arrows between non-parent nodes (CognitiveOS GraphStore
  future).
- Real-time multi-user collaboration (needs leader election + CRDT
  merge, deferred).
- Image / SVG / PDF export (can be added as a separate module later).
- Summaries (bracket grouping of consecutive siblings) — deferred to v2.
- Focus mode (drill-into-branch as temp root) — deferred to v2.
- Markdown / KaTeX rich-text rendering in nodes — deferred to v2.
- Branch style variants (straight, underline) — deferred to v2.
- Mobile-optimised touch UX — pointer events support basic touch;
  dedicated mobile gestures (long-press to drag, mobile multi-select
  toggle) are v2.

## Open questions

1. **Active-map persistence.** Should the last-opened map id be
   remembered across sessions (in IDB metadata store or
   `localStorage`)? Lean: yes, in a `prefs` store.
2. **Node IDs in markdown output.** Default is to omit (cleaner for
   LLM). Add an option `{ ids: true }` for debugging? Lean: yes.
3. **Layout on window resize.** Recompute on every resize event
   (debounced) or only on explicit `relayout()` call? Lean: debounced
   recompute.
4. **Empty map root.** Does the root node appear in markdown output, or
   only its children? Lean: omit root (it's a synthetic container).

---

## Archived design (superseded)

The original `src/modules/mindmap/README.md` proposed importing
`mind-elixir/lite` and overriding its DOM. That approach was abandoned
because `/lite` is not headless — it renders custom elements
(`<me-tpc>`, `<me-wrapper>`) and applies inline styles via `shapeTpc()`,
forcing constant overrides. The new design ports only the layout math
and lets CSMA own the DOM via `ai-ui`. The legacy README has been
removed; the rejected approach is summarised above for historical
reference.

The original `plan/components.md` file is **kept** — the component specs
(mind-node, mind-node, connector-line) are still accurate. Only the
module-integration sections of the old README are superseded.
