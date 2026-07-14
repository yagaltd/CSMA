/**
 * FileExplorerService — tree state, lazy expansion, selection, file reading.
 *
 * Depends on LocalFileAccessService for all I/O (pickDirectory, listDirectory,
 * readFile, readFileAsBlobUrl, saveRecentHandle, listRecentHandles, getRecentHandle).
 * Does NOT own any DOM — UI components consume this service.
 */

const DEFAULT_OPTIONS = {
    maxEntries: 500,
    maxPreviewChars: 250_000,
};

const TEXT_NAME_RE = /\.(txt|md|json|js|mjs|cjs|ts|tsx|jsx|css|html|htm|toml|yml|yaml|xml|svg|rs|go|py|sh|bash|zsh|env|gitignore|dockerfile|makefile|mdx|vue|svelte)$/i;

function pathKey(path) {
    return path.join('/');
}

function childPath(parent, name) {
    return [...parent, name];
}

function formatSize(size) {
    if (!Number.isFinite(size)) return '—';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function normalizeEntry(entry = {}) {
    const handle = entry.handle || entry.fileHandle || entry.directoryHandle || null;
    const name = entry.name || handle?.name || 'unnamed';
    const kind = entry.kind || handle?.kind || (entry.type === 'directory' ? 'directory' : 'file');
    return {
        ...entry,
        id: entry.id || (handle ? `${handle.kind}:${handle.name}` : name),
        name,
        kind,
        size: Number.isFinite(entry.size) ? entry.size : null,
        mimeType: entry.mimeType || entry.type || '',
        handle,
    };
}

function sortEntries(entries) {
    return [...entries].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });
}

function isTexty(name, mimeType = '') {
    return (mimeType && mimeType.startsWith('text/')) || TEXT_NAME_RE.test(name || '');
}

export class FileExplorerService {
    /**
     * @param {object} localFileAccess — LocalFileAccessService instance
     * @param {object} [options]
     * @param {number} [options.maxEntries=500]
     * @param {number} [options.maxPreviewChars=250000]
     * @param {object} [options.eventBus] — optional CSMA EventBus for contract events
     */
    constructor(localFileAccess, options = {}) {
        this.local = localFileAccess;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.eventBus = options.eventBus || null;

        // State
        this.rootHandle = null;
        this.rootEntry = null;
        this.rootId = null;
        this.rootName = null;
        this.path = [];              // current browse path (parent of selection)
        this.selectedName = null;
        this.selectedKind = null;
        this.selectedPath = [];       // full path identity for selection
        this.expanded = new Set();
        this.recentIds = [];
        this.loading = false;
        this.status = '';
        this.filterQuery = '';
        this._preSearchExpanded = null; // Saved expand state before filter

        // Internal maps
        this._childrenByPath = new Map();   // pathKey -> Entry[]
        this._handlesByPath = new Map();     // pathKey -> FileSystemHandle
        this._entriesByPath = new Map();      // pathKey -> Entry
        this._blobUrls = [];
        this._recentRows = [];
        this._destroyed = false;

        // Visible-node cache (invalidated on any state change)
        this._visibleCache = null;
        this._visibleCacheValid = false;
    }

    // ===================================================================
    // Capability detection
    // ===================================================================

    canOpenFolder() {
        return this.pickerMode() === 'fsa' || this.pickerMode() === 'workspace';
    }

    pickerMode() {
        const local = this.local;
        if (local?.source === 'workspace') return 'workspace';
        if (local && typeof local.pickDirectory === 'function') {
            if (typeof local.constructor?.supportsDirectoryPicker === 'function') {
                return local.constructor.supportsDirectoryPicker() ? 'fsa' : 'none';
            }
            if (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function') {
                return 'fsa';
            }
            return 'none';
        }
        return 'none';
    }

    buildVisibleNodes(dirPath = [], depth = 0, out = []) {
        // Top-level call: return cached result if still valid
        if (depth === 0 && this._visibleCacheValid && this._visibleCache !== null) {
            return this._visibleCache;
        }
        const key = pathKey(dirPath);
        const kids = this._childrenByPath.get(key) || [];
        const q = this.filterQuery.toLowerCase();
        const filtering = !!q;
        for (const entry of kids) {
            const entryPath = childPath(dirPath, entry.name);
            const entryKey = pathKey(entryPath);
            const matches = !q || entry.name.toLowerCase().includes(q);
            if (matches) {
                out.push({ entry, parentPath: [...dirPath], entryPath, entryKey, depth });
            }
            // When filtering, recurse into ALL directories regardless of expand state
            if (entry.kind === 'directory' && (this.expanded.has(entryKey) || filtering)) {
                this.buildVisibleNodes(entryPath, depth + 1, out);
            }
        }
        if (depth === 0) {
            this._visibleCache = out;
            this._visibleCacheValid = true;
        }
        return out;
    }

