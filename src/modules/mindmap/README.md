# MorphMap Mindmap — CSMA Module

CSMA module providing an interactive mindmap UI for the MorphMap project.
Wraps [mind-elixir](https://github.com/SSShooter/mind-elixir-core) (v5.14, 6.6 KB gzipped, 0 deps) for layout + SVG connectors + collapse/expand. All other behavior (drag-drop, state, undo, sync) handled by CSMA runtime.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CSMA Runtime                                                    │
│  EventBus · ModuleManager · Contracts · SecurityPolicy           │
│  optimistic-sync · sync-queue · AIUIComposer                     │
├─────────────────────────────────────────────────────────────────┤
│  modules/mindmap/                                                │
│  ┌───────────────┐  ┌──────────────────┐  ┌───────────────────┐ │
│  │ MindmapService │  │ mind-elixir/lite │  │ CSMA components   │ │
│  │ (bridge)       │  │ (layout+lines)   │  │ (branch-node,     │ │
│  │ adapts NodeObj │  │ - tree layout    │  │  leaf-node)       │ │
│  │ to CSMA events │  │ - SVG connectors │  │                   │ │
│  │                │  │ - collapse/expand│  │ styled by CSMA    │ │
│  │                │  │ - drag rearrange │  │ design tokens     │ │
│  └───────┬───────┘  └────────┬─────────┘  └────────┬──────────┘ │
│          │                   │                      │            │
│  contracts.js         mind-elixir CSS           manifest.json   │
│  event schemas        overridden by             component defs  │
│                       CSMA tokens                               │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  MorphMap Rust core (future)                                     │
│  SQLite state.db · CognitiveOS GraphStore                        │
│  MCP server (morphmap mcp serve)                                 │
└─────────────────────────────────────────────────────────────────┘
```

## What mind-elixir provides vs what CSMA provides

| Layer | mind-elixir | CSMA |
|-------|------------|------|
| Layout engine (tree→x,y positions) | ✅ `layout.ts` (97 LOC) | — |
| SVG connectors (path between nodes) | ✅ `linkDiv.ts` + `svg.ts` | — |
| Collapse/expand | ✅ `expandNode()` | — |
| Node DOM rendering | `shapeTpc()` — we override | ✅ `branch-node` / `leaf-node` components |
| Drag-drop | `nodeDraggable.ts` plugin — **disabled** | ✅ existing CSMA drag infrastructure |
| Click select | `selection.ts` plugin — **disabled** | ✅ EventBus click events |
| Inline edit | `editTopic()` — **disabled** | ✅ CSMA `contenteditable` via AIUIComposer |
| Undo/redo | `operationHistory.ts` — **disabled** | ✅ optimistic-sync + ActionLog |
| Context menu | `contextMenu.ts` — **disabled** | ✅ CSMA command palette |
| Keyboard binds | `keypress.ts` — **disabled** | ✅ CSMA keyboard module |
| Data format | `NodeObj { topic, id, children, expanded }` | ✅ adapted to CSMA contracts |
| State management | in-memory instance | ✅ CSMA state via optimistic-sync → SQLite |
| Arrows (cross-links) | ✅ but we skip | ✅ CognitiveOS GraphStore edges (future) |

**We use mind-elixir: lite mode** — strips all plugins, keeps only layout + connectors + collapse. ~3 KB gzipped.

## Module structure

```
src/modules/mindmap/
├── README.md                       ← this file
├── index.js                        ← module manifest + exports
├── contracts.js                    ← EventBus contract schemas
├── services/
│   └── MindmapService.js           ← bridge: mind-elixir ↔ CSMA
└── plan/                           ← implementation plan (reference)
    └── components.md               ← component specs
```

### Files to create in CSMA `src/ui/components/`

```
src/ui/components/branch-node/      ← displays a branch (## heading level)
├── manifest.json                   ← ECCA + AIUI manifest
├── branch-node.css                 ← token-driven styles (collapsed, status)
└── branch-node.demo.html           ← dev preview

src/ui/components/leaf-node/        ← displays a leaf (list item with status)
├── manifest.json
├── leaf-node.css
└── leaf-node.demo.html

src/ui/components/connector-line/   ← SVG connector between parent-child
├── manifest.json                   ← type: "SVG" (renders into mindmap SVG layer)
├── connector-line.css
└── connector-line.demo.html
```

## Registration

### 1. Module manifest — `index.js`

```js
// src/modules/mindmap/index.js
import { MindmapService } from './services/MindmapService.js';
import { MindmapContracts } from './contracts.js';

export const manifest = {
  id: 'mindmap',
  name: 'MorphMap Mindmap',
  version: '1.0.0',
  description: 'Interactive mindmap for MorphMap project management',
  dependencies: ['ai-ui'],              // needs component catalog
  services: ['mindmap'],
  contracts: Object.keys(MindmapContracts),
  contributes: {
    views: ['mindmap-view'],
    commands: []                        // future: /mindmap-add-branch etc.
  },
  // Module-scoped components registered with AIUIComposer on MODULE_LOADED
  aiUi: {
    components: ['branch-node', 'leaf-node', 'connector-line']
  }
};

export const services = { mindmap: MindmapService };
export const contracts = MindmapContracts;
```

### 2. Add to `ModuleManager` (no code change — dynamic import)

ModuleManager auto-discovers via `loadModule('mindmap')`. The folder structure
at `src/modules/mindmap/index.js` is the convention. No registration code needed
in ModuleManager itself.

### 3. Component catalog generation

```bash
npm run generate-ai-ui-catalog
# reads src/ui/components/*/manifest.json
# writes src/modules/ai-ui/catalog/componentCatalog.js
```

New components (`branch-node`, `leaf-node`, `connector-line`) appear in the
catalog and are available to AIUIComposer via `service.applyOp({ spec: { component: 'branch-node' } })`.

## Data flow

```
User action (click "+" on branch)
    │
    ▼
MindmapService.addChild(parentId)
    │
    ├── 1. Create NodeObj { topic: "New Branch", id: crypto.randomUUID(), children: [] }
    │
    ├── 2. mind-elixir: mei.addChild(mindElixirNode, newNode)
    │       → layout engine computes x,y
    │       → SVG connectors redrawn
    │       → DOM element created (our branch-node component renders it)
    │
    ├── 3. EventBus.publish('mindmap:node-added', {
    │       nodeId, parentId, node: { topic, metadata: { status: 'pending' } }
    │     })
    │       → Contracts.validate('MINDMAP_NODE_ADDED', payload)
    │       → optimistic-sync records action
    │       → other tiles/subscribers react
    │
    └── 4. (future) optimistic-sync → SSMA gateway → Rust core → SQLite
```

```
AI agent (via MCP)
    │
    ├── tools/call: morphmap_addBranch(args: { name, status, tag })
    │
    ▼
MindmapService.addBranch(name, metadata)
    │  (same flow as above)
    │
    ▼
mindmap:node-added event → UI updates in real-time
```

## Contracts — `contracts.js`

```js
// src/modules/mindmap/contracts.js
import { object, string, array, optional, enums, number } from '../../runtime/validation/index.js';
import { contract } from '../../runtime/Contracts.js';

export const MindmapContracts = {
  MINDMAP_NODE_ADDED: contract({
    version: 1, type: 'event', owner: 'mindmap',
    lifecycle: 'active', stability: 'stable', compliance: 'public',
    description: 'Published when a node is added to the mindmap',
  }, object({
    nodeId: string(),
    parentId: optional(string()),
    topic: string(),
    schemaType: enums(['mindmap/branch', 'mindmap/leaf']),
    metadata: optional(object()),
  })),

  MINDMAP_NODE_REMOVED: contract({
    version: 1, type: 'event', owner: 'mindmap',
    lifecycle: 'active', stability: 'stable', compliance: 'public',
    description: 'Published when a node is removed',
  }, object({
    nodeId: string(),
    cascadeRemoved: array(string()),  // child IDs also removed
  })),

  MINDMAP_NODE_UPDATED: contract({
    version: 1, type: 'event', owner: 'mindmap',
    lifecycle: 'active', stability: 'stable', compliance: 'public',
    description: 'Published when node properties change (status, topic, metadata)',
  }, object({
    nodeId: string(),
    changes: object(),
    previousStatus: optional(string()),
  })),

  MINDMAP_STRUCTURE_CHANGED: contract({
    version: 1, type: 'event', owner: 'mindmap',
    lifecycle: 'active', stability: 'stable', compliance: 'public',
    description: 'Published when tree structure changes (move, reorder, collapse)',
  }, object({
    nodeId: string(),
    operation: enums(['move', 'reorder', 'collapse', 'expand']),
    details: optional(object()),
  })),
};
```

## MindmapService — `services/MindmapService.js`

Key public methods:

| Method | Args | Returns | Events |
|--------|------|---------|--------|
| `init(container, data)` | `HTMLElement, MindElixirData` | `void` | `MINDMAP_INITIALIZED` |
| `getAllData()` | — | `MindElixirData` | — |
| `addBranch(name, meta?)` | `string, object?` | `NodeObj` | `MINDMAP_NODE_ADDED` |
| `addLeaf(parentId, topic, meta?)` | `string, string, object?` | `NodeObj` | `MINDMAP_NODE_ADDED` |
| `updateStatus(nodeId, status)` | `string, string` | `void` | `MINDMAP_NODE_UPDATED` |
| `removeNode(nodeId)` | `string` | `void` | `MINDMAP_NODE_REMOVED` |
| `moveNode(nodeId, newParentId)` | `string, string` | `void` | `MINDMAP_STRUCTURE_CHANGED` |
| `collapseNode(nodeId, collapsed)` | `string, bool` | `void` | `MINDMAP_STRUCTURE_CHANGED` |
| `findNode(nodeId)` | `string` | `NodeObj\|null` | — |
| `toCompactContext()` | — | `object` | — (returns summary for orchestrator) |
| `destroy()` | — | `void` | — |

## Component specs

### branch-node

```
┌────────────────────────────────────────┐
│ 🔄 e2e-test  [phase]                    │  ← status emoji + name + tag
│ ────────────────────────────────────── │
│ ✅ init + plan + delegate verified      │  ← children (leaf-node instances)
│ ✅ scout: recon · researcher: research  │
│ ⬜ test /morphmap-review                │
│                                        │
│ [add leaf]    [archive]    [collapse]   │  ← CSMA buttons (only on hover)
└────────────────────────────────────────┘
```

States (via `data-status` attribute):
- `pending` → muted border, no emoji color
- `in_progress` → blue border, subtle pulse animation
- `done` → green left border, 50% opacity
- `blocked` → red left border, with lock icon
- `collapsed` → shows child count badge "4 items"

### leaf-node

```
┌──────────────────────────────────────┐
│ ✅  test /morphmap-review             │  ← status checkbox + topic text
│     📎 specs/e2e/review.spec.md       │  ← link to spec (opens in tile)
│     🔴 blocking                      │  ← bottleneck tag (if present)
└──────────────────────────────────────┘
```

States:
- `pending` → empty checkbox
- `in_progress` → spinner icon
- `done` → green checkmark
- `blocked` → red ! icon
- `failed` → red ✕ icon

Clicking `📎 spec link` → `context.emit('tile:spawn', { app: 'file-explorer', type: 'preview', data: { path } })` (when in MorphShell tile mode)

### connector-line

Rendered as SVG `<path>` inside the mindmap's SVG layer. mind-elixir's `generateBranch.ts` computes the `d` attribute. We override the stroke color using CSMA design tokens:

```css
me-main line, me-main path {
  stroke: var(--color-border);
  stroke-width: 2;
}
```

## mind-elixir integration

### What we import

```js
import MindElixir from 'mind-elixir/lite';  // IIFE, no tree-shaking needed
```

mind-elixir lite strips: `contextMenu`, `toolBar`, `keypress`, `nodeDraggable`,
`operationHistory`, `selection`, `exportImage`. Keeps: `layout`, `linkDiv`,
`expandNode`, `addChild`, `removeNode`, `reshapeNode`, `init`, `getAllData`.

### What we override

mind-elixir uses custom elements (`<me-tpc>`, `<me-wrapper>`, `<me-main>`).
Styling is done via `shapeTpc()` which applies inline styles. We override via
CSS custom properties:

```css
/* Override mind-elixir defaults with CSMA tokens */
me-tpc {
  font-family: var(--font-sans);
  font-size: var(--font-size-body);
  color: var(--color-foreground);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  transition: background var(--duration-fast), border-color var(--duration-fast);
}

me-tpc[data-status="done"] {
  opacity: 0.6;
  border-color: var(--color-success);
}

me-tpc[data-status="blocked"] {
  border-color: var(--color-destructive);
}

me-tpc[data-status="in_progress"] {
  border-color: var(--color-primary);
  animation: pulse-border 2s ease-in-out infinite;
}
```

### NodeObj format — MorphMap extension

mind-elixir's `NodeObj` has `metadata?: unknown`. We use this for MorphMap data:

```js
const branchNode = {
  topic: "e2e-test",
  id: "e2e-test",
  children: [/* leaves */],
  expanded: true,
  direction: 0,  // right-side layout
  tags: ["🔄", "phase"],  // mind-elixir renders these as visible badges
  metadata: {
    schemaType: "mindmap/branch",
    status: "in_progress",
    tag: "phase",
    blockedReason: null,
    leafCount: 5,
    doneCount: 3,
  }
};
```

## MorphShell tile integration

When loaded inside MorphShell, the mindmap module runs as a tile:

```
apps/morphmap/
├── tiles-manifest.json
│   {
│     "app": "morphmap",
│     "version": "1.0.0",
│     "tiles": [
│       { "id": "mindmap", "type": "viewer", "label": "MorphMap",
│         "primary": true, "mount": "./tiles/mindmap.js" },
│       { "id": "doc-viewer", "type": "viewer", "label": "Document",
│         "mount": "./tiles/doc-viewer.js", "spawnable": true }
│     ],
│     "events": { "listens": ["tile:focus"], "emits": ["tile:spawn"] }
│   }
└── tiles/
    ├── mindmap.js    ← mount(container, context) → uses MindmapService
    └── doc-viewer.js ← renders .spec files / decisions.md
```

### Tile mount module — `tiles/mindmap.js`

```js
// apps/morphmap/tiles/mindmap.js
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';

export function mount(container, context) {
  const service = new MindmapService(context.eventBus);
  
  service.init(container, defaultData);

  // Click on leaf spec link → open in new tile
  service.eventBus.subscribe('mindmap:leaf-link-clicked', ({ path, label }) => {
    context.emit('tile:spawn', {
      app: 'morphmap',
      type: 'doc-viewer',
      data: { path },
      label: label || path,
      position: 'right'
    });
  });

  return {
    update(data) { service.updateFromData(data); },
    destroy() { service.destroy(); }
  };
}
```

## References

| Resource | Path / URL |
|----------|-----------|
| mind-elixir (core library) | `~/Documents/vibe/mind-elixir-core/` · [github.com/SSShooter/mind-elixir-core](https://github.com/SSShooter/mind-elixir-core) |
| CSMA runtime | `~/Documents/github/CSMA-SSMA/CSMA/src/runtime/` |
| CSMA AI-UI Composer | `~/Documents/github/CSMA-SSMA/CSMA/src/modules/ai-ui/` |
| CSMA AI module (provider pattern) | `~/Documents/github/CSMA-SSMA/CSMA/src/modules/ai/` |
| CSMA analytics module (reference) | `~/Documents/github/CSMA-SSMA/CSMA/src/modules/analytics/` |
| CSMA component format | `~/Documents/github/CSMA-SSMA/CSMA/src/ui/components/card/manifest.json` |
| MorphMap project | `~/Documents/current/Morph/MorphMap/` |
| MorphShell tile system | `~/Documents/current/Morph/MorphShell/src/modules/tile-mount-service.js` |
| CognitiveOS (future backend) | `~/Documents/current/CognitiveOS/v3/` |
| rustlm (Jaccard+Leiden pruning) | `~/Documents/github/rustlm/` |
| mind-elixir lite export | `mind-elixir/lite` → `dist/MindElixirLite.iife.js` |
| mind-elixir NodeObj type | `src/types/index.ts` → `NodeObj` interface |

## Implementation order

1. **Component scaffolding** — `branch-node`, `leaf-node`, `connector-line` manifest.json + CSS
2. **MindmapService** — wraps mind-elixir/lite, bridges to CSMA EventBus
3. **Module registration** — `index.js` + `contracts.js` → ModuleManager.loadModule('mindmap')
4. **Standalone test page** — `demo/mindmap.html` with sample MorphMap data
5. **MorphShell tile integration** — `apps/morphmap/tiles-manifest.json` + `tiles/mindmap.js`
6. **MCP tools** — via browser extension → `morphmap_getAllData`, `morphmap_addBranch`, etc.
7. **Backend sync** — optimistic-sync → Rust core → SQLite (when backend ready)

## developer quickstart

```bash
# 1. Build mind-elixir (if not already in node_modules)
cd ~/Documents/vibe/mind-elixir-core
npm install && npm run build
# dist/MindElixirLite.iife.js is the file we import

# 2. Link into CSMA
cd ~/Documents/github/CSMA-SSMA/CSMA
npm install

# 3. Generate AI-UI catalog (after creating component manifests)
npm run generate-ai-ui-catalog

# 4. Dev server
npm run dev
# → open http://localhost:5173/demo/mindmap.html

# 5. Tests
npx vitest run tests/mindmap-service.test.js
```
