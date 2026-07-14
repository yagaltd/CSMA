# CSMA File System Refactor — Managed Storage + Local File Access Adapter

## Goal

Refactor CSMA `src/modules/file-system` so it remains the frontend template's unified file capability module while keeping two storage models separate:

1. **Managed app storage** — current OPFS + IndexedDB metadata + IndexedDB blob fallback service.
2. **User-granted local file access** — browser File System Access API adapter for files/directories selected by the user.

This enables MorphShell apps such as a local file explorer, editor, importer/exporter, or project browser without confusing app-private OPFS storage with real user disk access.

---

## Current state

Repo evidence from `../csma-sensaio/src/modules/file-system`:

- `index.js`
  - exports `FileSystemService`
  - `createFileSystem(eventBus, options)` creates the service and assigns `service.ready = service.init()`
  - manifest exposes one service: `fileSystem`
- `services/FileSystem.js`
  - manages app-private storage
  - uses `navigator.storage.getDirectory()` for OPFS when available
  - uses `FallbackStorage` with IndexedDB blobs when OPFS is unavailable or `forceFallback` is true
  - public methods: `store`, `retrieve`, `delete`, `search`, `list`, `createReadStream`, `updateMetadata`
  - record shape includes `id`, `title`, `description`, `tags`, `category`, `size`, `mimeType`, `handle`, `storage`, `createdAt`, `updatedAt`, `extra`
- `services/MetadataStore.js`
  - indexes records in IndexedDB
  - search supports `text`, `tags`, and `category`
  - arbitrary app fields belong in `extra`, not top-level searchable fields
- `contracts/file-system-contracts.js`
  - current events: `FILE_STORED`, `FILE_RETRIEVED`, `FILE_DELETED`, `FILE_SYSTEM_ERROR`
  - error operation enum currently covers `store`, `retrieve`, `delete`, `search`, `stream`

Current module does **not** expose browser user-file APIs:

- `showOpenFilePicker()`
- `showSaveFilePicker()`
- `showDirectoryPicker()`
- user-granted `FileSystemFileHandle` / `FileSystemDirectoryHandle`
- permission persistence helpers

---

## Non-goals

- Do not replace the current OPFS/IDB managed storage path.
- Do not make `fs.list()` mean “list the user’s real directory”. Existing managed-storage semantics stay stable.
- Do not let MorphShell eviction/session snapshots browse or mutate local user folders.
- Do not silently fallback from user-local directory access to OPFS; that hides permission and data-location differences.
- Do not require File System Access API support for the existing `FileSystemService` to work.

---

## Proposed module shape

Keep one CSMA module, expose two explicit services:

```text
src/modules/file-system/
  index.js
  README.md
  contracts/
    file-system-contracts.js
  services/
    FileSystem.js            # existing managed OPFS/IDB service
    LocalFileAccess.js       # new browser File System Access API adapter
    FileHandleStore.js       # optional persisted handles/recents helper
    MetadataStore.js         # existing managed-storage metadata
    StreamProcessor.js       # reusable blob/stream conversion
  utils/
    FallbackStorage.js
    FileHandleCache.js
    MimeMapper.js
    LocalPath.js             # optional path/entry normalization helpers
```

`index.js` should export both factories:

```js
import { FileSystemService } from './services/FileSystem.js';
import { LocalFileAccessService } from './services/LocalFileAccess.js';

export const services = {
  fileSystem: FileSystemService,
  localFileAccess: LocalFileAccessService,
};

export function createFileSystem(eventBus, options = {}) {
  const service = new FileSystemService(eventBus, options);
  service.ready = service.init();
  return service;
}

export function createLocalFileAccess(eventBus, options = {}) {
  return new LocalFileAccessService(eventBus, options);
}
```

Alternative combined facade is acceptable, but only if names stay explicit:

```js
const fs = createFileSystem(eventBus);
await fs.store(blob, metadata);          // managed OPFS/IDB
await fs.local.pickDirectory();          // user-granted real directory
```

Preferred first implementation: **separate service exported from the same module**. It is clearer and safer.

---

## API design

### Managed storage stays unchanged

Existing API remains:

```js
const storage = createFileSystem(eventBus, {
  storageRoot: '/user-files',
});
await storage.ready;

const record = await storage.store(blob, metadata);
const file = await storage.retrieve(record.id);
const rows = await storage.list(100);
await storage.delete(record.id);
```

### New local file access service

Proposed surface:

```js
const local = createLocalFileAccess(eventBus);

local.isSupported();

const pickedFiles = await local.pickFiles({
  multiple: true,
  types: [{ description: 'Text', accept: { 'text/plain': ['.txt', '.md'] } }],
});

const dir = await local.pickDirectory({ mode: 'read' });
const entries = await local.listDirectory(dir.handle);

const file = await local.readFile(pickedFiles[0].handle);
await local.writeFile(fileHandle, blob);

const permission = await local.queryPermission(handle, { mode: 'readwrite' });
const granted = await local.requestPermission(handle, { mode: 'readwrite' });
```

