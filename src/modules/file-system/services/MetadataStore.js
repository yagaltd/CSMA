const DEFAULT_DB_NAME = 'csma-file-system';
const DEFAULT_STORE_NAME = 'files';
const BLOB_STORE_NAME = 'file_blobs';

export class MetadataStore {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.dbName = options.dbName || DEFAULT_DB_NAME;
        this.storeName = options.storeName || DEFAULT_STORE_NAME;
        this.db = null;
        this.enableBlobs = false;
        this.memoryStore = null;
        this.memoryBlobs = null;
    }

    async init({ enableBlobStore = false } = {}) {
        if (this.db || this.memoryStore) {
            this.enableBlobs = enableBlobStore || this.enableBlobs;
            return;
        }

        this.enableBlobs = enableBlobStore;

        if (typeof indexedDB === 'undefined') {
            this.memoryStore = new Map();
            this.memoryBlobs = new Map();
            return;
        }

        this.db = await this.#openDatabase();
    }

    async enableBlobStore() {
        this.enableBlobs = true;
        if (!this.db || typeof indexedDB === 'undefined') {
            this.memoryBlobs = this.memoryBlobs || new Map();
            return;
        }
        // Blob store created during initial upgrade; nothing else to do
    }

    async put(record) {
        const normalized = {
            ...record,
            id: record.id,
            tags: Array.isArray(record.tags)
                ? record.tags.map((tag) => tag.trim()).filter(Boolean)
                : [],
            createdAt: record.createdAt || Date.now(),
            updatedAt: Date.now()
        };

        if (this.memoryStore) {
            this.memoryStore.set(normalized.id, normalized);
            return normalized;
        }

        await this.#withStore(this.storeName, 'readwrite', (store) => store.put(normalized));
        return normalized;
    }

    async get(id) {
        if (this.memoryStore) {
            return this.memoryStore.get(id) || null;
        }
        return this.#withStore(this.storeName, 'readonly', (store) => store.get(id));
    }

    async delete(id) {
        if (this.memoryStore) {
            this.memoryStore.delete(id);
            if (this.memoryBlobs) {
                this.memoryBlobs.delete(id);
            }
            return;
        }
        await this.#withStore(this.storeName, 'readwrite', (store) => store.delete(id));
        if (this.enableBlobs) {
            await this.#withStore(BLOB_STORE_NAME, 'readwrite', (store) => store.delete(id));
        }
    }

    async list(limit = 100) {
        const items = await this.getAll();
        const sorted = items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return sorted.slice(0, limit);
    }

    async getAll() {
        if (this.memoryStore) {
            return Array.from(this.memoryStore.values());
        }
        return this.#withStore(this.storeName, 'readonly', (store) => store.getAll());
    }

    async search(filters = {}) {
        const items = await this.getAll();
        const { text, tags, category } = filters;
        const tagList = Array.isArray(tags)
            ? tags.map((tag) => tag.toLowerCase())
            : typeof tags === 'string' && tags
                ? [tags.toLowerCase()]
                : [];

        const term = typeof text === 'string' ? text.toLowerCase() : null;
        const categoryFilter = category ? String(category).toLowerCase() : null;

        return items.filter((item) => {
            let matches = true;

            if (term) {
                const haystack = `${item.title || ''} ${item.description || ''}`.toLowerCase();
                matches = matches && haystack.includes(term);
            }

            if (tagList.length > 0) {
                const itemTags = (item.tags || []).map((tag) => tag.toLowerCase());
                matches = matches && tagList.every((tag) => itemTags.includes(tag));
            }

            if (categoryFilter) {
                matches = matches && (item.category || '').toLowerCase() === categoryFilter;
            }

            return matches;
        });
    }

    async saveBlob(id, blob) {
        if (!this.enableBlobs) {
            throw new Error('Blob storage is not enabled');
        }

        if (this.memoryBlobs) {
            this.memoryBlobs.set(id, blob);
            return;
        }

        await this.#withStore(BLOB_STORE_NAME, 'readwrite', (store) => store.put({ id, blob }));
    }

    async getBlob(id) {
        if (!this.enableBlobs) {
            return null;
        }

        if (this.memoryBlobs) {
            return this.memoryBlobs.get(id) || null;
        }

        const record = await this.#withStore(BLOB_STORE_NAME, 'readonly', (store) => store.get(id));
        return record ? record.blob : null;
    }

    async deleteBlob(id) {
        if (!this.enableBlobs) {
            return;
        }

        if (this.memoryBlobs) {
            this.memoryBlobs.delete(id);
            return;
        }

        await this.#withStore(BLOB_STORE_NAME, 'readwrite', (store) => store.delete(id));
    }

    #openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) {
                    db.createObjectStore(BLOB_STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

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
