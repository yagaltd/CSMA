# File Explorer Module

FSA directory tree with lazy expand, keyboard navigation, Quick Look lightbox, and file preview.

## Purpose

Provides a reusable file explorer UI component that uses `LocalFileAccessService` for all I/O. Designed for host shells that need a coding-oriented project browser with real on-disk access via the browser File System Access API.

## Architecture

```
file-explorer/
  index.js              # barrel export
  file-explorer.css     # CSMA token-driven styles
  services/
    FileExplorerService.js   # tree state, lazy load, selection, file reading
  ui/
    file-explorer.js         # createFileExplorer composite component
  contracts/
    file-explorer-contracts.js   # event contracts
```

## Usage

```js
import { createFileExplorer } from 'csma/modules/file-explorer';

const explorer = createFileExplorer(container, emit, {
    localFileAccess: localFileAccessService,
    overlayManager: overlayManager,     // optional: for Quick Look lightbox
    onFileOpen: (entry, payload) => {   // host spawns a preview tile
        spawnTile('preview', payload);
    },
    onSelectionChange: (entry) => { /* optional */ },
    maxPreviewChars: 250_000,
});

// Later: restore state
explorer.update(savedState);

// Cleanup
explorer.destroy();
```

## Factory

`createFileExplorer(container, emit, options) → { el, update, destroy, focus, getSelected, getState, getService }`

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `localFileAccess` | `LocalFileAccessService` | `null` | Required for FSA operations |
| `overlayManager` | `object` | `null` | Optional: uses `openModal()` for Quick Look |
| `onFileOpen` | `function(entry, payload)` | `null` | Called when user opens a file in a tile |
| `onSelectionChange` | `function(entry)` | `null` | Called when selection changes |
| `maxPreviewChars` | `number` | `250000` | Max text preview length before truncation |
| `maxEntries` | `number` | `500` | Max entries per directory listing |
| `initialState` | `object` | `null` | Restore prior JSON-safe state |

## Features

- **Lazy tree expansion**: directories load children on first expand via `listDirectory`
- **Keyboard navigation**: ↑/↓ move selection, ←/→ expand/collapse, Home/End, Enter/Space = Quick Look
- **Quick Look lightbox**: uses `overlayManager.openModal()` if available, otherwise inline fallback
- **Safe rendering**: `textContent` only for file data; no `innerHTML` injection
- **Capability gate**: disabled state when `supportsDirectoryPicker()` is false
- **CSMA design tokens**: all visual values reference token CSS custom properties
- **JSON-safe state**: `getState()`/`setState()` use only strings, numbers, arrays — no handles

## Dependencies

- `file-system` (provides `LocalFileAccessService`)
- Optional: `archetypes/overlay-manager` (for Quick Look lightbox chrome)

## Contracts

| Contract | Type | Description |
|----------|------|-------------|
| `DIRECTORY_OPENED` | event | Root folder opened via picker |
| `DIRECTORY_EXPANDED` | event | Directory node expanded |
| `DIRECTORY_COLLAPSED` | event | Directory node collapsed |
| `SELECTION_CHANGED` | event | Selected entry changed |
| `FILE_OPENED` | event | File opened for preview |
| `FILE_EXPLORER_ERROR` | event | Error during operations |
