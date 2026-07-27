# mindmap module

Interactive, local-first mindmap for CSMA. Headless: only the layout math
from [`mind-elixir-core`](https://github.com/SSShooter/mind-elixir-core) is
ported (as pure functions returning absolute rectangles). All DOM, state,
persistence, and undo/redo are owned by CSMA.

## What it does

- Tree CRUD: branches and leaves, each with `status`, `tag`, optional
  `metadata.bottleneck`, `metadata.specPath`, `metadata.note`.
- Undo/redo backed by the `history` module — every mutator records an
  op and reverses cleanly via the `HISTORY_OP_UNDONE` / `_REDONE` events.
- Multi-map: each map persists its tree to IDB (`mindmap_maps` and
  `mindmap_map_nodes` object stores).
- Search: fuzzy match over `topic` with optional `status` / `tag` filters,
  returns path-from-root.
- Collapse / expand branches.
- Drag-drop reorder (callers wire HTML5 DnD; `moveNode` is the source of
  truth and rejects cycles and leaf targets).
- Three serializers (markdown / ascii / minimal-json) registered with the
  `agent-context` module. Markdown is the default format for LLM context.

## Architecture

```
src/modules/mindmap/
├── index.js                    module manifest + contributes.contextSerializers
├── contracts/                  8 MINDMAP_* EventBus contracts
└── services/
    ├── MindmapService.js       tree CRUD, history integration, layout helpers
    ├── MindmapStore.js         IDB adapter (storage module) with memory fallback
    ├── LayoutEngine.js         pure-function tree layout (ported direction model)
    ├── ConnectorGeometry.js    SVG path generators (faithful port of generateBranch.ts)
    ├── MarkdownCodec.js        markdown / ascii / json serializer + best-effort parser
    └── Search.js               fuzzy subsequence search with path-from-root
```

## What is NOT in v1

- Backend sync (SSMA gateway, SQLite, multi-device).
- Cross-links / arrows between non-parent nodes.
- Real-time multi-user collaboration.
- Image / SVG / PDF export.

See `plan.md` §Out of scope for the full list.

## Public API (condensed)

```js
const mindmap = serviceManager.get('mindmap');
mindmap.init({ storage, history, agentContext, aiui });

const mapId = await mindmap.createMap('My map');
const branch = await mindmap.addBranch(mindmap.rootId(mapId), 'e2e-test', { tag: 'phase' });
const leaf = await mindmap.addLeaf(branch.id, 'write tests');

await mindmap.updateStatus(leaf.id, 'done');
await mindmap.collapse(branch.id, true);
await mindmap.moveNode(leaf.id, anotherBranch.id);

mindmap.undo();   // proxied to history
mindmap.redo();

mindmap.search(mapId, 'test', { status: ['done'] });
mindmap.toMarkdown(mapId, { filter: { status: ['blocked'] } });
```

## Integration with other CSMA modules

- `history` — records `mindmap` ops; subscribes to `HISTORY_OP_UNDONE`
  and `HISTORY_OP_REDONE` to reverse / re-apply state.
- `agent-context` — three serializers registered on init, dispatched via
  the runtime `SerializerRegistry`.
- `ai-ui` — `mind-node`, `mind-node`, `connector-line` components are
  in the catalog and mountable via `applyOp({spec:{component:'mind-node'}})`.
- `storage` — IDB primitive wrapped by `MindmapStore`.

## Attribution

Layout direction model and SVG connector geometry are derived from
`mind-elixir-core` (MIT). See `vendor/MIND_ELIXIR_LICENSE`. The pure
function layout (`LayoutEngine.layout`) is a fresh ES implementation —
mind-elixir relies on CSS-driven positioning of `me-*` custom elements,
so there is no upstream pure function to port verbatim.
