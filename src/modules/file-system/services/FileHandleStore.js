/**
 * FileHandleStore — lightweight IndexedDB-backed persistence for
 * user-granted FileSystemHandle references.
 *
 * Chromium browsers support structured-cloning FileSystemHandle into
 * IndexedDB. In Firefox / Safari the clone fails; we store metadata
 * only and mark the entry persisted: false so callers know to
 * re-acquire via the picker.
 *
 * When IndexedDB is unavailable entirely, operations fall back to an
 * in-memory Map. No EventBus dependency — this is a plain storage
 * utility used by LocalFileAccessService and friends.
 */

const DEFAULT_DB_NAME = 'csma-file-handles';
const DEFAULT_STORE_NAME = 'handles';

export class FileHandleStore {
    /**
     * @param {object} [options]
     * @param {string} [options.dbName] — IndexedDB database name
     */
    constructor(options = {}) {
        this.dbName = options.dbName || DEFAULT_DB_NAME;
        this.storeName = DEFAULT_STORE_NAME;
        this.db = null;
        this.memoryStore = null;
    }

    // ===================================================================
    // Lifecycle
    // ===================================================================

    /**
     * Open / create the IndexedDB database.  Falls back to an in-memory
     * Map when IndexedDB is unavailable.
     */
    async init() {
        if (this.db || this.memoryStore) {
            return;
        }

        if (typeof indexedDB === 'undefined') {
            this.memoryStore = new Map();
            return;
        }

        try {
            this.db = await this.#openDatabase();
        } catch (err) {
            console.warn('[FileHandleStore] IndexedDB open failed, falling back to memory:', err);
            this.memoryStore = new Map();
        }
    }

    // ===================================================================
    // CRUD
    // ===================================================================

    /**
     * Save (upsert) a file-handle entry.
     *
     * @param {object} entry
     * @param {string} entry.id       — unique identifier
     * @param {'file'|'directory'} entry.kind
     * @param {string} entry.name     — display name
     * @param {FileSystemFileHandle|FileSystemDirectoryHandle} entry.handle
     * @param {string} [entry.appId]  — optional application scope
     * @param {string[]} [entry.tags] — optional tags
     * @param {number} [entry.lastSeenAt]
     * @returns {Promise<object>} the stored entry
     */
    async save(entry) {
        const normalized = this.#normalizeEntry(entry);

        if (this.memoryStore) {
            this.memoryStore.set(normalized.id, normalized);
            return normalized;
        }

        return this.#saveToIDB(normalized);
    }

    /**
     * Retrieve a single entry by id.
     *
     * @param {string} id
     * @returns {Promise<object|null>} entry or null
     */
    async get(id) {
        if (this.memoryStore) {
            return this.memoryStore.get(id) || null;
        }

        return this.#withStore(this.storeName, 'readonly', (store) => store.get(id));
    }

    /**
     * List the most-recently-seen entries.
     *
     * @param {number} [limit=20]
     * @returns {Promise<object[]>}
     */
    async listRecent(limit = 20) {
        if (this.memoryStore) {
            const entries = Array.from(this.memoryStore.values());
            entries.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
            return entries.slice(0, limit);
        }

        return this.#listRecentFromIDB(limit);
    }

    /**
     * Delete an entry.
     *
     * @param {string} id
     */
    async remove(id) {
        if (this.memoryStore) {
            this.memoryStore.delete(id);
            return;
        }

        await this.#withStore(this.storeName, 'readwrite', (store) => store.delete(id));
    }

    /**
     * Clear all entries.
     */
    async clear() {
        if (this.memoryStore) {
            this.memoryStore.clear();
            return;
        }

        await this.#withStore(this.storeName, 'readwrite', (store) => store.clear());
    }

    /**
     * Close the IndexedDB connection and release resources.
     */
    destroy() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.memoryStore = null;
    }

    // ===================================================================
    // Internals
    // ===================================================================

    /**
     * Normalize an entry for storage — always stamps lastSeenAt and
     * attempts to persist the handle object.
     */
    #normalizeEntry(entry) {
        const normalized = {
            id: entry.id,
            kind: entry.kind,
            name: entry.name,
            handle: entry.handle || null,
            appId: entry.appId || null,
            tags: Array.isArray(entry.tags)
                ? entry.tags.map((t) => t.trim()).filter(Boolean)
                : [],
            lastSeenAt: Date.now(),
            persisted: true
        };
        return normalized;
    }

    /**
     * Attempt to store via IndexedDB.  If the structured clone fails
     * (e.g. Firefox / Safari cannot clone FileSystemHandle), retry
     * without the handle and mark persisted: false.
     */
    async #saveToIDB(normalized) {
        try {
            await this.#withStore(this.storeName, 'readwrite', (store) =>
                store.put(normalized)
            );
            return normalized;
        } catch (err) {
            if (this.#isCloneError(err)) {
                console.warn(
                    '[FileHandleStore] FileSystemHandle cloning not supported — storing metadata only.',
                    err
                );
                const metaOnly = { ...normalized, handle: null, persisted: false };
                try {
                    await this.#withStore(this.storeName, 'readwrite', (store) =>
                        store.put(metaOnly)
                    );
                } catch (innerErr) {
                    console.warn('[FileHandleStore] Metadata-only put also failed:', innerErr);
                }
                return metaOnly;
            }
            console.warn('[FileHandleStore] save failed:', err);
            return normalized;
        }
    }

    /**
     * Heuristic check: did the put() fail because the handle couldn't be
     * structured-cloned?  DataCloneError is the standard signal.
     */
    #isCloneError(err) {
        if (!err) return false;
        if (err.name === 'DataCloneError') return true;
        if (err.message && /clone/i.test(err.message)) return true;
        return false;
    }

    /**
     * List recent entries using the lastSeenAt index, descending.
     */
    #listRecentFromIDB(limit) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const index = store.index('lastSeenAt');
            const results = [];
            let cursorRequest;

            try {
                cursorRequest = index.openCursor(null, 'prev');
            } catch (err) {
                // Index may not exist (legacy DB without upgrade)
                console.warn('[FileHandleStore] lastSeenAt index missing, falling back to getAll()', err);
                const getAllReq = store.getAll();
                getAllReq.onsuccess = () => {
                    const all = getAllReq.result || [];
                    all.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
                    resolve(all.slice(0, limit));
                };
                getAllReq.onerror = () => reject(getAllReq.error);
                return;
            }

            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            cursorRequest.onerror = () => reject(cursorRequest.error);
        });
    }

    /**
     * Open (or create + upgrade) the IndexedDB database.
     */
    #openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, {
                        keyPath: 'id'
                    });
                    store.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Run a handler inside a transaction on the named object store.
     */
    #withStore(storeName, mode, handler) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = handler(store);

            if (!request) {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                return;
            }

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
