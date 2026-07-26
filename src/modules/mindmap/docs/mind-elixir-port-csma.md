# mind-elixir → CSMA Port Plan

How to finish porting `mind-elixir-core` (v5.15) into the CSMA `mindmap` module:
**keep 100% DOM (no `<canvas>` for live UI)**, drive all styling from
`/src/generated/tokens.css`, and reuse CSMA UI components + modules instead of
re-implementing them in the demo.

> Prereq reading: `docs/demo-catalog-mapping.md` (the node-DOM → catalog
> component reskin that is already done).

---

## 1. The issue (what is actually broken)

The `mindmap` module already ports mind-elixir's *logic* and even ships the
*interaction layer*. The gap is that **`demo/mindmap.html` ignores the module
and hand-rolls a parallel mindmap**:

1. **Logic ported, demo duplicates it.** `MindmapService` exposes
   `createMap / addBranch / insertSibling / addLeaf / updateNode / updateStatus /
   removeNode / moveNode / insertParent / moveUp / moveDown / collapse / undo /
   redo / setLayoutDirection / layout / connectorPaths / search / toMarkdown /
   toAscii / toMinimalJson / mountSurface`. The demo calls only
   `svc.layout()` + `svc.connectorPaths()` and rebuilds everything else itself.
2. **Interaction helpers exist but are unused.** The module ships
   `services/NodeDragHandler.js`, `KeyboardHandler.js`, `SelectionController.js`,
   `ViewportController.js`, `BoxSelector.js`, `ClipboardManager.js`, and
   `ui/ContextMenu.js`. The demo wires its own `pointerdown` / `keydown` /
   `contextmenu` listeners inline (demo lines ~313, 467, 503, 542).
3. **Hardcoded hex instead of tokens.** Demo CSS uses `#4f90f2`, `#bbb`,
   `#888`, `#fafafa`, `#d0d0d0` — bypassing the CSMA token system.
4. **Custom `.mm-*` DOM instead of catalog components.** Nodes are
   `.mm-node`, connectors `.mm-connector`, expander `.mm-expander`. The catalog
   already has `branch-node` / `leaf-node` / `connector-line` built for this
   exact purpose (and they were mapped in `demo-catalog-mapping.md`).

### Upstream itself also diverged (why we can't copy it verbatim)

mind-elixir v5 renders with a **nested `me-*` custom-element + flexbox** model
(`me-nodes` → `me-main.lhs/.rhs/.down` → `me-wrapper` → `me-parent` →
`me-tpc` + `me-epd` → `me-children`), positions purely via CSS flex, and
themes via LESS with CSS vars (`--main-color`, `--main-bgcolor`, `--node-gap-*`,
`--main-gap-*`, `--map-padding`, `--bgcolor`).

CSMA deliberately committed to an **absolute-rectangle** model: `LayoutEngine.layout()`
returns `{x,y,w,h}` per node and the renderer positions with `left/top`. Both are
DOM (no canvas) — satisfying the hard requirement — but the positioning strategy
differs. **Decision: keep CSMA's absolute model; reconcile upstream's *visual +
feature* layer onto it.** Do **not** adopt upstream's flex `me-*` tree.

---

## 2. Goal & non-goals

**Goal:** a mindmap surface that (a) is pure DOM/SVG, (b) is styled entirely
from `tokens.css`, (c) renders through catalog components `branch-node` /
`leaf-node` / `connector-line`, and (d) uses the module's own interaction
helpers + CSMA modules — with `demo/mindmap.html` reduced to a thin harness
around `svc.mountSurface()`.

**Non-goals (out of scope, per `README.md`):** cross-link arrows, summary
panel, image/PDF export (canvas raster), SSR layout, backend sync, real-time
collaboration. Markdown *serialization* stays; rich inline markdown *rendering* in
topics stays minimal (text + tag + status + optional hyperlink/icon).

---

## 3. Architecture decision

