# Storage Module

## Purpose

IndexedDB wrapper for offline-first application data.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `Storage` |
| Contracts | `STORAGE_READY`, `STORAGE_ADDED`, `STORAGE_UPDATED`, `STORAGE_DELETED`, `STORAGE_CLEARED` |

## Runtime Integration

Loaded with `FEATURES.INDEXEDDB`; runtime initializes default item store/indexes.

## Storage / Side Effects

Uses IndexedDB for local persistence.

## Tests

Covered indirectly by runtime/storage consumers; add dedicated storage tests before changing IndexedDB behavior.
