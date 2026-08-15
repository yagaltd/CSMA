# Agent Context

Generic in-browser service that exposes CSMA module state to AI agents
with format negotiation. Domain serializers are contributed by feature
modules via `contributes.contextSerializers`; this module owns transport,
dispatch, and format selection.

v1 ships **in-browser API only**. MCP server transport is deferred (the
`get()` / `subscribe()` surface is shaped so a future `mcp-bridge` module
can wrap it without API changes).

## Quick start

```js
import { AgentContextService } from './src/modules/agent-context/services/AgentContextService.js';

const agentContext = new AgentContextService(eventBus);
agentContext.init({ serializerRegistry, serviceManager });

const response = await agentContext.get({
  store: 'maps',
  format: 'markdown',
  data: someNodeTree
});
console.debug(response.text);
```

## Registering a serializer (feature module)

Declare serializers in the module manifest:

```js
// src/modules/mindmap/index.js
export const manifest = {
  id: 'mindmap',
  // ...
  contributes: {
    contextSerializers: [
      { store: 'map_nodes', format: 'markdown', fn: 'toMarkdown', default: true, label: 'Mindmap (markdown)' },
      { store: 'map_nodes', format: 'ascii',    fn: 'toAscii' },
      { store: 'map_nodes', format: 'json',     fn: 'toMinimalJson' }
    ]
  }
};
```

When ModuleManager loads the module, contributions are routed to the
`SerializerRegistry` (a runtime registry created in `bootstrap.js`). The
serializer `fn` may be:

- a function (inline)
- a string export name — resolved against the module's service registered
  with `serviceManager` (e.g. `'toMarkdown'` → `serviceManager.get('mindmap').toMarkdown()`)

The serializer signature is:

```ts
type Serializer = (
  data: any,
  options: {
    store: string;
    id?: string;
    filter?: object;
    depth?: number;
    cursor?: string;
    format: string;
  }
) => string | { text: string; cursor?: string };
```

## API

### Discovery

- `stores()` → `string[]` — distinct store names with at least one registered serializer
- `formats(store)` → `FormatInfo[]` — formats available for a store (always includes the three built-in fallbacks)
- `serializers(store?)` → `SerializerInfo[]` — full listing of registered serializers

### Read

- `get({ store, format = 'markdown', id?, data?, filter?, depth?, cursor?, maxLength = 50_000 })` → `Promise<{ text, format, bytes, truncated?, cursor? }>`

### Registration (non-manifest users / tests)

- `register({ store, format, fn, label?, default?, moduleId = 'adhoc' })` → entry
- `unregister(moduleId)` → count removed

### Subscription (requires `history` module)

- `subscribe({ store, format = 'markdown', filter? }, callback)` → unsubscribe
- Callback receives `(response, { store, format })` on each matching `HISTORY_OP_RECORDED` event
- Throws `[AgentContext] subscription requires history module` if history is not loaded

## Fallback behavior

If no serializer is registered for `{ store, format }`, the service uses
one of three built-in generic formatters:

- **MarkdownFormatter** — `## store` heading + `- key: value` nested list
- **JsonFormatter** — minimal JSON envelope with sorted keys
- **AsciiFormatter** — `├─` / `└─` Unicode tree drawing

Generic output is usable but not domain-tuned. Register a domain
serializer whenever the LLM should see semantic structure (status emoji,
nested hierarchy, etc.).

## Contracts

| Event | When | Payload |
|-------|------|---------|
| `AGENT_CONTEXT_QUERIED` | after `get()` resolves | `{ store, format, id?, bytes, truncated, cursor? }` |
| `AGENT_CONTEXT_REGISTERED` | on `register()` | `{ moduleId, store, format, label?, isDefault? }` |
| `AGENT_CONTEXT_UNREGISTERED` | on `unregister(moduleId)` | `{ moduleId, count }` |
| `AGENT_CONTEXT_INVALIDATED` | when outstanding cursors are invalidated (e.g. serializer replaced) | `{ store, format, reason, details? }` |

These events are observability-only — the serialized data never travels
through them.

## Open questions (lean defaults taken)

1. **Filter DSL.** Each domain serializer defines its own `filter`
   semantics. v1 passes the filter object through verbatim. A shared
   filter grammar can be standardised later if patterns converge.
2. **Cursor stability across format changes.** Registering a new
   serializer for an existing `{ store, format }` publishes
   `AGENT_CONTEXT_INVALIDATED`. Outstanding cursors are not auto-resumed.
3. **Per-store namespacing.** Entry ids are `${moduleId}:${store}:${format}`,
   so two modules may register serializers for the same store+format.
   Dispatch returns the first registered. Validate stricter uniqueness
   if collisions cause ambiguity in practice.

## Files

```
src/modules/agent-context/
├── README.md                              ← this file
├── plan.md                                ← original plan
├── index.js                               ← manifest + service export
├── contracts/
│   └── agent-context-contracts.js         ← AGENT_CONTEXT_* contracts
└── services/
    ├── AgentContextService.js             ← dispatcher
    └── formatters/
        ├── MarkdownFormatter.js           ← generic markdown fallback
        ├── JsonFormatter.js               ← generic json fallback
        └── AsciiFormatter.js              ← generic ascii fallback

src/runtime/SerializerRegistry.js          ← runtime registry (extends ContributionRegistry)
```

## Out of scope (v1)

- MCP server transport (deferred per decision 1a)
- Streaming responses (returns complete strings + truncation cursor)
- Authentication / authorization (assumes same-origin trusted agent)
- Output caching (recompute per `get()`)
