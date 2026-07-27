# Wave 3 — Focus & Context Capture (Mindmap)

> Status: **proposed**
> Depends on: Wave 1 (interaction cutover) + Wave 2 (`mountSurface` toolbar/handler wiring) — both shipped.
> Orthogonal to: §11 Cross-link Arrows (v2). This feature does **not** require §11.

---

## 1. Goal & motivation

Give the user a one-click path from "the part of the map I care about" to
"the text I paste into an agent."

- **Focus** = hide everything except a chosen branch context (dim non-focused
  nodes/connectors, highlight the focused ones).
- **Context capture** = serialize the focused branch into markdown (or minimal
  JSON) and copy it to the clipboard, ready to hand to an agent.

The driving use case (from chat): *"click the arrow to isolate the branch, then
copy the context for the agent."* Wave 3 delivers exactly that — and more,
because "the arrow" turns out to mean two different things (see §2).

---

## 2. Terminology — the crux

The codebase already has two distinct "arrow" concepts. Conflating them is the
main design risk, so we name them explicitly:

| Term | What it is | Exists? | Where |
|------|-----------|---------|-------|
| **Structural connector** | The curve MindElixir draws from a parent to its child. Rendered as `connector-line` (our catalog component). | **Yes, now** | `MindmapService.connectorPaths()` (line 1043); `render()` sets `data-link-kind` (~1212) |
| **Cross-link arrow** | A visible edge between **two non-parent nodes** (true graph edge). Stored in `map.arrows[]`. | **No — deferred §11** | `mind-elixir-port-csma.md` §11 |

**Consequence:** "isolate a branch by clicking the arrow" is achievable **today**
against structural connectors, with zero dependency on §11. The cross-link arrow
is a *separate* relationship feature; when it lands (§11), its click becomes
*another* focus trigger (see §8.6 / §13). They compose; they do not conflict.

---

## 3. Scope

**In scope (Wave 3)**
- Focus a single branch by clicking its structural connector.
- Focus scope = focused node **+ all ancestors up to root + all descendants**
  (full contextual branch), with an opt-in `subtree`-only variant.
- Multi-node focus set (parented or not) built from selection / Alt+click.
- Visual feedback: dim non-focused, accent-ring focused, floating focus pill.
- Context capture: serialize focus set → markdown / minimal-JSON → clipboard.
- `MINDMAP_FOCUS_CHANGED` event (contract-validated).
- **Agent discovery + isolation** (closes the loop for agents): register a
  `mindmap.search` `agentContext` provider (reusing the existing `Search`
  service) and declare `search` + `focus` in the aiui manifest `targetActions` /
  `intentMap`, so an agent can find node ids and pull focused context. See §7.1–§7.2.

**Out of scope (Wave 3)**
- Building cross-link arrows (that is §11). Wave 3 only reserves the seam.
- Persisting focus state to the map document (focus is a view state, ephemeral).
- Filtering by `tag` (separate classification feature).

---

## 4. Focus model

```
focusSet : Set<nodeId>        // seed nodes the user explicitly focused
scope    : 'branch' | 'subtree'   // 'branch' = ancestors+descendants (default)
effectiveIds : Set<nodeId>    // derived: union of (ancestors+descendants) per seed
```

`effectiveIds` is recomputed whenever `focusSet`/`scope` changes:

- **branch** (default): for each seed → walk parent index to root (add every
  ancestor) + add seed + DFS collect all descendants.
- **subtree**: for each seed → add seed + DFS collect all descendants (no
  ancestors).

Rationale for the default: an agent needs the path from the map's **root topic**
down through the focused node to its leaves. Direct-parent-only strips the root
framing the agent needs; ancestors+subtree is self-contained context.

`MindmapService` already provides the primitives:
- `_findNodeAndParent(root, nodeId)` (line 224) — DFS node lookup.
- `_isDescendantOf(node, ancestorId)` (line 566) — descendant test.
- A private `_buildParentIndex(root)` → `Map<id, parentId>` (new, trivial DFS)
  gives O(1) ancestor walks.

---

## 5. `FocusController` — new file