### Returned shapes

Normalize handles into small records for UI code:

```js
{
  id: string,              // stable per session or persisted-handle id
  name: string,
  kind: 'file' | 'directory',
  handle: FileSystemHandle,
  path: string[],          // best-effort virtual path from selected root
  permission: 'granted' | 'prompt' | 'denied',
  writable: boolean,
  lastSeenAt: number,
}
```

Directory listing:

```js
{
  rootId: string,
  path: string[],
  entries: [
    { name, kind, handle, path, permission, writable, lastSeenAt }
  ],
}
```

Do not pretend the browser exposes absolute OS paths. It does not.

---

## Service responsibilities

### `FileSystemService` — managed app storage

Owns:

- OPFS directory under `storageRoot`
- IndexedDB metadata
- IndexedDB blob fallback
- `store/retrieve/delete/list/search`
- metadata tags/category/extra
- managed cache/snapshot use cases

Does not own:

- user picker prompts
- real local directories
- persisted user-granted handles
- local OS path semantics

### `LocalFileAccessService` — user-granted files/directories

Owns:

- capability detection
- picker wrappers
- permission query/request
- safe directory iteration
- file read/write helpers
- optional persisted recent handles
- normalized entry records for UI apps

Does not own:

- OPFS cache eviction
- app-private snapshots
- CSMA managed-storage metadata
- silent access without user activation

### `FileHandleStore` — optional persisted handles

Use IndexedDB to store user-granted handles if supported by the browser.

Responsibilities:

- save handle records by app/workspace/root id
- list recent roots/files
- rehydrate handles on app boot
- query permission on restore before using a handle
- remove stale/denied handles

Important: a persisted handle is not a permanent grant. Always call `queryPermission()` and be ready for `prompt` or `denied`.

---

## Contracts and events

Extend `contracts/file-system-contracts.js` without changing existing event names.

Add events:

```text
LOCAL_FILE_PICKED
LOCAL_DIRECTORY_PICKED
LOCAL_DIRECTORY_LISTED
LOCAL_FILE_READ
LOCAL_FILE_WRITTEN
LOCAL_PERMISSION_CHANGED
LOCAL_FILE_ACCESS_ERROR
```

Suggested payloads:

```js
LOCAL_DIRECTORY_PICKED: {
  rootId: string,
  name: string,
  permission: 'granted' | 'prompt' | 'denied',
  pickedAt: number,
}

LOCAL_DIRECTORY_LISTED: {
  rootId: string,
  path: array(string),
  count: number,
  listedAt: number,
}

LOCAL_FILE_READ: {
  id: string,
  name: string,
  size: number,
  mimeType: string,
  readAt: number,
}

LOCAL_FILE_WRITTEN: {
  id: string,
  name: string,
  size: number,
  writtenAt: number,
}

LOCAL_FILE_ACCESS_ERROR: {
  error: string,
  operation: 'pick-file' | 'pick-directory' | 'list-directory' | 'read-file' | 'write-file' | 'permission',
}
```

Existing `FILE_SYSTEM_ERROR` can either add these operation enum values or remain scoped to managed storage while local access uses `LOCAL_FILE_ACCESS_ERROR`. Prefer the latter to keep the distinction clear.

---

## Security and browser constraints

Rules:

- File System Access API requires user activation for picker prompts.
- Never request `readwrite` unless the caller is about to write.
- Never store or display fake absolute OS paths.
- Never recurse large directories without depth/entry limits.
- Never auto-write to user files from restored handles without a current permission check and an explicit user/app action.
- Treat handle persistence as best-effort and browser-specific.
- Support detection/fallback because Firefox/Safari support is limited.

Required helper:

```js
isSupported() {
  return typeof window !== 'undefined'
    && typeof window.showOpenFilePicker === 'function'
    && typeof window.showDirectoryPicker === 'function';
}
```

Fallback behavior:

- file import: `<input type="file">` or drag/drop
- file export: generated download link
- directory explorer: unavailable with clear capability result
- managed storage: still works through OPFS/IDB fallback

---

## MorphShell app use case

A MorphShell local file explorer tile should depend on `LocalFileAccessService`, not directly on raw browser APIs.

Flow:

1. Tile starts with no directory handle.
2. User clicks “Open folder”.
3. `localFileAccess.pickDirectory({ mode: 'read' })` prompts the browser picker.
4. Tile stores returned root handle id in Tile Protocol state.
5. Tile calls `listDirectory(root.handle, { depth: 1 })`.
6. User opens a file.
7. Tile calls `readFile(file.handle)` and routes content to preview/editor tile.
8. If editing, request `readwrite` only when saving.
9. On reload/session restore, tile rehydrates recent handle id, checks permission, then either lists or asks user to re-grant.

Do not use CSMA OPFS `FileSystemService` as the source of truth for real local files. It may cache thumbnails, recent metadata, or editor backups, but user-local files remain behind browser handles.

---

## Phased refactor plan

### Phase 0 — Preserve current managed storage behavior

