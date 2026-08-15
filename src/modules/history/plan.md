# Plan — `history` module

> Status: planning. Order: **1 of 3** (no upstream module deps beyond `storage`).

## Goal

Extract a generic, reusable do/undo/redo + append-only operation log from
`optimistic-sync/services/ActionLogService.js` into a standalone module so
that multiple consumers (`optimistic-sync`, `mindmap`, later
`visual-editor`) share one primitive instead of duplicating journal logic.

## Background

CSMA today has no general-purpose history module. The closest thing is
`ActionLogService` (494 LOC), buried inside `optimistic-sync`. It already
solves the hard parts of a journal:

- append-only op log with `before`/`after` snapshots (the diff)
- IDB-backed persistence via a swappable store
- `BroadcastChannel` multi-tab synchronization
- CRDT hooks (`g-counter`, `pn-counter`, `lww-register`)
- EventBus integration (`OPTIMISTIC_ACTION_RECORDED`, etc.)
- clock-based ordering

But its naming and event surface are coupled to backend sync semantics
(`markAcked`, `markFailed`, `getPending`, `updatePayload` are sync concerns,
not history concerns). Three upcoming consumers need the log without the
sync baggage: `mindmap` (local-only undo/redo), `visual-editor` (already
reinvents this in `engine/Transaction.js`, its own history stack),
and `optimistic-sync` itself (which should layer sync on top of a generic
log, not own the log).

## Dependencies

- **Consumes:** `storage` (IDB primitive), `runtime/EventBus`,
  `runtime/Contracts`, `runtime/ModuleManager`.
- **Consumed by (after hard cut):** `optimistic-sync`, `mindmap`,
  `agent-context` (optional, for change subscriptions).
- **No dependency on:** sync transport, network status, leader election.

## Architecture

```
src/modules/history/
├── plan.md                              ← this file
├── README.md                            ← written at end of phase 4
├── index.js                             ← manifest + service export
├── contracts/
│   └── history-contracts.js             ← HISTORY_* event schemas
└── services/
    ├── HistoryService.js                ← core: record/undo/redo/query
    ├── HistoryStore.js                  ← IDB adapter (uses storage module)
    └── BroadcastSync.js                 ← multi-tab channel (extracted as-is)
```

### Boundary with `optimistic-sync`

`HistoryService` owns the **log**. `optimistic-sync` keeps owning **sync
state** (acked / failed / pending / retry). Split:

| Stays in `history` | Stays in `optimistic-sync` |
|---|---|
| `record(intent, payload, meta)` | `markAcked(id)` |
| `undo()` / `redo()` | `markFailed(id, err)` |
| `getAll()` / `getSince(cursor)` | `getPending()` |
| `ingest(entry)` (multi-tab) | `updatePayload(id, newPayload)` |
| persistence | transport (SSMA gateway) |
| BroadcastChannel sync | leader election wiring |
| CRDT reducer registry hook | CRDT reducer registry (consumes history) |

`CrdtReducerRegistry` stays in `optimistic-sync` because CRDTs only matter
when sync is in play. It will inject `HistoryService` instead of
`ActionLogService` (constructor rename only).

## Public API

### `HistoryService`

```js
class HistoryService {
  init({ eventBus, store, broadcast = true }) {}
  destroy() {}

  // append
  record(intent, payload, meta = {}) → entry
  ingest(entry, { emit = true } = {}) → entry      // for remote/multi-tab entries

  // navigate
  undo({ steps = 1 } = {}) → entry | null
  redo({ steps = 1 } = {}) → entry | null
  canUndo() → bool
  canRedo() → bool

  // query
  getAll() → entry[]
  getSince(cursor) → entry[]                       // cursor = entry.id or timestamp
  hasEntry(id) → bool
  get cursor() → string                            // monotonically advancing

  // meta
  get clock() → number
}
```

`meta` accepts `{ undo, reducer, actionCreator, actor, crdt, channels }`
—the same shape `ActionLogService.record` already accepts—so this is a
pure rename + move for the call sites.

### Entry shape (unchanged from current ActionLog entry)

```js
{
  id, intent, payload,
  meta: { undo, reducer, actionCreator, actor, crdt, channels },
  clock, ts, status: 'recorded'
}
```

`status` values for pure history: `recorded`, `undone`, `redone`.
Sync states (`acked`, `failed`, `pending`) are tracked **outside** the
entry by `optimistic-sync` (as they are today, just in a different file).

## Contracts

```js
HISTORY_OP_RECORDED     // { entry }
HISTORY_OP_UNDONE       // { entry, cursor }
HISTORY_OP_REDONE       // { entry, cursor }
HISTORY_LOG_READY       // { count }
```