`src/modules/mindmap/services/FocusController.js` (~200 lines). Mirrors the
shape of the other controllers (`SelectionController`, `ViewportController`):
constructed inside `mountSurface` with the refs it needs.

```js
export class FocusController {
  constructor({ service, eventBus, nodeLayer, svgLayer, mapId, getRoot }) {}

  // --- focus set ---
  focusNode(nodeId, { scope } = {})        // replace focusSet with [nodeId]
  focusNodes(nodeIds, { scope } = {})     // replace focusSet
  addToFocus(nodeId)                       // union into focusSet (multi-select)
  removeFromFocus(nodeId)                  // pull one seed out
  toggleFocus(nodeId)                      // addToFocus / removeFromFocus
  clearFocus()                             // empty focusSet → show all
  setScope(scope)                          // 'branch' | 'subtree'

  // --- derived ---
  get isActive()                           // focusSet.size > 0
  get focusIds()                           // [...focusSet]
  get effectiveIds()                       // [...computed union]

  // --- DOM ---
  apply()                                  // toggle [data-in-focus] on current DOM

  // --- context capture ---
  exportContext({ format = 'markdown' } = {})  // → string (pruned serialize)
  async copyContext({ format = 'markdown' } = {}) // clipboard.writeText(exportContext)
}
```

`apply()` is idempotent and cheap: it queries the live DOM
(`.mind-node[data-node-id]`, `.connector-line[data-child-id]`) and toggles
`[data-in-focus]` by membership in `effectiveIds`, and sets
`nodeLayer.parentElement[data-mode="focus"]` when active.

---

## 6. Visual feedback

