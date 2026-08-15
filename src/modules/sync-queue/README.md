# Sync Queue Module

> **Catalog-only module:** not wired into any demo; not yet certified. Run
> `npm run certify:module` before relying on it.

## Purpose

Offline-first job queue that flushes work when network connectivity is available.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `syncQueue` via `SyncQueueService` |
| Contracts | Sync queue enqueue intent, enqueued, flushed, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.SYNC_QUEUE`; runtime requires network-status and may pass localStorage.

## Storage / Side Effects

Persists queued jobs and flushes them when network status permits.

## Tests

`tests/contracts.test.js`.