    /**
     * Invalidate the visible-node cache. Called by every state-changing method
     * so the next buildVisibleNodes() call rebuilds from current maps.
     */
    invalidateCache() {
        this._visibleCacheValid = false;
        this._visibleCache = null;
    }

    setFilter(query) {
        const q = typeof query === 'string' ? query : '';
        this.invalidateCache();
        if (q && !this.filterQuery) {
            // First filter application — save current expand state
            this._preSearchExpanded = new Set(this.expanded);
            // Expand all loaded directories so renderTreeRows shows everything
            for (const [dirKey] of this._childrenByPath) {
                if (dirKey) this.expanded.add(dirKey);
            }
        }
        this.filterQuery = q;
        this._notify();
    }
    clearFilter() {
        this.invalidateCache();
        if (this._preSearchExpanded) {
            this.expanded = this._preSearchExpanded;
            this._preSearchExpanded = null;
        }
        this.filterQuery = '';
        this._notify();
    }

    /**
     * Whether a filter is currently active.
     */
    hasFilter() {
        return !!this.filterQuery;
    }

    /**
     * Returns { visible, total } — number of matching entries and total file count in the tree.
     */
    getFilterResultCount() {
        const visible = this.filterQuery ? this.buildVisibleNodes().length : 0;
        let total = 0;
        for (const [, kids] of this._childrenByPath) {
            total += kids.filter(e => e.kind === 'file').length;
        }
        return { visible, total };
    }

    getSelectedVisibleIndex(visible) {
        if (Array.isArray(this.selectedPath) && this.selectedPath.length) {
            const selectedKey = pathKey(this.selectedPath);
            return visible.findIndex((node) => pathKey(node.entryPath) === selectedKey);
        }
        if (!this.selectedName) return -1;
        const parentKey = pathKey(this.path);
        return visible.findIndex((node) =>
            node.entry.name === this.selectedName
            && pathKey(node.parentPath) === parentKey
        );
    }

    getSelectedEntry() {
        if (!this.selectedName) return null;
        const parentKey = pathKey(this.path);
        const kids = this._childrenByPath.get(parentKey) || [];
        const entry = kids.find((row) => row.name === this.selectedName) || null;
        if (!entry) return null;
        return { entry, path: childPath(this.path, entry.name) };
    }

    // ===================================================================
    // Folder open / directory listing
    // ===================================================================

    setAccess(localFileAccess) {
        this.local = localFileAccess;
        this.rootHandle = null;
        this.rootEntry = null;
        this.rootId = null;
        this.rootName = null;
        this.path = [];
        this.selectedName = null;
        this.selectedKind = null;
        this.selectedPath = [];
        this.expanded.clear();
        this._childrenByPath.clear();
        this._handlesByPath.clear();
        this._entriesByPath.clear();
        this.invalidateCache();
        this.status = '';
        this._notify();
    }

    async refresh() {
        if (!this.rootHandle || !this.local) return false;
        const expanded = [...this.expanded].sort((a, b) => a.split('/').length - b.split('/').length);
        const selectedPath = [...this.selectedPath];
        this.loading = true;
        this.status = 'Refreshing files';
        this._notify();
        try {
            this._childrenByPath.clear();
            this._entriesByPath.clear();
            this._handlesByPath.clear();
            this._handlesByPath.set('', this.rootHandle);
            await this._ensureDirectoryLoaded(this.rootHandle, []);
            for (const key of expanded) {
                const parts = key.split('/').filter(Boolean);
                let handle = this.rootHandle;
                let current = [];
                for (const part of parts) {
                    const entry = (this._childrenByPath.get(pathKey(current)) || []).find(candidate => candidate.name === part && candidate.kind === 'directory');
                    if (!entry?.handle) { handle = null; break; }
                    handle = entry.handle;
                    current = [...current, part];
                    await this._ensureDirectoryLoaded(handle, current);
                }
            }
            this.expanded = new Set(expanded.filter(key => this._childrenByPath.has(key)));
            if (selectedPath.length) {
                const parentPath = selectedPath.slice(0, -1);
                const name = selectedPath.at(-1);
                const entry = (this._childrenByPath.get(pathKey(parentPath)) || []).find(candidate => candidate.name === name);
                if (entry) this._setSelection(entry.name, entry.kind, selectedPath, parentPath);
                else { this.selectedName = null; this.selectedKind = null; this.selectedPath = []; this.path = []; }
            }
            this.invalidateCache();
            this.status = 'Files refreshed';
            this.loading = false;
            this._notify();
            return true;
        } catch (error) {
            this.status = error?.message || 'Refresh failed';
            this.loading = false;
            this._notify();
            this._publishError('refresh', error);
            return false;
        }
    }