```
app / demo
   └─ svc.mountSurface(surfaceId, container, props)   ← single mount point
         ├─ LayoutEngine.layout()        → absolute rects (unchanged)
         ├─ ViewportController           → zoom/pan (transform scale)
         ├─ NodeDragHandler            → pointer drag + .insert-preview
         ├─ SelectionController         → multi-select
         ├─ KeyboardHandler           → Tab/Enter/Del/Ctrl+Z/Y/PgUp/Dn
         ├─ ui/ContextMenu.js          → add child/parent/sibling…
         ├─ ConnectorGeometry         → SVG <path> (connector-line)
         └─ ai-ui mount               → branch-node / leaf-node / connector-line
```
All of these already exist as **complete, implemented classes** in
`src/modules/mindmap/` — they are *not* stubs and need no logic moved into
them. The gap: `MindmapService.mountSurface()` (line 1066) only instantiates
`MarkdownCodec` / `Search` / `Map`; it never attaches the interaction handlers,
and `demo/mindmap.html` hand-rolls the same drag / pan-zoom / keyboard /
context-menu / inline-edit logic inline (demo lines 313, 444, 467, 503, 542,
227). **So the work is twofold: (1) *wire* — instantiate + attach the existing
handlers inside `mountSurface` (or have the demo call them); (2) *cutover* —
delete the demo's duplicate inline listeners and `.mm-*` CSS. No new algorithms;
this is wiring + de-hexing + catalog swap.**

---

## 4. Source map (upstream → CSMA target → action)

