# Plan — `agent-context` module

> Status: planning. Order: **2 of 3** (after `history`, before `mindmap`).

## Goal

Provide one in-browser API any CSMA module can use to expose its state to
an AI agent, with format negotiation (`markdown`, `json`, `ascii`,
filtered). Domain serializers live with each feature module; this module
owns transport, dispatch, and format selection.

## Background

CSMA has `ai` (provider/client) and `ai-ui` (secure DOM composer), but
**no layer for exposing runtime state to an agent as text**. The mindmap
README proposed a `toMarkdown()` helper, but baking LLM-context logic into
one module would force every future module (cart, comments, audit-log,
catalog) to reinvent the same plumbing.

The CSMA-idiomatic answer is **generic transport + per-module serializers
registered via `contributes`**. This matches the existing pattern: every
module already declares `contributes: { commands, navigation, panels,
adapters, views }`. We add one new contribution type:
`contextSerializers`.

Per decision **1a**, v1 ships in-browser API only. MCP server transport
is deferred — the service interface is shaped so a future `mcp-bridge`
module can wrap it without changes.

## Dependencies

- **Consumes:** `runtime/EventBus`, `runtime/Contracts`,
  `runtime/ModuleManager` (for the contributions registry),
  `runtime/ModuleManifest` (to add the new contribution type).
- **Optional:** `history` (for change subscriptions / cursor-based
  updates), `storage` (to enumerate stores).
- **Consumed by:** any module that wants its state readable by an agent.
  First consumer: `mindmap`.

## Architecture

```
src/modules/agent-context/
├── plan.md                              ← this file
├── README.md                            ← written at end of phase 4
├── index.js                             ← manifest + service export
├── contracts/
│   └── agent-context-contracts.js       ← AGENT_CONTEXT_* events
└── services/
    ├── AgentContextService.js           ← get(), formats(), stores()
    ├── SerializerRegistry.js            ← accepts contributes, dispatches
    └── formats/
        ├── MarkdownFormatter.js         ← generic markdown fallback
        ├── JsonFormatter.js             ← minimal-json fallback
        └── AsciiFormatter.js            ← ascii-tree fallback
```

### Runtime change — `ModuleManifest.js`

Add `'contextSerializers'` to `MODULE_CONTRIBUTION_TYPES`:

```js
export const MODULE_CONTRIBUTION_TYPES = [
  'commands', 'navigation', 'panels', 'adapters', 'views',
  'contextSerializers'   // ← new
];
```

Add a matching entry in `ModuleManager.js`'s `REGISTRY_KEY_BY_CONTRIBUTION`
map so the new contributions route to `SerializerRegistry`.

### Contribution shape (declared by each feature module)

```js
// mindmap/index.js
export const manifest = {
  id: 'mindmap',
  // ...
  contributes: {
    contextSerializers: [
      {
        store: 'maps',                   // IDB store or logical name
        format: 'markdown',              // 'markdown' | 'json' | 'ascii' | custom
        fn: 'serializeMapToMarkdown',    // name exported by module, or inline
        label: 'Mindmap (markdown)',
        default: true                    // pre-selected by formats() listing
      },
      { store: 'maps', format: 'ascii', fn: 'serializeMapToAscii' },
      { store: 'maps', format: 'json',  fn: 'serializeMapToMinimalJson' }
    ]
  }
};
```

The serializer function signature:

```ts
type Serializer = (
  data: any,                             // raw record(s) from the store
  options: {
    filter?: object,                     // domain-specific filter
    depth?: number,                      // tree depth limit
    cursor?: string                      // for incremental updates
  }
) => string | { text: string, cursor?: string }
```

## Public API

```js
class AgentContextService {
  init({ eventBus, moduleManager, storage }) {}

  // discovery
  stores() → string[]                    // all stores with registered serializers
  formats(store) → FormatInfo[]          // formats available for a store
  serializers(store?) → SerializerInfo[] // full listing for UI / debugging

  // primary read
  get({
    store,                               // required
    format = 'markdown',                 // default
    id?,                                 // specific record, else whole store
    filter?,                             // domain-specific
    depth?,                              // tree depth limit
    cursor?                              // incremental
  }) → Promise<{ text, format, cursor?, truncated? }>

  // explicit registration (for non-manifest users / tests)
  register({ store, format, fn, label, default }) → void
  unregister(moduleId) → void            // called by ModuleManager on unload

  // optional change subscription (needs history module)
  subscribe({ store, format, filter }, cb) → unsubscribe
}
```

**Defaults & fallbacks:**

- If no serializer is registered for `{store, format}`, fall back to
  generic `MarkdownFormatter` / `JsonFormatter` / `AsciiFormatter` which
  operate on plain records (best-effort; produces usable but not
  domain-tuned output).
- `markdown` is the default format (best token economy for LLMs).
- `get()` truncates at 50KB by default and returns `truncated: true` +
  `cursor` for pagination.

## Contracts