Token-driven only (no inline styles — CSMA rule). Add a small
`src/ui/components/mindmap-focus/mindmap-focus.css` (or append to the existing
focus section in `MindmapService`'s injected style). Reuse existing tokens and
the existing ring pattern from `mind-node.css:60`
(`box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary, var(--accent)) 35%, transparent)`).

```css
/* canvas root carries data-mode="focus" while a focus is active */
.mm-canvas[data-mode="focus"] .mind-node:not([data-in-focus]) {
  opacity: 0.25;
  filter: saturate(0.55);
}
.mm-canvas[data-mode="focus"] .connector-line:not([data-in-focus]) {
  opacity: 0.12;
}
.mind-node[data-in-focus] {
  /* reuse the existing accent ring from mind-node.css */
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary, var(--accent)) 35%, transparent);
}
```

- Non-focused nodes keep `pointer-events: auto` so the user can click a different
  node/connector to re-focus (focus is not a modal).
- Focused connectors: a connector is `data-in-focus` when its `data-child-id`
  ∈ `effectiveIds` (i.e. the edge leads into the focused subtree).

### Focus pill

A floating, token-styled pill (reuse catalog `button` + `badge`). Contents:
`Focusing N · [Copy markdown] · [Copy JSON] · [Exit focus]`. Positioned over the
canvas (absolute). Built with existing components — minimal new CSS.

---

## 7. Context capture

Serialization infra **already exists**:
- `MindmapService.toMarkdown(mapId, opts)` (line 961) →
  `codec.serialize(map.root, { format: 'markdown', ...opts })`.
- `MindmapService.toMinimalJson(mapId, opts)` (line 973) →
  `codec.serialize(map.root, { format: 'json', ...opts })`.
- `MarkdownCodec.serialize(root, options)` (line 102) supports
  `markdown | ascii | json`.
- `agentContext.register(...)` (lines 172–190) **already wires** both
  serializers, forwarding `opts` straight through.

So focus-aware context is just **pruning the root before serialize** — no new
codec work:

1. `FocusController.exportContext({ format })` builds a pruned copy of the tree
   keeping only `effectiveIds` (see §4 / §12), then calls
   `service.toMarkdown(mapId, { focusIds: [...focusSet], scope })` (or
   `toMinimalJson`).
2. Extend `toMarkdown` / `toMinimalJson` to accept an optional
   `{ focusIds, scope }` and, when present, serialize the pruned subtree instead
   of `map.root`. Because `agentContext` already forwards `opts`, agents can
   request focused context for free.
3. `copyContext({ format })` → `navigator.clipboard.writeText(exportContext)`.
   Guard for `clipboard` absence (non-secure context) with a fallback
   (`document.execCommand('copy')` or a temporary textarea).

Pruned subtree builder (in `FocusController`):

```js
_prune(root, effectiveIds) {
  const copy = (n) => ({
    ...n,
    children: (n.children || [])
      .filter((c) => effectiveIds.has(c.id))
      .map(copy),
  });
  return copy(root);
}
```

This yields the same markdown shape the rest of the app already produces —
consistent, no new format.

### 7.1 Agent discovery — `mindmap.search` provider

An agent needs to **find** the branch before it can isolate it. The `Search`
service already does this: `Search.search(root, query, { status, tag })`
(`services/Search.js:34`, `fuzzyScore` at `:9`) — fuzzy topic match + status/tag
filter. Expose it to agents by registering a provider in `MindmapService.init`
alongside the existing serializers (lines 172–190):

```js
this.agentContext.register({
  name: 'mindmap.search',
  description: 'Fuzzy search mindmap nodes by topic / status / tag',
  fn: (data, opts) =>
    svc.search(opts?.query || '', { status: opts?.status, tag: opts?.tag }),
});
```

Add a thin wrapper on the service:

```js
search(query, { status = null, tag = null } = {}) {
  const root = this._getMap(this._activeMapId)?.root;
  if (!root) return [];
  return this.searcher
    .search(root, query, { status, tag })
    .map((m) => ({ id: m.node.id, topic: m.node.topic, status: m.node.status,
                    tag: m.node.tag, path: m.path })); // path = ancestor topics
}
```

The agent loop is then closed:
`search('auth')` → `[{ id, topic, path }]` →
`getContext({ focusIds: [id] })` (the serializer already forwards `opts`; once
§7's `focusIds` pruning lands, the agent receives only that branch's text).

### 7.2 aiui manifest declaration

`src/modules/mindmap/aiui/manifest.json` already declares the surface
`aiUi.enabled: true` but its `behavior.targetActions: []` and `intentMap: {}`
are **empty** — the CSMA "aiui default" slot for agent-callable actions. Populate
them so the agent runtime can discover and invoke focus/search:

```json
"behavior": {
  "role": "module-surface",
  "events": [],
  "targetActions": [
    { "action": "mindmap.search", "description": "Fuzzy search nodes by topic/status/tag" },
    { "action": "mindmap.focus",  "description": "Isolate a branch by node id(s)" }
  ],
  "intentMap": {
    "searchNodes": "mindmap.search",
    "isolateBranch": "mindmap.focus"
  }
}
```

`mindmap.focus` resolves to `FocusController.focusNodes` (seeded by the agent's
node ids); `mindmap.search` resolves to the §7.1 provider. Both are thin — the
heavy lifting is the focus/serialize code shared with the human path.

---

## 8. Interactions

### 8.1 Structural connector click → focus child branch (primary)
A delegated click listener on `svgLayer` reads `data-child-id` from the clicked
`<path class="connector-line">` and calls `focus.focusNode(childId)`. This is the
"click the arrow → isolate the branch" path, shipped in Wave 3.

**Prerequisite:** connector paths currently set `data-link-kind` (~1212) but
**not** `data-child-id`. Add it in `render()`: read the child id from the
`connectorPaths` edge object (extend `ConnectorGeometry.connectorPaths` if it
does not yet expose it). Low-risk, one-line-per-path change.

### 8.2 Alt+Click node → toggle into focus set (multi)
`Alt+Click` (or `Option+Click`) on a `.mind-node` calls
`focus.toggleFocus(nodeId)`. Lets the user assemble a disjoint focus set
(parented or not) — e.g. focus both "Auth" and "Billing" branches at once.
Plain click keeps normal selection behavior ( SelectionController handles
selection; focus is separate).

### 8.3 Context menu
Add `cm-focus` (focus this branch) and `cm-focus-add` (add to focus set) to
`ui/ContextMenu.js`, gated like the other items, routing to `FocusController`.

### 8.4 Toolbar "Focus" button
A toolbar button (sits beside the existing zoom/fit/layout/fullscreen buttons
wired in Wave 2) that calls `focus.focusNodes(selection.selectedIds)` — turns the
current multi-selection (ctrl/cmd-click, already supported at
`SelectionController` 263–271; `selectedIds` getter at line 80) into a focus set.
Plus an "Exit focus" affordance (also in the pill).

### 8.5 Exit focus
`Esc` or clicking empty canvas (the existing "clear selection on empty click"
path at `SelectionController` ~288–300) → `focus.clearFocus()`.
Distinguish: empty-canvas click clears selection always; if a focus is active it
also clears focus.

### 8.6 Cross-link arrow click → focus both endpoints (§11 seam, forward-compat)
When §11 lands, its arrow `<path>` carries `data-from` / `data-to` (§11.4).
Wave 3 reserves the seam: `FocusController.focusNodes([from, to])` is the single
call §11's arrow-click handler will make. No coupling now; just document the
contract.

---

## 9. Re-apply after render

`render()` (defined ~1200) and `renderAfterMut` (1220) are the single re-render
seam — called after drag, collapse/expand, layout change, and initially (1270).
Because `render()` rebuilds `nodeLayer`/`svgLayer` DOM, focus attributes must be
re-applied **after** each render.

**Decision:** construct `FocusController` inside `mountSurface` (like the other
controllers, 1247–1250) and call `focus.apply()` at the **end** of `render()`.
This avoids ordering bugs and keeps focus in sync with zero extra bus wiring.

```js
const focus = new FocusController({ service, eventBus, nodeLayer, svgLayer,
  mapId: resolvedMapId, getRoot: () => service._getMap(resolvedMapId)?.root });
// ... existing handlers ...
const render = () => {
  // ... existing node + connector build ...
  focus.apply();            // ← added
};
```

When `focusSet` changes *without* a re-render (e.g. toggling focus),
`FocusController` calls `apply()` directly after publishing.

---

## 10. Events

Add to `contracts/mindmap-contracts.js` (sibling of the existing
`MINDMAP_*` events):

```
MINDMAP_FOCUS_CHANGED  →  { mapId, focusIds: string[], scope: 'branch' | 'subtree', active: boolean }
```

`FocusController` publishes it on every focus-set/scope change (via
`service._publish`, consistent with the other mutators). No new history op —
focus is ephemeral view state, not an undoable mutation.

---

## 11. Code map

| File | Change | Anchor |
|------|--------|--------|
| `services/FocusController.js` | **new** — focus model, `apply()`, `exportContext`, `copyContext` | — |
| `services/MindmapService.js` | instantiate `FocusController` in `mountSurface`; `focus.apply()` in `render()`; connector `data-child-id`; delegated connector-click + Alt+click handlers; toolbar Focus/Exit buttons; `toMarkdown`/`toMinimalJson` accept `{ focusIds, scope }` | 1080, ~1200, 961, 973 |
| `services/ConnectorGeometry.js` | ensure `connectorPaths` edge exposes child id (if not already) | ~1043 caller |
| `ui/ContextMenu.js` | `cm-focus`, `cm-focus-add` items → `FocusController` | — |
| `contracts/mindmap-contracts.js` | `MINDMAP_FOCUS_CHANGED` + payload contract | near line 102 |
| `ui/components/mindmap-focus/mindmap-focus.css` | `[data-mode="focus"]` dimming + ring + pill styles (token-driven) | — |
| `ui/components/mind-node/mind-node.css` | (reuse existing ring; no change required) | 60 |
| `demo/mindmap.html` | **no change** — focus arrives via `mountSurface` | — |
| `services/MindmapService.js` (init) | register `mindmap.search` agentContext provider (~172–190); add `svc.search()` wrapper | 172 |
| `services/Search.js` | reuse as-is; optionally surface ancestor `path` on matches | 34 |
| `aiui/manifest.json` | populate `behavior.targetActions` + `intentMap` (search + focus) | — |

---

## 12. Data flow (pruning)

```
user clicks connector (data-child-id = C)
  → focus.focusNode(C)            // focusSet = {C}, scope = 'branch'
  → compute effectiveIds = ancestors(C→root) ∪ {C} ∪ descendants(C)
  → _publish(MINDMAP_FOCUS_CHANGED)
  → render() rebuilds DOM → focus.apply()
       • .mind-node[data-node-id] ∈ effectiveIds  → [data-in-focus]
       • .connector-line[data-child-id] ∈ effectiveIds → [data-in-focus]
       • nodeLayer.parent[data-mode="focus"]
  → user clicks "Copy markdown"
  → exportContext({format:'markdown'})
       • pruned = _prune(root, effectiveIds)
       • service.toMarkdown(mapId, { focusIds, scope }) → codec.serialize(pruned, {format})
  → navigator.clipboard.writeText(text)
```

Multi-node: `focusNodes([A, B])` → `effectiveIds` = union of both branches →
all three (root, A's branch, B's branch) pruned into one tree → one paste.

---

## 13. Relationship to §11 (Cross-link Arrows)

- Wave 3's focus works on **structural connectors + node selection** — no §11
  dependency.
- §11's cross-link arrows become **another focus trigger** when built:
  clicking an arrow calls `focus.focusNodes([from, to])`, isolating the linked
  context (both endpoints' branches). This is the natural unification of "the
  other arrow feature" the user sensed — they reinforce each other instead of
  competing.
- Both features share the same `effectiveIds` / `apply()` / `MINDMAP_FOCUS_CHANGED`
  machinery. §11 only needs to call into `FocusController`; it does not redefine
  focus.

---

## 14. Open decisions (recommend defaults)

1. **Scope default** → `branch` (ancestors+descendants). Alt: `subtree` only.
   *Recommend branch — keeps root framing for the agent.*
2. **Multi-select seed** → from `SelectionController.selectedIds` (ctrl/cmd-click)
   plus Alt+click toggle. *Recommend both.*
3. **Copy default format** → markdown (most agents parse it); JSON available via
   pill/opts. *Recommend markdown.*
4. **Connector click = replace vs add** → single connector click **replaces**
   focus (one branch); use Alt+click or selection→Focus button to accumulate.
   *Recommend replace-on-connector, add-on-Alt+click.*

5. **Agent discovery** → register `mindmap.search` provider + manifest
   `targetActions` so agents can find-then-isolate. *Recommend yes — folds agent
   discovery+isolation into Wave 3, reuses `Search` + the focus serialize path.*

---

## 15. Acceptance criteria

- [ ] Clicking a structural connector isolates that child's full branch
      (ancestors + subtree); all other nodes/connectors dim.
- [ ] `Alt+Click` accumulates disjoint nodes into one focus set (union of
      branches).
- [ ] `data-in-focus` / `data-mode="focus"` survive drag, collapse, expand, and
      `setLayoutDirection` re-renders.
- [ ] Focus pill shows count; "Copy markdown" and "Copy JSON" put the pruned
      subtree on the clipboard; "Exit focus" restores full view.
- [ ] `Esc` / empty-canvas click clears focus.
- [ ] `MINDMAP_FOCUS_CHANGED` fires and passes contract validation.
- [ ] `toMarkdown({ focusIds, scope })` / `toMinimalJson({ focusIds, scope })`
      produce only the focused subtree (agent-context serializers honor it).
- [ ] `check:design` + responsive checks still pass; no inline styles added.
- [ ] `demo/mindmap.html` needs no edits — focus is delivered entirely by
      `mountSurface`.
- [ ] `mindmap.search` agentContext provider returns matching node ids + ancestor
      `path`; agent can `search` then `getContext({ focusIds })` to receive only
      the matched branch.
- [ ] aiui manifest declares `search` + `focus` `targetActions` / `intentMap`.

---

## 16. Risks

- **Connector click target** depends on adding `data-child-id` to connector
  paths (prerequisite, §8.1). If `ConnectorGeometry.connectorPaths` does not
  expose the child id, extend it — verify during implementation.
- **Re-render ordering** — mitigated by calling `focus.apply()` inside `render()`
  (§9), not via a separate bus listener that could race the DOM rebuild.
- **Clipboard in non-secure contexts** — add the `execCommand` fallback (§7.3).
- **Dimming vs interaction** — non-focused nodes stay clickable so focus is not
  modal (§6).
