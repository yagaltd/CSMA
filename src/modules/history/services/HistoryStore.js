/**
 * HistoryStore — IDB adapter for the history module.
 *
 * Extracted verbatim from the former ActionLogService's IndexedDbActionStore
 * + MemoryActionStore. Parameterised by dbName + storeName so each consumer
 * (history default, optimistic-sync's continuation data, future mindmap ops)
 * can target its own IDB store.
 *
 * Storage layout: one record per entry, keyed by `entry.id`. Records carry
 * the full entry object (no joins, no indexes beyond the primary key).
 */

const DEFAULT_DB_NAME = 'csma-history';
const DEFAULT_STORE_NAME = 'ops';

export class HistoryStore {
    constructor({ dbName = DEFAULT_DB_NAME, storeName = DEFAULT_STORE_NAME } = {}) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this.supportsStorageEvents = false;
        this._backend = null;
    }

    init() {
        if (typeof indexedDB !== 'undefined') {
            this._backend = new IndexedDbHistoryBackend({
                dbName: this.dbName,
                storeName: this.storeName
            });
        } else {
            this._backend = new MemoryHistoryBackend();
        }
        this.supportsStorageEvents = this._backend.supportsStorageEvents;
        return this._backend.init();
    }

    getAll() {
        return this._backend.getAll();
    }

    put(entry) {
        return this._backend.put(entry);
    }

    delete(id) {
        return this._backend.delete(id);
    }

    clear() {
        return this._backend.clear();
    }
}

class IndexedDbHistoryBackend {
    constructor({ dbName, storeName }) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this.supportsStorageEvents = false;
    }

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    getAll() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result || [];
                result.sort((a, b) => b.createdAt - a.createdAt);
                resolve(result);
            };
        });
    }

    put(entry) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.put(entry);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    delete(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(id);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    clear() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}

class MemoryHistoryBackend {
    constructor() {
        this.items = new Map();
        this.supportsStorageEvents = false;
    }

    init() {
        return Promise.resolve();
    }

    async getAll() {
        const items = Array.from(this.items.values());
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return items;
    }

    async put(entry) {
        this.items.set(entry.id, entry);
    }

    async delete(id) {
        this.items.delete(id);
    }

    async clear() {
        this.items.clear();
    }
}

export { DEFAULT_DB_NAME, DEFAULT_STORE_NAME };