```js
AGENT_CONTEXTQueried   // { store, format, id?, bytes, truncated }
AGENT_CONTEXT_REGISTERED // { store, format, moduleId }
AGENT_CONTEXT_UNREGISTERED // { moduleId }
```

(No payload-validation burden for callers — these are observability
events; the actual data moves through the return value of `get()`.)

## Implementation phases

### Phase 1 — Runtime contribution plumbing

1. Add `'contextSerializers'` to `MODULE_CONTRIBUTION_TYPES` in
   `runtime/ModuleManifest.js`. The existing `ensureContributes` validator
   already iterates the array, so validation comes for free.
2. Add a registry mapping in `runtime/ModuleManager.js`:
   `REGISTRY_KEY_BY_CONTRIBUTION.contextSerializers = 'serializer'`.
3. Verify the existing test suite for ModuleManager still passes (the
   `contributes` validator tests should pick up the new type).

**Test:** a stub module declaring `contextSerializers` loads without
error and `ModuleManager.summarizeContributions()` reports the count.

### Phase 2 — Service skeleton

1. Create `AgentContextService.js` with `init`, `register`, `unregister`,
   `stores`, `formats`, `serializers`.
2. Wire it into `ModuleManager` so module load/unload calls
   `register` / `unregister` automatically (mirror how `commands` and
   `panels` registries are wired).
3. Register the service globally (like `eventBus`, `storage`) so any
   module can `import` it.

**Test:** register a fake serializer, dispatch via `get()`, assert the
serializer is called with the right options.

### Phase 3 — Generic formatters

1. Implement `MarkdownFormatter`, `JsonFormatter`, `AsciiFormatter` as
   best-effort formatters over arbitrary record shapes.
   - Markdown: `## storeName` heading + `- key: value` lines per record,
     nested objects indented.
   - JSON: stable key order, no whitespace, IDs optional.
   - Ascii: `├─` / `└─` tree drawing over arrays and nested objects.
2. Use them as fallbacks when no domain serializer is registered.

**Test:** each formatter over a representative record produces stable,
non-empty output under 1KB.

### Phase 4 — Optional history subscription

1. If `history` module is loaded, expose `subscribe({store, format})`.
2. Internally: listen for `HISTORY_OP_RECORDED` for the matching store,
   re-run the serializer, call back.
3. If `history` is not loaded, `subscribe()` throws a clear error
   (`[AgentContext] subscription requires history module`).

**Test:** record an op in history → subscriber receives updated text.

### Phase 5 — README + finalize

1. Write `agent-context/README.md` (API, contribution shape, how to add a
   serializer to a feature module, fallback behavior, truncation rules).
2. Add a section to `docs/architecture/SKILL.md` describing the
   agent-context contract.
3. Mark plan complete.

## Tests

`tests/agent-context/`:

- `serializer-registry.test.js` — register/unregister, dispatch by
  `{store, format}`, fallback when missing, moduleId-scoped unregister.
- `formatters.test.js` — three generic formatters, golden-output for
  small records, truncation behavior.
- `agent-context-service.test.js` — end-to-end: declare a stub module
  with `contextSerializers`, load via ModuleManager, call `get()`,
  receive text.
- `agent-context-subscription.test.js` — history integration, gated on
  `FEATURES.HISTORY`.

Property-based via `fast-check`:

- For any record shape, the generic markdown formatter produces output
  that round-trips through a minimal parser back to an equivalent shape
  (lossy on types, but keys preserved).

## Out of scope (v1)

- **MCP server transport.** Decision **1a** explicitly defers. The
  service interface (`get`, `subscribe`, `formats`) is shaped so a
  future `src/modules/mcp-bridge/` module can wrap it without API
  changes. That future module would expose tools `csma_query`,
  `csma_subscribe`, `csma_formats`.
- **Streaming / partial responses.** v1 returns complete strings with
  truncation + cursor. True streaming can be added later behind the same
  `get()` signature using async iterators.
- **Authentication / authorization of agent callers.** Assumes the
  in-browser agent is trusted (same origin). Cross-origin or
  extension-based agents need the MCP bridge + an auth layer.
- **Caching of serialized output.** Cheap enough to recompute on each
  `get()` for v1; add an LRU if profiles show hot spots.

## Open questions

1. **Filter DSL.** Each domain serializer defines its own `filter`
   semantics. Should `agent-context` ship a tiny shared filter grammar
   (`{status: ['blocked']}`, `{tags: ['phase']}`, `{updatedSince: ts}`),
   or leave it fully domain-specific and just pass the object through?
   Lean: **shared grammar** — small enough to be worth standardizing.
2. **Cursor stability across format changes.** If a module registers a
   new serializer mid-session, what happens to outstanding cursors?
   Lean: invalidate, emit `AGENT_CONTEXT_INVALIDATED`.
3. **Per-store namespacing.** Multiple modules could claim the same
   store name. Validate uniqueness at registration time, or namespace
   automatically by moduleId (`mindmap:maps`)?
