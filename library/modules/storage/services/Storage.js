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
     * Initialize database
     */
    async init(schema) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.eventBus.publish('STORAGE_READY', { dbName: this.dbName });
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores from schema
                if (schema) {
                    for (const [storeName, config] of Object.entries(schema)) {
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
