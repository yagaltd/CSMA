# File System Module

## Purpose

Dual-service file capabilities:

1. **Managed app storage** (`FileSystemService`) — OPFS + IndexedDB metadata + IndexedDB blob fallback for app-private files (camera, media, cache, snapshots).
2. **User-granted local file access** (`LocalFileAccessService`) — browser File System Access API adapter for files and directories selected by the user (file explorer, editor, importer/exporter).

## Public Surface

| Surface | Details |
|---------|---------|
| Service `fileSystem` | `FileSystemService` — managed OPFS/IDB storage |
| Service `localFileAccess` | `LocalFileAccessService` — user-granted local files/directories |
| Contracts | `FILE_STORED`, `FILE_RETRIEVED`, `FILE_DELETED`, `FILE_SYSTEM_ERROR` (managed) + `LOCAL_FILE_PICKED`, `LOCAL_DIRECTORY_PICKED`, `LOCAL_DIRECTORY_LISTED`, `LOCAL_FILE_READ`, `LOCAL_FILE_WRITTEN`, `LOCAL_PERMISSION_CHANGED`, `LOCAL_FILE_ACCESS_ERROR` (local) |

## Runtime Integration

Loaded with `FEATURES.FILE_SYSTEM`; consumed by camera, media-capture, image workflows, and local file explorer tiles. `LocalFileAccessService` requires browser File System Access API (Chromium-based browsers); unsupported environments degrade gracefully with `isSupported()` returning false.

## Managed vs Local

| | Managed (`fileSystem`) | Local (`localFileAccess`) |
|---|---|---|
| Storage | OPFS or IndexedDB | User-selected files/directories |
| Access | App-private, no user prompt | User-granted, requires picker |
| Persistence | Stable across sessions | Handles expire with permissions |
| Use cases | Camera capture, thumbnails, editor autosave | File explorer, open/save dialogs, project browser |
| Fallback | IndexedDB blobs | `<input type="file">` / download link |

## Storage / Side Effects

Managed storage uses browser storage APIs for file metadata and binary content. Local file access uses browser File System Access API; handles may be persisted in IndexedDB via `FileHandleStore` (best-effort, Chromium only).

## Tests

- `tests/file-system-regression.test.js` — managed storage behavior
- `tests/file-system-local-access.test.js` — local file access with fake handles
- `tests/contracts.test.js` — contract validation