    async openFolder() {
        if (!this.canOpenFolder()) return null;
        this.invalidateCache();
        this.loading = true;
        this.status = 'Opening directory permission dialog';
        this._notify();

        try {
            const entry = await this.local.pickDirectory({ mode: 'read' });
            if (entry === null) {
                this.status = 'Folder selection cancelled';
                this.loading = false;
                this._notify();
                return null;
            }

            this.rootHandle = entry.handle;
            this.rootEntry = entry;
            this.rootId = entry.id || null;
            this.rootName = entry.name || entry.handle?.name || 'Folder';
            this._handlesByPath.clear();
            this._entriesByPath.clear();
            this._childrenByPath.clear();
            this.expanded.clear();
            this._handlesByPath.set('', this.rootHandle);
            this.path = [];
            this.selectedName = null;
            this.selectedKind = null;
            this.selectedPath = [];
            this._recentRows = [];

            if (typeof this.local.saveRecentHandle === 'function') {
                await this.local.saveRecentHandle(entry, {
                    appId: 'file-explorer',
                    tags: ['root', 'project'],
                });
            }

            await this._ensureDirectoryLoaded(this.rootHandle, []);

            const count = this._childrenByPath.get('')?.length || 0;
            this.status = `Root open · ${count} entries`;

            this._publish('DIRECTORY_OPENED', {
                rootId: this.rootId,
                rootName: this.rootName,
                entryCount: count,
                openedAt: Date.now(),
            });

            this.loading = false;
            this._notify();
            return entry;
        } catch (error) {
            this.status = error?.message || 'Failed to open folder';
            this.loading = false;
            this._notify();
            this._publishError('open-folder', error);
            return null;
        }
    }

    async _ensureDirectoryLoaded(handle, dirPath) {
        if (!handle || !this.local || typeof this.local.listDirectory !== 'function') return;
        const key = pathKey(dirPath);
        if (this._childrenByPath.has(key)) return;

        const result = await this.local.listDirectory(handle, {
            depth: 1,
            maxEntries: this.options.maxEntries,
        });
        const rawEntries = Array.isArray(result) ? result : (result.entries || []);
        const entries = sortEntries(rawEntries.map(normalizeEntry));

        this._childrenByPath.set(key, entries);
        this._handlesByPath.set(key, handle);

        for (const entry of entries) {
            const fullPath = childPath(dirPath, entry.name);
            const childKey = pathKey(fullPath);
            this._entriesByPath.set(childKey, entry);
            if (entry.handle) this._handlesByPath.set(childKey, entry.handle);
        }

        if (result.truncated) {
            this.status = 'Listing truncated';
        }
    }

    async toggleDirectory(entry, entryPath) {
        const key = pathKey(entryPath);
        const parentPath = entryPath.slice(0, -1);

        this.invalidateCache();
        // Keep selection on the folder being toggled
        this._setSelection(entry.name, 'directory', entryPath, parentPath);

        if (this.expanded.has(key)) {
            this.expanded.delete(key);
            this.status = 'Collapsed';
            this._notify();
            this._publish('DIRECTORY_COLLAPSED', {
                path: entryPath,
                collapsedAt: Date.now(),
            });
            return;
        }

        this.loading = true;
        this._notify();

        try {
            const handle = entry.handle || this._handlesByPath.get(key);
            if (!handle) throw new Error('Directory handle unavailable');
            this.expanded.add(key);
            await this._ensureDirectoryLoaded(handle, entryPath);
            this._publish('DIRECTORY_EXPANDED', {
                path: entryPath,
                entryCount: this._childrenByPath.get(key)?.length || 0,
                expandedAt: Date.now(),
            });
        } catch (error) {
            this.expanded.delete(key);
            this.status = error?.message || 'Failed to expand directory';
            this._publishError('expand', error);
        } finally {
            this.loading = false;
            // Re-assert selection identity
            this._setSelection(entry.name, 'directory', entryPath, parentPath);
            this._notify();
        }
    }

