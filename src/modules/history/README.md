# history module

Generic, sync-agnostic do/undo/redo + append-only operation log with IDB
persistence and multi-tab broadcast.

Extracted from `optimistic-sync/services/ActionLogService.js` (Wave 1 hard
cut). Owns the LOG only — sync semantics (acked / failed / pending) live
in `optimistic-sync/services/SyncStateTracker.js`, which layers on top of
this module.

## What it does

- Appends operation entries with `record(intent, payload, meta)`
- Reverses / re-applies entries via `undo()` / `redo()`
- Persists entries to IndexedDB (memory fallback in jsdom)
- Broadcasts changes across tabs via `BroadcastChannel`
- Exposes a cursor for incremental consumers

## What it does NOT do

- Sync to a backend (that's `optimistic-sync`)
- Track acked / failed state (that's `SyncStateTracker`)
- Elect a leader across tabs (single-user local-first for v1)
- Compress / snapshot / reconcile (full entry retention for v1)

## Public API

```js
import { services } from './src/modules/history/index.js';
const history = new services.history(eventBus);
await history.init({ broadcast: true });

history.record(intent, payload, { undo, channels, crdt, actor });
history.undo({ steps: 1 });
history.redo({ steps: 1 });
history.canUndo();
history.canRedo();
history.getAll();
history.getSince(cursor);
history.hasEntry(id);
history.removeEntry(id);     // used by SyncStateTracker on ack
history.updateEntry(id, patch);
history.cursor;               // getter, opaque string
history.clock;                // getter, monotonically advancing
```

## Entry shape

```js
{
  id,           // string, crypto.randomUUID()
  intent,       // string
  payload,      // any
  status,       // 'recorded' | 'undone' | 'redone'
  attempts,     // number, used by sync layer
  createdAt,    // number, ms epoch
  updatedAt,    // number, ms epoch
  meta: {
    clock,      // number, monotonic
    channels,   // string[], default ['global']
    undo,       // { intent, payload } | null
    reducer,    // string | undefined
    actor,      // string | undefined
    crdt        // object | undefined (sanitized)
  }
}
```

## Contracts

| Event | Payload | When |
|-------|---------|------|
| `HISTORY_OP_RECORDED` | `{ entry?, store?, intent? }` | `record()` or `ingest()` |
| `HISTORY_OP_UNDONE` | `{ entry: { id, intent }, cursor }` | `undo()` |
| `HISTORY_OP_REDONE` | `{ entry: { id, intent }, cursor }` | `redo()` |
| `HISTORY_LOG_READY` | `{ count }` | `init()` completes |

## Migration notes (for optimistic-sync consumers)

The old `actionLog` service export is **removed**. Consumers must obtain the
history service via `serviceManager.get('history')` and pass it as
`historyService` to `OptimisticSyncService.init`. The former `markAcked` /
`markFailed` / `getPending` / `updatePayload` methods are now on
`SyncStateTracker`, accessed internally by `OptimisticSyncService`.

## See also

- `plan.md` — original implementation plan, open questions, out-of-scope items
- `src/modules/optimistic-sync/services/SyncStateTracker.js` — sync overlay
- `src/modules/optimistic-sync/services/CrdtReducerRegistry.js` — CRDT reducer (consumes history)
