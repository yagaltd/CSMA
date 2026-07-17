/**
 * Local File Access Service — browser File System Access API adapter.
 *
 * Provides capability detection, picker wrappers, permission management,
 * directory listing, file read/write helpers, save-as support, and
 * recent-handle persistence for user-granted local files and directories.
 *
 * Does NOT own OPFS app-private storage — that's FileSystemService.
 */

import { FileHandleStore } from './FileHandleStore.js';

const DEFAULT_OPTIONS = {
    maxEntriesPerDirectory: 1000,
    maxDepth: 10,
};

export class LocalFileAccessService {
    /**
     * @param {object} eventBus — CSMA EventBus
     * @param {object} [options]
     * @param {number} [options.maxEntriesPerDirectory]
     * @param {number} [options.maxDepth]
     * @param {FileHandleStore} [options.handleStore] — custom FileHandleStore instance
     * @param {object} [options.handleStoreOptions] — options for default FileHandleStore
     */
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.handleStore = options.handleStore || new FileHandleStore(options.handleStoreOptions);
        this.ready = this.handleStore.init();
    }

    // ===================================================================
    // Capability detection
    // ===================================================================

    /**
     * Check whether the browser supports the full File System Access API
     * (open file picker + directory picker).
     * @returns {boolean}
     */
    static isSupported() {
        return LocalFileAccessService.supportsOpenFilePicker()
            && LocalFileAccessService.supportsDirectoryPicker();
    }

    isSupported() {
        return LocalFileAccessService.isSupported();
    }

    /** @returns {boolean} */
    static supportsOpenFilePicker() {
        return typeof window !== 'undefined'
            && typeof window.showOpenFilePicker === 'function';
    }

    /** @returns {boolean} */
    static supportsDirectoryPicker() {
        return typeof window !== 'undefined'
            && typeof window.showDirectoryPicker === 'function';
    }

    /** @returns {boolean} */
    static supportsSaveFilePicker() {
        return typeof window !== 'undefined'
            && typeof window.showSaveFilePicker === 'function';
    }

    // ===================================================================
    // Picker wrappers
    // ===================================================================

    /**
     * Prompt the user to pick files.
     * Requires user activation (click handler).
     *
     * @param {object} [options]
     * @param {boolean} [options.multiple=false]
     * @param {Array<{ description: string, accept: Record<string, string[]> }>} [options.types]
     * @returns {Promise<Array<object>>} array of normalized file entries
     * @throws {Error} if unsupported or user cancels
     */
    async pickFiles(options = {}) {
        this._assertSupported('pick-file');

        const picker_opts = {};
        if (options.multiple) picker_opts.multiple = true;
        if (options.types) picker_opts.types = options.types;

        try {
            const handles = await window.showOpenFilePicker(picker_opts);
            const entries = await Promise.all(
                handles.map(h => this._normalizeFileHandle(h))
            );

            this._publish('LOCAL_FILE_PICKED', {
                count: entries.length,
                types: options.types
                    ? options.types.flatMap(t => Object.keys(t.accept))
                    : [],
                pickedAt: Date.now()
            });

            return entries;
        } catch (error) {
            if (error.name === 'AbortError') {
                // User cancelled — return empty, not an error
                return [];
            }
            this._publishError('pick-file', error);
            throw error;
        }
    }

    /**
     * Prompt the user to pick a directory.
     * Requires user activation (click handler).
     *
     * @param {object} [options]
     * @param {'read'|'readwrite'} [options.mode='read']
     * @returns {Promise<object>} normalized directory entry
     * @throws {Error} if unsupported or user cancels
     */
    async pickDirectory(options = {}) {
        this._assertSupported('pick-directory');

        const mode = options.mode === 'readwrite' ? 'readwrite' : 'read';

        try {
            const handle = await window.showDirectoryPicker({ mode });
            const entry = await this._normalizeDirectoryHandle(handle);

            this._publish('LOCAL_DIRECTORY_PICKED', {
                rootId: entry.id,
                name: entry.name,
                permission: entry.permission,
                pickedAt: Date.now()
            });

            return entry;
        } catch (error) {
            if (error.name === 'AbortError') {
                return null;
            }
            this._publishError('pick-directory', error);
            throw error;
        }
    }

    /**
     * Prompt the user to pick a save file location.
     * Requires user activation (click handler).
     *
     * @param {object} [options]
     * @param {string} [options.suggestedName]
     * @param {Array<{ description: string, accept: Record<string, string[]> }>} [options.types]
     * @param {boolean} [options.excludeAcceptAllOption]
     * @returns {Promise<object | null>} normalized file entry, or null on cancel
     * @throws {Error} if unsupported
     */
    async pickSaveFile(options = {}) {
        if (!LocalFileAccessService.supportsSaveFilePicker()) {
            const error = new Error(
                'showSaveFilePicker is not supported in this browser.'
            );
            error.code = 'UNSUPPORTED';
            this._publishError('pick-save-file', error);
            throw error;
        }

        const picker_opts = {};
        if (options.suggestedName) picker_opts.suggestedName = options.suggestedName;
        if (options.types) picker_opts.types = options.types;
        if (options.excludeAcceptAllOption !== undefined) {
            picker_opts.excludeAcceptAllOption = Boolean(options.excludeAcceptAllOption);
        }

        try {
            const handle = await window.showSaveFilePicker(picker_opts);
            const entry = await this._normalizeFileHandle(handle);

            this._publish('LOCAL_SAVE_FILE_PICKED', {
                id: entry.id,
                name: entry.name,
                permission: entry.permission,
                pickedAt: Date.now()
            });

            return entry;
        } catch (error) {
            if (error.name === 'AbortError') return null;
            this._publishError('pick-save-file', error);
            throw error;
        }
    }

    // ===================================================================
    // Permission management
    // ===================================================================

    /**
     * Query the current permission state for a handle.
     *
     * @param {FileSystemHandle} handle
     * @param {object} [options]
     * @param {'read'|'readwrite'} [options.mode='read']
     * @returns {Promise<'granted' | 'prompt' | 'denied'>}
     */
    async queryPermission(handle, options = {}) {
        if (!handle || typeof handle.queryPermission !== 'function') {
            return 'denied';
        }

        const mode = options.mode === 'readwrite' ? 'readwrite' : 'read';

        try {
            const result = await handle.queryPermission({ mode });
            return result || 'denied';
        } catch {
            return 'denied';
        }
    }

    /**
     * Request permission for a handle. Shows a browser prompt.
     * Requires user activation.
     *
     * @param {FileSystemHandle} handle
     * @param {object} [options]
     * @param {'read'|'readwrite'} [options.mode='read']
     * @returns {Promise<'granted' | 'prompt' | 'denied'>}
     */
    async requestPermission(handle, options = {}) {
        if (!handle || typeof handle.requestPermission !== 'function') {
            return 'denied';
        }

        const mode = options.mode === 'readwrite' ? 'readwrite' : 'read';

        try {
            const result = await handle.requestPermission({ mode });
            const status = result || 'denied';

            this._publish('LOCAL_PERMISSION_CHANGED', {
                id: this._handleId(handle),
                name: handle.name || '',
                permission: status,
                mode,
                changedAt: Date.now()
            });

            return status;
        } catch (error) {
            this._publishError('permission', error);
            return 'denied';
        }
    }

    // ===================================================================
    // Directory listing
    // ===================================================================

    /**
     * List entries in a directory handle.
     *
     * @param {FileSystemDirectoryHandle} directory_handle
     * @param {object} [options]
     * @param {number} [options.depth=1] — recursion depth (1 = direct children only)
     * @param {number} [options.maxEntries] — override max entries per directory
     * @param {AbortSignal} [options.signal] — abort signal
     * @returns {Promise<object>} { rootId, path, entries }
     */
    async listDirectory(directory_handle, options = {}) {
        if (!directory_handle || directory_handle.kind !== 'directory') {
            throw new Error('listDirectory requires a directory handle');
        }

        const max_entries = options.maxEntries || this.options.maxEntriesPerDirectory;
        const max_depth = Math.min(options.depth || 1, this.options.maxDepth);
        const signal = options.signal;

        const root_id = this._handleId(directory_handle);
        const entries = [];
        let truncated = false;

        /**
         * @param {FileSystemDirectoryHandle} dir_handle
         * @param {string[]} current_path
         * @param {number} current_depth
         */
        const walk = async (dir_handle, current_path, current_depth) => {
            if (signal?.aborted) return;
            if (current_depth > max_depth) return;
            if (entries.length >= max_entries * max_depth) {
                truncated = true;
                return;
            }

            let count = 0;
            for await (const [name, handle] of dir_handle.entries()) {
                if (signal?.aborted) break;
                if (count >= max_entries) {
                    truncated = true;
                    break;
                }
                count++;

                const entry = handle.kind === 'directory'
                    ? await this._normalizeDirectoryHandle(handle, [...current_path, name])
                    : await this._normalizeFileHandle(handle, [...current_path]);

                entries.push(entry);

                // Recurse into subdirectories
                if (handle.kind === 'directory' && current_depth < max_depth) {
                    await walk(/** @type {FileSystemDirectoryHandle} */ (handle),
                        [...current_path, name], current_depth + 1);
                }
            }
        };

        await walk(directory_handle, [], 1);

        // Deterministic sort: directories first, then files, locale-aware by name
        entries.sort((a, b) => {
            if (a.kind !== b.kind) {
                return a.kind === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

        this._publish('LOCAL_DIRECTORY_LISTED', {
            rootId: root_id,
            path: [],
            count: entries.length,
            listedAt: Date.now()
        });

        return {
            rootId: root_id,
            path: [],
            entries,
            truncated
        };
    }

    // ===================================================================
    // File read/write
    // ===================================================================

    /**
     * Read a file from a file handle.
     *
     * @param {FileSystemFileHandle} file_handle
     * @returns {Promise<{ id: string, name: string, size: number, mimeType: string, blob: Blob }>}
     */
    async readFile(file_handle) {
        if (!file_handle || file_handle.kind !== 'file') {
            throw new Error('readFile requires a file handle');
        }

        try {
            const file = await file_handle.getFile();
            const entry = await this._normalizeFileHandle(file_handle);
            entry.size = file.size;
            entry.mimeType = file.type || 'application/octet-stream';
            entry.blob = file;

            this._publish('LOCAL_FILE_READ', {
                id: entry.id,
                name: entry.name,
                size: entry.size,
                mimeType: entry.mimeType,
                readAt: Date.now()
            });

            return entry;
        } catch (error) {
            this._publishError('read-file', error);
            throw error;
        }
    }

    /**
     * Read a file and return a blob URL for image/object preview.
     *
     * Convenience wrapper around readFile() that creates a temporary
     * object URL. Caller is responsible for revoking the URL when done.
     *
     * @param {FileSystemFileHandle} file_handle
     * @returns {Promise<{ id: string, name: string, size: number, mimeType: string, blob: Blob, blobUrl: string }>}
     */
    async readFileAsBlobUrl(file_handle) {
        const entry = await this.readFile(file_handle);
        const blobUrl = URL.createObjectURL(entry.blob);
        return { ...entry, blobUrl };
    }

    /**
     * Write content to a file handle.
     *
     * @param {FileSystemFileHandle} file_handle
     * @param {Blob | string} content — Blob or text content
     * @param {object} [options]
     * @param {'readwrite'} [options.mode] — defaults to readwrite; permission checked first
     * @returns {Promise<{ id: string, name: string, size: number }>}
     */
    async writeFile(file_handle, content, options = {}) {
        if (!file_handle || file_handle.kind !== 'file') {
            throw new Error('writeFile requires a file handle');
        }

        // Check write permission first
        const perm = await this.queryPermission(file_handle, { mode: 'readwrite' });
        if (perm !== 'granted') {
            const requested = await this.requestPermission(file_handle, { mode: 'readwrite' });
            if (requested !== 'granted') {
                throw new Error(`Write permission denied for "${file_handle.name || 'file'}"`);
            }
        }

        try {
            const writable = await file_handle.createWritable();
            try {
                await writable.write(content);
                await writable.close();
            } catch (write_error) {
                await writable.abort();
                throw write_error;
            }

            const blob = typeof content === 'string'
                ? new Blob([content])
                : content;

            const entry = {
                id: this._handleId(file_handle),
                name: file_handle.name || '',
                size: blob.size,
                kind: 'file',
                writable: true
            };

            this._publish('LOCAL_FILE_WRITTEN', {
                id: entry.id,
                name: entry.name,
                size: entry.size,
                writtenAt: Date.now()
            });

            return entry;
        } catch (error) {
            this._publishError('write-file', error);
            throw error;
        }
    }

    // ===================================================================
    // Internal helpers
    // ===================================================================

    /**
     * @param {string} operation
     * @throws {Error}
     * @private
     */
    _assertSupported(operation) {
        const supported = operation === 'pick-file'
            ? LocalFileAccessService.supportsOpenFilePicker()
            : operation === 'pick-directory'
                ? LocalFileAccessService.supportsDirectoryPicker()
                : LocalFileAccessService.isSupported();

        if (!supported) {
            const error = new Error(
                `File System Access API is not supported in this browser for operation "${operation}".`
            );
            error.code = 'UNSUPPORTED';
            this._publishError(operation, error);
            throw error;
        }
    }

    /**
     * @param {string} operation
     * @param {Error} error
     * @private
     */
    _publishError(operation, error) {
        this._publish('LOCAL_FILE_ACCESS_ERROR', {
            error: error.message || String(error),
            operation,
            timestamp: Date.now()
        });
    }

    /**
     * @param {string} event_name
     * @param {object} payload
     * @private
     */
    _publish(event_name, payload) {
        try {
            if (this.eventBus && typeof this.eventBus.publish === 'function') {
                this.eventBus.publish(event_name, payload);
            }
        } catch {
            // EventBus errors should not crash file operations
        }
    }

    /**
     * Generate a stable session id from a handle.
     * Uses a simple hash-like approach — not guaranteed across sessions.
     * @param {FileSystemHandle} handle
     * @returns {string}
     * @private
     */
    _handleId(handle) {
        if (!handle || !handle.name) return 'unknown';
        // Session-stable: combine name + kind
        return `${handle.kind}:${handle.name}`;
    }

    /**
     * @param {FileSystemFileHandle} handle
     * @param {string[]} [virtual_path]
     * @returns {Promise<object>}
     * @private
     */
    async _normalizeFileHandle(handle, virtual_path = []) {
        const permission = await this.queryPermission(handle, { mode: 'read' });
        const writable = (await this.queryPermission(handle, { mode: 'readwrite' })) === 'granted';

        return {
            id: this._handleId(handle),
            name: handle.name,
            kind: 'file',
            handle,
            path: virtual_path.length > 0 ? virtual_path : [handle.name],
            permission,
            writable,
            lastSeenAt: Date.now()
        };
    }

    /**
     * @param {FileSystemDirectoryHandle} handle
     * @param {string[]} [virtual_path]
     * @returns {Promise<object>}
     * @private
     */
    async _normalizeDirectoryHandle(handle, virtual_path = []) {
        const permission = await this.queryPermission(handle, { mode: 'read' });

        return {
            id: this._handleId(handle),
            name: handle.name,
            kind: 'directory',
            handle,
            path: virtual_path.length > 0 ? virtual_path : [handle.name],
            permission,
            writable: false,
            lastSeenAt: Date.now()
        };
    }

    // ===================================================================
    // Recent handles
    // ===================================================================

    /**
     * Save a handle entry for later retrieval.
     *
     * @param {object} entry — handle entry with { id, kind, name, handle }
     * @param {object} [options]
     * @param {string} [options.appId]
     * @param {string[]} [options.tags]
     * @returns {Promise<object>} the saved entry
     */
    async saveRecentHandle(entry, options = {}) {
        await this.ready;
        return this.handleStore.save({
            id: entry.id,
            kind: entry.kind,
            name: entry.name,
            handle: entry.handle,
            appId: options.appId || null,
            tags: options.tags || [],
        });
    }

    /**
     * List recent handles, sorted by lastSeenAt descending.
     *
     * @param {number} [limit=20]
     * @returns {Promise<Array<object>>}
     */
    async listRecentHandles(limit = 20) {
        await this.ready;
        return this.handleStore.listRecent(limit);
    }

    /**
     * Get a recent handle entry by id, including current permission state.
     * Persisted handle does NOT mean permission is still granted —
     * always check permission and be ready for needsRegrant.
     *
     * @param {string} id
     * @returns {Promise<object | null>}
     */
    async getRecentHandle(id) {
        await this.ready;
        const entry = await this.handleStore.get(id);
        if (!entry) return null;

        const permission = entry.handle
            ? await this.queryPermission(entry.handle, { mode: 'read' })
            : 'denied';

        return {
            ...entry,
            permission,
            needsRegrant: !entry.handle || permission === 'denied',
        };
    }

    /**
     * Remove a recent handle entry.
     *
     * @param {string} id
     * @returns {Promise<void>}
     */
    async removeRecentHandle(id) {
        await this.ready;
        return this.handleStore.remove(id);
    }

    /**
     * Clear all recent handles.
     *
     * @returns {Promise<void>}
     */
    async clearRecentHandles() {
        await this.ready;
        return this.handleStore.clear();
    }
}