| Upstream (mind-elixir) | CSMA target | Action |
|---|---|---|
| `utils/layout.ts` + `me-*` flex tree | `services/LayoutEngine.js` | **Reuse** (absolute rects — keep) |
| `utils/dom.ts` `shapeTpc` (topic shape) | `branch-node` / `leaf-node` inner structure | **Refactor** demo DOM → catalog (done in `demo-catalog-mapping.md`) |
| `utils/svg.ts` `createLine` / `generateBranch.ts` connector math | `services/ConnectorGeometry.js` | **Reuse** (already ported) |
| `plugin/nodeDraggable.ts` + `mouse.ts` + `interact.ts` | `services/NodeDragHandler.js` | **Wire**; move demo drag here; `.insert-preview` token-styled |
| `plugin/contextMenu.ts` + `.less` | `ui/ContextMenu.js` | **Wire** to `MindmapService` ops + `mindmap-en.json` |
| `plugin/toolBar.ts` + `.less` | new `mountSurface` toolbar surface using `button` component | **Build** (direction + zoom + fullscreen) |
| `plugin/operationHistory.ts` | `history` module (via `MindmapService.undo/redo`) | **Reuse** (done) |
| `plugin/keypress.ts` | `services/KeyboardHandler.js` | **Wire** |
| `plugin/selection.ts` | `services/SelectionController.js` | **Wire** (upgrade demo's single `selected` set) |
| `utils/panHelper.ts` | `services/ViewportController.js` | **Wire** (demo already has pan/zoom — consolidate) |
| `arrow.ts` / `linkDiv.ts` / `summary.ts` / `exportImage.ts` | — | **Skip** (out of scope) |
| `i18n.ts` | `i18n/mindmap-en.json` + `agent-context` | **Reuse** |
| `markdown.css` + custom markdown fn | `services/MarkdownCodec.js` (serialize only) | **Reuse**; inline render stays text/link/icon minimal |
| `index.less` theming (`--main-color` etc.) | `/src/generated/tokens.css` | **Map vars → tokens** (§6) |

---

## 5. Style mapping (upstream LESS vars → CSMA tokens)

Delete every hardcoded hex in the demo. Map upstream's theme vars onto CSMA tokens:

| upstream var | CSMA token | Notes |
|---|---|---|
| `--bgcolor` (map bg) | `--mindmap-canvas-bg` (or `--surface`) | demo already referenced `--mindmap-canvas-bg` |
| `--main-color` (node border) | `--border` | status override via below |
| `--main-bgcolor` (node bg) | `--surface` | |
| status border / stroke | `--primary` (in_progress), `--success` (done), `--destructive` (blocked/failed) | catalog `branch-node`/`leaf-node`/`connector-line` already do this |
| root / active emphasis | `--accent` (or `--primary`) | |
| `--node-gap-x/y`, `--main-gap-x/y` | **owned by `LayoutEngine` constants**, not CSS | absolute model → spacing comes from layout math, not flex gaps |
| `--map-padding` | `--space-lg` | container padding |
| node radius / padding | `--radius-md`, `--space-sm/md` | already used by catalog components |

Theming is then automatic: tokens.css already ships light / dark / contrast
themes, so the mindmap inherits theme switching for free (no separate
`THEME`/`DARK_THEME` cssVar injection needed).

---

## 6. DOM model reconciliation (canonical node shape)

CSMA keeps **flat, absolutely-positioned** nodes (one element per node,
`left/top/width/height` from `LayoutEngine`). Each node wears a catalog class:

```html
<!-- branch / root -->
<div class="branch-node" data-kind="root|branch" data-status="…"
     data-tag="…" data-collapsed="true|false" data-node-id="…"
     style="left:..;top:..;width:..;height:..">
  <div class="branch-node__header">
    <span class="branch-node__status"></span>
    <span class="branch-node__topic">topic</span>
    <span class="branch-node__tag">tag</span>
  </div>
  <button class="branch-node__collapse" aria-label="Collapse"></button>
</div>

<!-- leaf -->
<div class="leaf-node" data-status="…" data-bottleneck="blocking|risky"
     data-node-id="…" style="left:..;top:..;width:..;height:..">
  <span class="leaf-node__status"></span>
  <span class="leaf-node__topic">topic</span>
</div>

<!-- connector (SVG, not canvas) -->
<svg class="map-svg"><path class="connector-line"
      data-link-kind="main" data-status="…" d="…"></path></svg>
```

This is exactly the mapping already applied in `demo-catalog-mapping.md`
(Option A). The nested `me-children` flex structure from upstream is **not**
reproduced — leaves stay independent positioned nodes. That is the intended,
documented gap.

---

## 7. Feature port checklist

| Feature | Upstream source | CSMA target | Status / action |
|---|---|---|---|
| Drag + reorder | `nodeDraggable.ts` | `NodeDragHandler.js` (**done, 605 lines**) | handler complete; **wire** into `mountSurface` + **cutover** demo inline drag (delete `.mm-ghost`/`.mm-preview-*` and demo listeners 313–425); rename preview to `.insert-preview` (before/after/in), token-styled |
| Context menu | `contextMenu.ts` (`cm-add_child`/`cm-add_parent`/`cm-add_sibling`/`cm-remove_child`/`cm-up`/`cm-down`/`cm-summary`/`cm-link*`) | `ui/ContextMenu.js` (**done, 343 lines, i18n-driven**) | **wire** into `mountSurface` + **cutover** demo's inline `.mm-menu` builder (262–270, 542); labels from `mindmap-en.json`; root disables parent/sibling/up/down |
| Toolbar (direction + zoom + fullscreen) | `toolBar.ts` + `src/icons/*.svg` | new surface in `mountSurface`, using `button` component | **build**: bind `setLayoutDirection(LEFT/RIGHT/SIDE/DOWN)`, `ViewportController` zoom, `requestFullscreen()` |
| Undo / redo | `operationHistory.ts` | `history` module | **done** (`svc.undo/redo` proxied) |
| Keyboard | `keypress.ts` | `KeyboardHandler.js` (**done, 559 lines**) | **wire** into `mountSurface` + **cutover** demo inline `keydown` (467, 503); Tab=add child, Enter=add sibling, Del=remove, Ctrl+Z/Y, PgUp/PgDn=move, Ctrl+C/X/V clipboard |
| Multi-select + inline edit | `selection.ts` | `SelectionController.js` (**done, 443 lines**) | **wire** + **cutover** demo's single `selected` Set and inline-edit input (227–236); handler already does multi-select + inline edit, publishes `MINDMAP_NODE_SELECTED` etc. |
| Zoom / pan | `panHelper.ts` | `ViewportController.js` (**done, 415 lines**) | **wire** + **cutover** demo `wheel`/pan (444, 425); handler owns transform scale + `toCenter`/`scaleFit`, pub `MINDMAP_VIEWPORT_CHANGED` |
| Box select / copy-paste | `BoxSelector.ts` / `ClipboardManager.ts` (**done**) | same | **wire** if demo needs them; delete any demo duplicate |
| i18n | `i18n.ts` | `mindmap-en.json` + `agent-context` | **reuse** |
| Topic inline (text/markdown/link/icon/tag) | `dom.ts shapeTpc` | catalog components | tag+status+bottleneck supported; add hyperlink/icon optionally (keep minimal) |
| Cross-link arrows | `arrow.ts` | — | **skip** |
| Summary / exportImage / SSR | `summary.ts` / `exportImage.ts` / `layout-ssr.ts` | — | **skip** |

---

## 8. Concrete refactor steps

1. **(done)** Demo node DOM → catalog classes — `docs/demo-catalog-mapping.md`.
2. **(done partly)** Add `branch-node.css` / `leaf-node.css` / `connector-line.css`
   `<link>`s to the demo; remove `.mm-node`/`.mm-connector`/`.mm-expander` rules.
3. **De-hex.** Delete `#4f90f2/#bbb/#888/#fafafa/#d0d0d0` from demo CSS;
   route through tokens (`--accent`, `--border`, `--surface`, `--mindmap-canvas-bg`,
   `--foreground-muted`). Replace the adapter outline with token var.
4. **NodeDragHandler — wire + cutover (handler already implemented).**
   `services/NodeDragHandler.js` (605 lines) is complete: pointer drag, ghost,
   `.insert-preview-before/after`, edge auto-scroll, `canMove` guards, `moveNode`
   commit. **Wire** it into `mountSurface` (attach to container + `MindmapService`).
   **Cutover:** delete the demo's inline drag listeners (313–425) and the
   `.mm-ghost` / `.mm-preview-bar` / `.mm-preview-outline` CSS; keep only the
   token-styled `.insert-preview` (`.before`/`.after`/`.in`) used by the handler.
5. **ContextMenu — wire + cutover (already implemented).** `ui/ContextMenu.js`
   (343 lines) already builds the menu from `i18n/mindmap-en.json` and disables
   root-inappropriate items; it uses no `innerHTML`. **Wire** it into
   `mountSurface` (bind to container `contextmenu`, route to `addBranch/addLeaf/
   insertSibling/removeNode/moveUp/moveDown/insertParent`). **Cutover:** delete
   the demo's inline `.mm-menu` builder (262–270, 542) and `.mm-menu*` CSS.
6. **Keyboard + Selection + Viewport — wire + cutover (all implemented).**
   `KeyboardHandler.js` (559), `SelectionController.js` (443, multi-select +
   inline edit), `ViewportController.js` (415, pan/zoom transform + `toCenter`/
   `scaleFit`) are complete. **Wire** all three into `mountSurface`. **Cutover:**
   delete the demo's inline `keydown`/`keyup` (467, 503), `pointerup`/`pointercancel`
   pan branch (425), `wheel` zoom (444), and the single `selected` Set + inline-edit
   input (227–236) — the handlers replace all of it.
6b. **Strip legacy `.mm-*` CSS + `.mm-zoom-bar` DOM.** Remove the `<style>`
    block rules `.mm-ghost`/`.mm-preview-*`/`.mm-edit-input`/`.mm-menu*`/`.mm-zoom-bar`
    and the `<div class="mm-zoom-bar">` (80) from the demo. Zoom buttons are
    reborn as the `mountSurface` toolbar (step 7) using the `button` component.
7. **Toolbar surface.** Add a toolbar to `mountSurface` using the `button`
   component; bind `setLayoutDirection`, zoom (ViewportController), fullscreen.
8. **mountSurface is canonical.** Confirm `mountSurface(surfaceId, container, props)`
   (MindmapService line ~1066) internally uses LayoutEngine + ConnectorGeometry
   + the handlers above + ai-ui mount of `branch-node`/`leaf-node`/`connector-line`.
   Demo becomes: `const svc = serviceManager.get('mindmap'); svc.mountSurface('mm', canvasEl);`.
9. **ai-ui manifest.** Verify `aiui/manifest.json` lists `branch-node`,
   `leaf-node`, `connector-line` as mountable (it does) so `mountSurface`
   can compose them.
10. **Verify.** `npm run check:design` + `npm run check:responsive`;
    open demo; confirm no `<canvas>` in live UI, all colors resolve to tokens.

---

## 9. Open decisions / risks

- **Absolute vs flex:** keeping absolute means we do *not* get upstream's
  auto-balancing flex tree; spacing is `LayoutEngine`'s job. Acceptable and
  already the module's design.
- **`.insert-preview` styling:** upstream uses 14px edge bars; reuse the same
  semantics but token-styled, or adopt CSMA's existing preview approach.
- **Toolbar ownership:** new surface inside `mountSurface` vs. a separate
  `mindmap-toolbar` component. Prefer composing the existing `button` component.
- **Topic richness:** full `shapeTpc` (image/hyperlink/icons/markdown) is
  larger than CSMA's current node model; port text + tag + status + optional
  hyperlink only for v1.
- **License:** `vendor/MIND_ELIXIR_LICENSE` (MIT) already present; keep
  attribution in `README.md`.

---

## 10. Verification gate

- [ ] No `<canvas>` element in live mindmap UI (SVG connectors only).
- [ ] Zero hardcoded hex in demo/module CSS; all colors are token vars.
- [ ] Nodes render as `branch-node` / `leaf-node`; connectors as `connector-line`.
- [ ] Drag, context menu, keyboard, zoom/pan, undo/redo, multi-select all
      route through module helpers (no inline listeners in demo).
- [ ] `svc.mountSurface()` is the only mount entry; demo is a thin harness.
- [ ] `npm run check:design` and `npm run check:responsive` pass.

---

## 11. v2 Addendum — Cross-link Arrows

> Out of v1 scope (see §1/§9). This is the **graph node-edge** feature:
> arbitrary directed edges between **non-parent** nodes. Orthogonal to `tag`
> (classification/filter) — see the design note in chat. Drafted here so v2
> drops straight in.

### 11.1 Data model

Arrows are cross-tree edges, so they live at the **map level**, sibling of `root`
(not inside a node). Extend the map object:

```js
map = {
  meta: { id, name, rootId, createdAt, updatedAt, layoutDirection },
  root: <Node>,
  arrows: Arrow[]   // NEW — sibling of root
}
```

```js
// Arrow — ported from upstream arrow.ts `Arrow<M>` (simplified)
interface Arrow {
  id: string;
  from: string;            // node id (source)
  to: string;              // node id (target)
  direction: 'forward' | 'bidirectional';  // cm-link vs cm-link-bidirectional
  label?: string;          // optional edge caption
  style?: { color?: string; dashed?: boolean; curved?: boolean };
}
```

**Validation (in contracts):** `from !== to`; both ids exist in the map;
neither endpoint is an ancestor/descendant of the other (that is already a
structural tree edge — reject to keep arrows = true cross-links); both in same
map. Self-loops and tree-duplicate edges are rejected.

### 11.2 Persistence — no new store

`MindmapStore.putMap(map)` (line 57) already serializes the **whole** map
object, and `MindmapStore` has the in-memory fallback. So `arrows` simply
**rides inside the map document** — zero new object stores, zero new store
API. `getMap` / `getAllMaps` return it for free. (Contrast upstream, which
kept a separate `Arrow[]` on the instance.)

### 11.3 ArrowGeometry — new service, reuses rect math

Add `services/ArrowGeometry.js`, **sibling of `ConnectorGeometry.js`**. It is
the easy one in CSMA: `LayoutEngine.layout(mapId)` already returns absolute
`{x,y,w,h}` rects for **every** node (verified). Upstream v5 must *measure
DOM* rects; CSMA already *has* them.

```js
arrowPath(fromRect, toRect, opts) → { d, marker }   // cubic bezier M a C c1 c2 b
```

Reuse `ConnectorGeometry`'s rect-edge **anchor helper** to pick attach points
on the two node borders, then emit a bezier `d` (same shape as upstream
`drawArrow`'s `M … C …`). Add one SVG `<marker>` def (arrowhead) in the
svg `<defs>` — token-styled, drawn once.

### 11.4 SVG layer

Render into the **existing `svgLayer`** (the demo already does
`svgLayer.replaceChildren()` + appends tree paths), or a dedicated `arrowLayer`
svg. After `connectorPaths(mapId)`, call the new `arrowPaths(mapId)` and
append:

```html
<path class="arrow-line" data-arrow-id="…" data-from="…" data-to="…"
      data-direction="forward|bidirectional" d="…" marker-end="url(#mm-arrow)">
```

Styling → new `src/ui/components/arrow-line/arrow-line.css` (catalog-style,
token-driven): `stroke: var(--accent)` (forward), dashed variant for
`bidirectional`, `--destructive` for `style.color === 'blocking'` deps. Register
in `src/ui/components/index.css` for parity. Arrowhead via the `<marker>`.

### 11.5 Interaction

- **Link mode** (`linkMode`): first click sets `arrowSource`, second click on a
  valid target calls `addArrow`. Mirrors upstream `linkBidirectional`. Needs a
  small `linkMode` state on `MindmapService` (current `SelectionController`
  is single-`selected`; reuse multi-select to pick 2 nodes, or a dedicated
  source→target flow).
- **Context menu** (`ui/ContextMenu.js`): add `cm-link` (forward) and
  `cm-link-bidirectional` items (upstream names), gated by `option.link`.
- **Select / delete**: click an arrow path → `selectArrow`; `Delete` removes.
- **Re-render on mutation**: `render()` rebuilds `svgLayer` on every
  `renderAfterMut` (drag / collapse / expand / layout change), so arrow paths
  recompute automatically from fresh `LayoutEngine` rects. No extra wiring.

### 11.6 MindmapService API additions

```js
async addArrow(fromId, toId, { direction = 'forward', label, style } = {})
async removeArrow(arrowId)
async updateArrow(arrowId, changes)
getArrows(mapId)
arrowPaths(mapId)                 // pure, like connectorPaths → [{ d, arrow }]
setLinkMode(active, sourceId = null)  // toggles source→target pick
```

Each arrow mutator records a **history op** (like every other mutator),
so undo/redo flows through `history` via `HISTORY_OP_UNDONE` /
`HISTORY_OP_REDONE` — op names `addArrow` / `removeArrow` / `updateArrow`
(mirror the `setLayoutDirection` op pattern at lines 991/1006).

### 11.7 Contracts — `MINDMAP_ARROW_*`

Add to `contracts/mindmap-contracts.js` (currently only collapse/expand
`MINDMAP_STRUCTURE_CHANGED` exists; no arrow contract yet — verified):

| Event | Payload |
|---|---|
| `MINDMAP_ARROW_ADDED` | `{ mapId, arrow }` |
| `MINDMAP_ARROW_REMOVED` | `{ mapId, arrowId }` |
| `MINDMAP_ARROW_UPDATED` | `{ mapId, arrowId, changes }` |
| `MINDMAP_ARROW_SELECTED` | `{ mapId, arrowId \| null }` |
| `MINDMAP_LINK_MODE_CHANGED` | `{ mapId, active, sourceId \| null }` |

### 11.8 Render integration

In `render()` / `mountSurface`: after `connectorPaths`, add
`for (const { d, arrow } of svc.arrowPaths(mapId)) { …append <path class="arrow-line"> }`.
Reuses the node rects already in `nodes`.

### 11.9 v2 verification additions

- [ ] `map.arrows[]` persists via `putMap` (no new object store).
- [ ] `addArrow` rejects ancestor/descendant + self + missing endpoints.
- [ ] Arrow paths recompute after drag / collapse / `setLayoutDirection`.
- [ ] `addArrow` / `removeArrow` survive `svc.undo()` / `svc.redo()`.
- [ ] `arrow-line` stroke is token-driven; arrowhead renders via `<marker>`.
- [ ] `MINDMAP_ARROW_*` events fire and are contract-validated.
