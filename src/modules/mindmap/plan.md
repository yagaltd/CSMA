# Plan — `mindmap` module

> Status: planning (replaces the older `README.md` design, which is
> archived at the bottom of this file). Order: **3 of 3** (after
> `history` and `agent-context`).

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
  - `ai-ui` — secure component composer (mounts `branch-node`, etc.)
  - `storage` — IDB primitive
  - `runtime/EventBus`, `runtime/Contracts`, `runtime/ModuleManager`
- **Consumed by:** MorphShell (as a tile, future), MCP bridge (future).

## Architecture

```
src/modules/mindmap/
├── plan.md                              ← this file
├── README.md                            ← written at end of phase 7
├── index.js                             ← manifest + service export + serializers
├── contracts/
│   └── mindmap-contracts.js             ← MINDMAP_* event schemas
├── services/
│   ├── MindmapService.js                ← tree CRUD, EventBus, history integration
│   ├── MindmapStore.js                  ← IDB adapter (uses storage module)
│   ├── LayoutEngine.js                  ← ported from mind-elixir layout.ts
│   ├── ConnectorGeometry.js             ← ported from svg.ts + generateBranch.ts
│   ├── MarkdownCodec.js                 ← NodeObj tree ↔ markdown (context only)
│   └── Search.js                        ← in-map filter / fuzzy match
├── serializers/
│   ├── toMarkdown.js                    ← registered with agent-context
│   ├── toAscii.js
│   └── toMinimalJson.js
└── vendor/
    └── MIND_ELIXIR_LICENSE              ← MIT, attribution for the port

src/ui/components/
├── branch-node/      { manifest.json, branch-node.css, branch-node.demo.html }
├── leaf-node/        { manifest.json, leaf-node.css, leaf-node.demo.html }
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

1. Run `npm run create-component branch-node`, `leaf-node`,
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
   mount `branch-node` / `leaf-node` components at computed positions.
2. Draw `connector-line` SVG paths via `ConnectorGeometry` into a single
   SVG layer.
3. On any `MINDMAP_*` event, recompute affected layout region and update
   DOM via `ai-ui` ops (no full re-render).

**Test:** `tests/mindmap/render.test.js` (jsdom) — after `addBranch`,
the DOM contains one new branch-node element with correct
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

### Phase 6 — Drag-drop reorder

1. Implement HTML5 drag-drop on `branch-node` / `leaf-node` (CSMA already
   has drag infra in `runtime`; reuse where possible).
2. On drop, call `moveNode` → history record + `MINDMAP_NODE_MOVED` event
   → layout recompute.
3. Validate drop targets (leaf cannot accept children; root has special
   rules).

**Test:** `tests/mindmap/drag-drop.test.js` — simulated drag events over
jsdom; assert `moveNode` called with correct args; invalid drops are
rejected.

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

### Phase 9 — Demo page + finalize

1. `demo/mindmap.html` — standalone page with sample MorphMap data, all
   features exercisable.
2. Write `mindmap/README.md` (concise — supersedes this plan).
3. Update `docs/architecture/SKILL.md` and `docs/patterns/SKILL.md` with
   mindmap as a worked example of history + agent-context + ai-ui
   composition.
4. Mark plan complete; archive this file as `plan.v1.md`.

## Tests

`tests/mindmap/`:

- `layout-engine.test.js`
- `connector-geometry.test.js`
- `mindmap-service.test.js`
- `render.test.js`
- `undo-redo.test.js`
- `drag-drop.test.js`
- `search.test.js`
- `markdown-codec.test.js`
- `contracts-test.js` (validates every `MINDMAP_*` payload shape)

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
- Mobile touch interactions beyond collapse/expand (drag-drop will use
  pointer events; full touch UX is a v2 concern).

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
and lets CSMA own the DOM via `ai-ui`.

The original `plan/components.md` file is **kept** — the component specs
(branch-node, leaf-node, connector-line) are still accurate. Only the
module-integration sections of the old README are superseded.