    // ===================================================================
    // Selection
    // ===================================================================

    selectEntry(entry, parentPath) {
        this.invalidateCache();
        const entryPath = childPath(parentPath, entry.name);
        this._setSelection(entry.name, entry.kind, entryPath, parentPath);
        this.status = entry.kind === 'directory' ? 'Folder selected' : 'File selected';
        this._notify();
        this._publish('SELECTION_CHANGED', {
            name: entry.name,
            kind: entry.kind,
            path: entryPath,
            changedAt: Date.now(),
        });
    }

    moveSelection(delta) {
        const visible = this.buildVisibleNodes();
        if (!visible.length) return;
        let index = this.getSelectedVisibleIndex(visible);
        if (index < 0) index = delta > 0 ? -1 : 0;
        const next = Math.max(0, Math.min(visible.length - 1, index + delta));
        const node = visible[next];
        this.selectEntry(node.entry, node.parentPath);
    }

    _setSelection(name, kind, entryPath, parentPath) {
        this.selectedName = name;
        this.selectedKind = kind;
        this.selectedPath = [...entryPath];
        this.path = [...parentPath];
    }

    // ===================================================================
    // File reading / preview
    // ===================================================================

    async readFilePreview(entry, entryPath) {
        if (!this.local || typeof this.local.readFile !== 'function') {
            throw new Error('File reading is not available');
        }
        const handle = entry.handle || this._handlesByPath.get(pathKey(entryPath));
        if (!handle) throw new Error('File handle unavailable');

        const file = await this.local.readFile(handle);
        const mimeType = file.mimeType || file.type || entry.mimeType || '';
        const size = Number.isFinite(file.size) ? file.size : file.blob?.size ?? entry.size ?? null;
        let text = null;
        let truncated = false;

        if (isTexty(entry.name, mimeType) && file.blob) {
            const rawText = await file.blob.text();
            truncated = rawText.length > this.options.maxPreviewChars;
            text = truncated ? rawText.slice(0, this.options.maxPreviewChars) : rawText;
        }
        let blobUrl = null;
        if (file.blob && !text && (mimeType.startsWith('image/') || mimeType === 'application/pdf' || mimeType.includes('/pdf') || entry.name.toLowerCase().endsWith('.pdf'))) {
            blobUrl = URL.createObjectURL(file.blob);
            this._blobUrls.push(blobUrl);
        }
        return {
            fileName: entry.name,
            mimeType,
            size,
            text,
            truncated,
            blobUrl,
            handleId: entry.id,
            path: [...entryPath],
        };
    }

    // ===================================================================
    // Recents
    // ===================================================================

    async showRecents() {
        if (this.pickerMode() !== 'fsa') return [];
        if (!this.local || typeof this.local.listRecentHandles !== 'function') return [];

        this.loading = true;
        this.status = 'Loading recents';
        this._notify();

        try {
            const rows = await this.local.listRecentHandles(20);
            this._recentRows = Array.isArray(rows) ? rows : [];
            this.recentIds = this._recentRows
                .map((row) => row.id)
                .filter((id) => typeof id === 'string');
            this.status = `${this._recentRows.length} recent handles`;
            this.loading = false;
            this._notify();
            return this._recentRows;
        } catch (error) {
            this.status = error?.message || 'Failed to load recents';
            this.loading = false;
            this._notify();
            this._publishError('recents', error);
            return [];
        }
    }

    getRecentRows() {
        return this._recentRows;
    }

