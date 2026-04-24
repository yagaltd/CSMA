# File System Module

## Purpose

Hybrid file storage with IndexedDB metadata and OPFS-style binary storage helpers.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `fileSystem` via `FileSystemService` |
| Contracts | File stored, retrieved, deleted, and file-system error contracts. |

## Runtime Integration

Loaded with `FEATURES.FILE_SYSTEM`; consumed by camera, media-capture, and image workflows.

## Storage / Side Effects

Uses browser storage APIs for file metadata and binary content.

## Tests

`tests/contracts.test.js`; add storage adapter tests before changing persistence behavior.
