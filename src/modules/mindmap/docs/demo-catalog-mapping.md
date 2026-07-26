# Demo → Catalog Component Mapping (mindmap)

How `demo/mindmap.html` was re-skinned onto the CSMA catalog components
`branch-node`, `leaf-node`, and `connector-line`.

## Layout-model reality (read first)

The demo renders an **absolute canvas**: `MindmapService.layout()` returns a
rectangle `{x,y,w,h}` per node, and `render()` positions every node with
inline `left/top/width/height`. This is the ported `mind-elixir` model.

The catalog `branch-node` is a **nested flex** component: it renders its own
header **and** nests `.leaf-node` children inside `.branch-node__leaves`. It is
meant to be composed via `ai-ui` as a recursive tree, not positioned by an
external layout engine.

Because of that mismatch this mapping is a **skin reskin (Option A)**: the demo
keeps its canvas + `svc.layout`, but each absolutely-positioned node now wears
the catalog class names and token-driven CSS. The nested-leaves DOM structure is
**not** reproduced (leaves remain independent positioned nodes) — see Option B.

## Element correspondence

| Demo DOM (before) | Catalog component | Mapped how |
|---|---|---|
| `.mm-node[data-kind="root"]` | `branch-node[data-kind="root"]` | class swap; root border via `--primary/--accent` token |
| `.mm-node[data-kind="branch"]` | `branch-node` | class swap; inner `.branch-node__header` + `.branch-node__status` + `.branch-node__topic` + (`.branch-node__tag` if `node.tag`) |
| `.mm-node[data-kind="leaf"]` | `leaf-node` | class swap; inner `.leaf-node__status` + `.leaf-node__topic` |
| `.mm-node[data-status="…"]` | `branch-node[data-status]` / `leaf-node[data-status]` | **previously no CSS** — catalog now colors border + status glyph by status (net improvement) |
| `.mm-expander[.collapsed]` | `branch-node__collapse` | `<button>`; glyph driven by `data-collapsed="true"` on the `.branch-node`; kept at the node's side via adapter CSS |
| `.mm-node[data-selected]` | `[data-selected]` | generic adapter rule (catalog only styled `.leaf-node`) |
| `.mm-connector` | `connector-line` | **1:1 rename**; `data-link-kind` + `data-status` preserved → token stroke colors |

### Attributes / props

| Demo attribute | Catalog prop / selector | Notes |
|---|---|---|
| `data-node-id` | `data-node-id` | kept on the node element; menu/drag/edit still read it |
| `data-kind` | `data-kind` (root only styled) | kept for parity |
| `data-status` | `data-status` | drives border/status colors |
| `node.tag` | `.branch-node__tag` text | rendered only when present |
| `node.metadata.bottleneck` | `data-bottleneck` | pill via `::after` when `blocking`/`risky` |
| `node.expanded === false` | `data-collapsed="true"` on `.branch-node` | powers collapse glyph |

## Connector — clean 1:1

`p.classList.add('mm-connector')` → `p.classList.add('connector-line')`.
`connectorPaths()` still supplies `d`, `link.kind` (`data-link-kind`),
and child `status` (`data-status`). `connector-line.css` colors the stroke
from tokens.

## Demo-only UI kept out of the catalog

These are not catalog components and were left untouched:
`.mm-menu`, `.mm-ghost`, `.mm-preview-bar`, `.mm-preview-outline`,
`.mm-edit-input`, `.mm-zoom-bar`, `.canvas` pan/zoom scaffolding.

## Adapter CSS added to the demo `<style>`

```css
.node-layer .branch-node,
.node-layer .leaf-node { position: absolute; box-sizing: border-box; }
.node-layer .branch-node { min-width: 0; }   /* respect svc.layout width */
.node-layer [data-selected] { outline: 2px solid var(--accent, #4f90f2); outline-offset: 2px; }
.branch-node .branch-node__collapse { /* side-positioned, token-styled */ }
```

## Option B (not done) — true component composition

Replace the canvas loop with recursive `ai-ui` composition:

```
branch-node (data-kind, data-status, data-tag)
└─ branch-node__header
└─ branch-node__leaves  ← svc.layout removed; children rendered in flow
   ├─ leaf-node (data-status, data-bottleneck)
   └─ nested branch-node …
```

Trade-offs: drops the `mind-elixir` side/radial canvas (no more
`svc.layout`/`setLayoutDirection`), gains pure catalog rendering and
theme/variance consistency, but loses the demo's signature free-form canvas.
Pick this only if the canvas model is no longer wanted.