    async openRecent(id) {
        if (this.pickerMode() !== 'fsa') return false;
        if (!this.local || typeof this.local.getRecentHandle !== 'function') return false;

        this.loading = true;
        this.status = 'Checking recent permission';
        this._notify();

        try {
            const recent = await this.local.getRecentHandle(id);
            if (!recent || recent.needsRegrant || !recent.handle) {
                this.status = 'Recent handle unavailable — permission needed';
                this._recentRows = [{
                    id,
                    name: recent?.name || id,
                    kind: recent?.kind || 'directory',
                    needsRegrant: true,
                }];
                this.loading = false;
                this._notify();
                return false;
            }

            if (recent.kind === 'directory' || recent.handle.kind === 'directory') {
                this.rootHandle = recent.handle;
                this.rootEntry = recent;
                this.rootId = recent.id || id;
                this.rootName = recent.name || recent.handle.name || 'Folder';
                this._handlesByPath.clear();
                this._entriesByPath.clear();
                this._childrenByPath.clear();
                this.expanded.clear();
                this._handlesByPath.set('', this.rootHandle);
                this.path = [];
                this.selectedName = null;
                this.selectedKind = null;
                this.selectedPath = [];
                this._recentRows = [];

                await this._ensureDirectoryLoaded(recent.handle, []);
                this.status = `Root open · ${this._childrenByPath.get('')?.length || 0} entries`;
                this.loading = false;
                this._notify();
                return true;
            }
            this.loading = false;
            this._notify();
            return false;
        } catch (error) {
            this.status = error?.message || 'Failed to open recent';
            this.loading = false;
            this._notify();
            this._publishError('open-recent', error);
            return false;
        }
    }

    // ===================================================================
    // State serialization (JSON-safe)
    // ===================================================================

    getState() {
        return {
            rootId: this.rootId,
            rootName: this.rootName,
            path: [...this.path],
            selectedName: this.selectedName,
            selectedKind: this.selectedKind,
            selectedPath: [...this.selectedPath],
            recentIds: [...this.recentIds],
            expanded: [...this.expanded],
        };
    }

    setState(data = {}) {
        this.invalidateCache();
        if (typeof data.rootId === 'string') this.rootId = data.rootId;
        if (typeof data.rootName === 'string') this.rootName = data.rootName;
        if (Array.isArray(data.path)) this.path = data.path.filter((p) => typeof p === 'string');
        if (typeof data.selectedName === 'string') this.selectedName = data.selectedName;
        if (data.selectedKind === 'file' || data.selectedKind === 'directory') {
            this.selectedKind = data.selectedKind;
        }
        if (Array.isArray(data.selectedPath)) {
            this.selectedPath = data.selectedPath.filter((p) => typeof p === 'string');
        }
        if (Array.isArray(data.recentIds)) {
            this.recentIds = data.recentIds.filter((id) => typeof id === 'string');
        }
        if (Array.isArray(data.expanded)) {
            this.expanded = new Set(data.expanded.filter((p) => typeof p === 'string'));
        }
    }

    // ===================================================================
    // Observable state (for UI re-render)
    // ===================================================================

    _listeners = new Set();

    onChange(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }
    _notify() {
        this._visibleCacheValid = false;
        if (this._destroyed) return;
        for (const fn of this._listeners) {
            try { fn(this.getState()); } catch { /* listener error */ }
        }
    }

    // ===================================================================
    // EventBus publishing
    // ===================================================================

    _publish(eventName, payload) {
        try {
            if (this.eventBus && typeof this.eventBus.publish === 'function') {
                this.eventBus.publish(eventName, payload);
            }
        } catch { /* EventBus errors should not crash operations */ }
    }

    _publishError(operation, error) {
        this._publish('FILE_EXPLORER_ERROR', {
            error: error?.message || String(error),
            operation,
            timestamp: Date.now(),
        });
    }

    // ===================================================================
    // Blob URL lifecycle
    // ===================================================================

    /**
     * Revoke all tracked blob URLs and clear the array.
     */
    revokeBlobUrls() {
        for (const url of this._blobUrls) {
            try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        }
        this._blobUrls = [];
    }

    /** Alias for revokeBlobUrls. */
    clearBlobUrls() {
        this.revokeBlobUrls();
    }

    // ===================================================================
    // Cleanup
    // ===================================================================

    destroy() {
        this._destroyed = true;
        this.revokeBlobUrls();
        this._listeners.clear();
        this._childrenByPath.clear();
        this._handlesByPath.clear();
        this._entriesByPath.clear();
        this.expanded.clear();
        this._recentRows = [];
        this.rootHandle = null;
        this.rootEntry = null;
    }
}

export { formatSize, sortEntries, normalizeEntry, isTexty, pathKey, childPath };