`OPTIMISTIC_ACTION_RECORDED` / `_ACKED` / `_FAILED` remain in
`optimistic-sync` and are published by `OptimisticSyncService` (which now
subscribes to `HISTORY_OP_RECORDED` and re-emits under the old name for
back-compat inside the module).

## Implementation phases

### Phase 1 — Extract (no behavior change)

1. Create `src/modules/history/` skeleton (manifest, index, contracts).
2. Copy `ActionLogService.js` → `history/services/HistoryService.js`.
   Rename class. Strip sync-specific methods (`markAcked`, `markFailed`,
   `getPending`, `updatePayload`) — they move to a new
   `optimistic-sync/services/SyncStateTracker.js` (thin, ~80 LOC) that
   decorates entries with sync status in-memory.
3. Copy the IDB adapter and `BroadcastChannel` helpers verbatim into
   `HistoryStore.js` and `BroadcastSync.js`.
4. Register history as a feature in `runtime/features.js` under
   `FEATURES.HISTORY` (default on when `FEATURES.SYNC_QUEUE` or
   `FEATURES.OPTIMISTIC_SYNC` is on, otherwise opt-in).

**Test:** history module loads standalone, `record()` persists to IDB,
`undo()`/`redo()` round-trip a simple intent.

### Phase 2 — Migrate `optimistic-sync` (hard cut)

Per decision **2b**, CSMA is still in development; we break internal
imports cleanly.

1. Update `optimistic-sync/index.js`:
   - Drop `ActionLogService` export.
   - Add `dependencies: ['history']`.
   - Keep service id `actionLog` as an **alias** re-exporting
     `HistoryService` for any in-flight branch code, but document it as
     deprecated in the module README.
2. Update `OptimisticSyncService.js`:
   - Inject `historyService` (renamed from `actionLogService`).
   - Move `markAcked` / `markFailed` / `getPending` / `updatePayload`
     calls into the new `SyncStateTracker.js`.
3. Update `CrdtReducerRegistry.js` constructor arg name.
4. Run `optimistic-sync` test suite (see Tests).

**Test:** `optimistic-sync` contracts test still passes; CRDT reducer
still recovers state from `history.getAll()`.

### Phase 3 — Contracts + events

1. Define `HISTORY_*` contracts in `history-contracts.js`.
2. Register contracts via `history/index.js` manifest.
3. Verify `Contracts.validate()` accepts the new event names; unknown
   events remain default-denied.

**Test:** contracts test covers each `HISTORY_*` event with valid and
invalid payloads.

### Phase 4 — README + finalize

1. Write `history/README.md` (purpose, API, contracts, migration note).
2. Update `docs/architecture/SKILL.md` to mention history as the
   canonical undo/redo primitive.
3. Mark plan complete.

## Tests

`tests/history/`:

- `history-service.test.js` — record, undo, redo, multi-step, boundary
  (can't undo past zero, can't redo past tip), cursor monotonicity.
- `history-store.test.js` — IDB round-trip, schema migration, clear.
- `history-broadcast.test.js` — two `HistoryService` instances share
  state via `BroadcastChannel` (jsdom + channel mock).
- `history-contracts.test.js` — payload validation for each event.

**Regression gate:** `tests/contracts.test.js` and any existing
`optimistic-sync` tests must pass unchanged after Phase 2.

Property-based via `fast-check`:

- For any sequence of `record`/`undo`/`redo`, `getAll()` never loses
  entries; `cursor` only advances; `undo(steps=N)` is equivalent to N
  single `undo()` calls.

## Out of scope (v1)

- Compression of op log (entries are full snapshots today).
- Snapshot/materialized-state caching (consumers replay if they need
  derived state).
- Refactoring `visual-editor/engine/Transaction.js` to use history —
  tracked as a follow-up in `docs/roadmap.md`, not this plan.
- Server-side reconciliation — that lives in `optimistic-sync` + SSMA.

## Open questions

1. **Entry retention.** Unbounded growth is fine for v1 (maps are small,
   typical session <10k entries). Add a `maxEntries` option with FIFO
   eviction in v2? Default 10000?
2. **`status` field semantics.** Keeping `recorded | undone | redone` on
   the entry itself means undo mutates the entry. Alternative: append
   a compensating entry instead (event-sourced style). Stick with
   in-place mutation for v1 (matches current behavior); revisit if sync
   ordering breaks.
3. **Multi-tab leader.** Today `ActionLogService` broadcasts but does not
   elect a leader. If two tabs `undo()` concurrently they diverge. Accept
   for v1 (single-user local); add leader-gated undo in v2.