- Add regression tests around current `FileSystemService` before touching exports:
  - OPFS path when supported
  - fallback path when `forceFallback` is true
  - `store/retrieve/delete/list/search`
  - `extra` survives `store` and `updateMetadata`
- Keep `createFileSystem()` API unchanged.
- Keep existing contracts stable.

### Phase 1 — Add `LocalFileAccessService` skeleton

- Create `services/LocalFileAccess.js`.
- Implement:
  - `isSupported()`
  - `pickFiles(options)`
  - `pickDirectory(options)`
  - `queryPermission(handle, options)`
  - `requestPermission(handle, options)`
- Export service and factory from `index.js`.
- Add no-op/unsupported behavior for non-browser or unsupported browsers.

Acceptance:

- Existing managed storage tests still pass.
- Unsupported environment returns `false` from `isSupported()` and throws a clear typed error for picker methods.

### Phase 2 — Directory listing and file read/write helpers

- Implement:
  - `listDirectory(directoryHandle, options)`
  - `readFile(fileHandle)`
  - `writeFile(fileHandle, blobOrText, options)`
- Add safeguards:
  - max entries per listing
  - optional max depth
  - abort signal support if useful
  - deterministic sort: directories first, then files, locale-aware by name
- Publish local access events.

Acceptance:

- A mocked directory handle returns normalized entries.
- A mocked file handle reads `File` content.
- Write helper requests/checks write permission before `createWritable()`.

### Phase 3 — Persist recent handles

- Add `FileHandleStore` backed by IndexedDB.
- Store:
  - handle id
  - kind
  - display name
  - tags/category/app id
  - lastSeenAt
  - serialized handle object when browser supports structured clone for handles
- Rehydrate recent handles on boot.
- Always `queryPermission()` before use.

Acceptance:

- Recent handles list survives reload in Chromium-capable tests.
- Denied handles remain visible as “needs permission” instead of causing crashes.
- Clearing a recent handle removes it from IndexedDB.

### Phase 4 — CSMA demo / MorphShell integration path

- Add a simple CSMA demo component or MorphShell tile app plan:
  - open folder
  - list entries
  - open text/image file preview
  - save-as or write-back gated by permission
- Use `LocalFileAccessService` only; do not import raw picker APIs in app code.
- Optionally cache thumbnails/metadata in managed `FileSystemService` using tags such as `source:local-handle`.

Acceptance:

- File explorer can browse a selected directory in Chromium.
- Unsupported browser shows a clear capability message and still allows upload/download fallback if implemented.

---

## Test strategy

Use unit tests with fake handles. Do not require real browser pickers for normal CI.

Fake handle shapes:

```js
const fakeFileHandle = {
  kind: 'file',
  name: 'note.md',
  async getFile() { return new File(['hello'], 'note.md', { type: 'text/markdown' }); },
  async queryPermission() { return 'granted'; },
  async requestPermission() { return 'granted'; },
};

const fakeDirectoryHandle = {
  kind: 'directory',
  name: 'project',
  async *entries() {
    yield ['note.md', fakeFileHandle];
  },
  async queryPermission() { return 'granted'; },
  async requestPermission() { return 'granted'; },
};
```

Test cases:

- unsupported environment detection
- picker wrappers call the expected browser API when present
- permission query/request normalizes missing methods and browser return values
- directory listing normalizes entries and respects limits
- readFile returns `File` and metadata
- writeFile handles text/blob input and closes the writable stream
- event publication for picked/listed/read/written/error
- existing `FileSystemService` behavior unchanged

---

## API naming recommendation

Use explicit names that prevent conceptual drift:

- `fileSystem` / `createFileSystem` — managed app storage
- `localFileAccess` / `createLocalFileAccess` — user-granted real files/directories

Avoid names like:

- `disk`
- `nativeFs`
- `realFs`
- `localStorage`

because they imply OS-level access or collide with browser `localStorage`.

---

## Implementation risks

| Risk | Mitigation |
|---|---|
| Browser support differs | `isSupported()`, clear unsupported errors, upload/download fallback |
| Permission can expire | Always `queryPermission()` before using persisted handles |
| Large directory traversal freezes UI | Limit entries/depth; batch/async iteration; add abort support |
| Existing OPFS users break | Keep `createFileSystem()` and `FileSystemService` behavior unchanged |
| Local files confused with OPFS records | Separate service names, events, docs, and tests |
| Tests depend on real picker UI | Use fake handles and inject picker functions/options |

---

## Ready-to-implement checklist

- [ ] Add `LocalFileAccessService` beside existing `FileSystemService`.
- [ ] Export `localFileAccess` and `createLocalFileAccess()` from `index.js`.
- [ ] Add local-access contracts/events without changing existing managed-storage events.
- [ ] Keep `createFileSystem()` unchanged.
- [ ] Add fake-handle unit tests.
- [ ] Update `README.md` to distinguish managed storage vs user-granted local access.
- [ ] Build a MorphShell file explorer tile against `LocalFileAccessService`, not raw browser APIs.
