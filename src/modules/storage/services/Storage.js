/**
 * Storage - IndexedDB wrapper for offline data (~2KB)
 * Simple CRUD interface with EventBus integration
 */
export class Storage {
    constructor(eventBus, dbName = 'csma-db', version = 1) {
        this.eventBus = eventBus;
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    /**
     * Initialize / upgrade the database.
     *
     * Schemas are CUMULATIVE: every init() call merges its stores into a
     * running registry (`this.schema`). This lets several services register
     * their own object stores across separate init() calls (e.g. the generic
     * `items` store from the runtime, then the comments module's `comments`
     * store) without one call clobbering another.
     *
     * Version handling: when a previously-opened DB gains new stores, the
     * version is bumped so IndexedDB fires `onupgradeneeded` and creates the
     * missing stores. The very first init (no existing DB) keeps the
     * constructor version and creates everything in one upgrade.
     */
    async init(schema) {
        // Merge incoming stores into the cumulative registry.
        this.schema = this.schema || {};
        let addedStores = false;
        if (schema) {
            for (const [storeName, config] of Object.entries(schema)) {
                if (!this.schema[storeName]) {
                    this.schema[storeName] = config;
                    addedStores = true;
                }
            }
        }

        // Bump version when new stores appear after the DB already exists, so
        // onupgradeneeded fires and creates them. We MUST close the existing
        // connection first: IndexedDB blocks a higher-version open() while any
        // connection holds the DB at a lower version, which would leave this
        // promise pending forever (no onblocked handler could unblock it in a
        // single-page app where we own the only connection).
        if (addedStores && this.db) {
            this.version = this.db.version + 1;
            try { this.db.close(); } catch { /* already closed */ }
            this.db = null;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            // Another tab/process holds an older version and has not closed it.
            // Do not reject (the upgrade proceeds once they close); surface it.
            request.onblocked = () => {
                console.warn(`[storage] DB "${this.dbName}" upgrade blocked by another connection; waiting for it to close.`);
            };
            request.onsuccess = () => {
                this.db = request.result;
                this.eventBus.publish('STORAGE_READY', { dbName: this.dbName });
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create every registered store that does not yet exist.
                if (this.schema) {
                    for (const [storeName, config] of Object.entries(this.schema)) {
                        if (!db.objectStoreNames.contains(storeName)) {
                            const store = db.createObjectStore(storeName, {
                                keyPath: config.keyPath || 'id',
                                autoIncrement: config.autoIncrement !== false
                            });

                            // Create indexes
                            if (config.indexes) {
                                for (const [indexName, indexPath] of Object.entries(config.indexes)) {
                                    store.createIndex(indexName, indexPath, { unique: false });
                                }
                            }
                        }
                    }
                }
            };
        });
    }

    /**
     * Add item to store
     */
    async add(storeName, item) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(item);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                this.eventBus.publish('STORAGE_ADDED', { storeName, id: request.result });
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get item by ID
     */
    async get(storeName, id) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(id);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all items
     */
    async getAll(storeName) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update item
     */
    async update(storeName, item) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(item);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                this.eventBus.publish('STORAGE_UPDATED', { storeName, id: request.result });
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete item
     */
    async delete(storeName, id) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(id);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                this.eventBus.publish('STORAGE_DELETED', { storeName, id });
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all items from store
     */
    async clear(storeName) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                this.eventBus.publish('STORAGE_CLEARED', { storeName });
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Query by index
     */
    async query(storeName, indexName, value) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Count items
     */
    async count(storeName) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

/**
 * Create storage instance
 */
export function createStorage(eventBus, dbName, version) {
    return new Storage(eventBus, dbName, version);
}
