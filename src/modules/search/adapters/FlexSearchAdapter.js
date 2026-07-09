import FlexSearch from 'flexsearch';

const VARIANT_CONFIG = {
    light: {
        tokenize: 'forward',
        optimize: true,
        resolution: 5,
        cache: 64,
        threshold: 0.6,
        suggest: true,
        bool: 'or'
    },
    compact: {
        tokenize: 'forward',
        optimize: true,
        resolution: 9,
        depth: 3,
        cache: 128,
        threshold: 0.5,
        suggest: true,
        bool: 'or'
    },
    full: {
        tokenize: 'forward',
        optimize: true,
        resolution: 12,
        depth: 4,
        context: true,
        cache: 256,
        threshold: 0.45,
        suggest: true,
        bool: 'or'
    }
};

const DEFAULT_OPTIONS = {
    variant: 'light',
    indexName: 'default',
    persistence: false,
    storageKey: null,
    persistDebounceMs: 150
};

const DB_NAME = 'csma-search';
const STORE_NAME = 'indexes';

/** Process-local memory fallback shared across adapter instances (tests / no IDB). */
const memorySnapshots = new Map();

export class FlexSearchAdapter {
    #persistTimer = null;
    #idb = null;
    #idbReady = null;
    #persistGeneration = 0;

    constructor() {
        this.options = { ...DEFAULT_OPTIONS };
        this.config = VARIANT_CONFIG.light;
        this.documents = new Map();
        this.engine = this.#createIndex();
    }

    init(options = {}) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };
        this.config = VARIANT_CONFIG[this.options.variant] || VARIANT_CONFIG.light;
        this.documents = new Map();
        this.engine = this.#createIndex();
        this.#clearPersistTimer();
        this.#persistGeneration += 1;

        if (this.options.persistence) {
            this.#restoreFromStorage();
        }

        return this;
    }

    async add(id, content) {
        if (!id) {
            throw new Error('FlexSearchAdapter.add requires an id');
        }
        const normalized = this.#normalizeContent(content);
        this.engine.add(id, normalized);
        this.documents.set(id, { id, content: normalized });
        this.#noteDirty();
        return id;
    }

    async addDocument(doc) {
        if (!doc || !doc.id) {
            throw new Error('FlexSearchAdapter.addDocument requires an id');
        }
        const normalized = this.#normalizeDocument(doc);
        this.engine.add(doc.id, normalized);
        this.documents.set(doc.id, { ...doc });
        this.#noteDirty();
        return doc.id;
    }

    async addDocuments(docs) {
        if (!Array.isArray(docs)) {
            return [];
        }

        const ids = [];
        for (const doc of docs) {
            if (!doc || !doc.id) {
                continue;
            }
            ids.push(await this.addDocument(doc));
        }
        return ids;
    }

    async remove(id) {
        this.engine.remove(id);
        this.documents.delete(id);
        this.#noteDirty();
    }

    async clear() {
        this.engine = this.#createIndex();
        this.documents.clear();
        this.#clearPersistTimer();
        await this.#persist(true);
    }

    search(query, options = {}) {
        if (!query) {
            return [];
        }
        const limit = typeof options.limit === 'number' ? options.limit : 20;
        const searchOptions = {
            limit,
            suggest: options.suggest ?? this.config.suggest,
            bool: options.bool ?? this.config.bool ?? 'and',
            threshold: options.threshold ?? this.config.threshold
        };
        const result = this.engine.search(query, searchOptions);

        if (Array.isArray(result)) {
            return result.map((entry) => {
                if (typeof entry === 'object' && entry !== null) {
                    return entry.id ?? entry.field ?? entry;
                }
                return entry;
            });
        }

        if (result && Array.isArray(result.result)) {
            return result.result.map((entry) => (typeof entry === 'object' ? entry.id : entry));
        }

        return [];
    }

    getDocument(id) {
        return this.documents.get(id) || null;
    }

    getIndexInfo() {
        return {
            engine: 'flexsearch',
            variant: this.options.variant,
            indexName: this.options.indexName,
            size: this.documents.size,
            persistence: Boolean(this.options.persistence)
        };
    }

    destroy() {
        this.#clearPersistTimer();
        this.documents.clear();
        this.engine = this.#createIndex();
        if (this.#idb) {
            try {
                this.#idb.close?.();
            } catch {
                // ignore
            }
            this.#idb = null;
            this.#idbReady = null;
        }
    }

    #createIndex() {
        return new FlexSearch.Index({
            ...this.config,
            worker: false,
            doc: {
                id: 'id'
            }
        });
    }

    #normalizeContent(value) {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (Array.isArray(value)) {
            return value.map((entry) => this.#normalizeContent(entry)).join(' ');
        }
        if (typeof value === 'object') {
            return Object.values(value)
                .map((entry) => this.#normalizeContent(entry))
                .join(' ');
        }
        return String(value);
    }

    #normalizeDocument(doc) {
        const entries = Object.entries(doc)
            .filter(([key]) => key !== 'id')
            .map(([, value]) => this.#normalizeContent(value));
        return entries.join(' ');
    }

    #storageKey() {
        return this.options.storageKey || `csma-search-${this.options.indexName}`;
    }

    #clearPersistTimer() {
        if (this.#persistTimer !== null) {
            clearTimeout(this.#persistTimer);
            this.#persistTimer = null;
        }
    }

    /**
     * Keep process-memory snapshot in sync immediately so restore works without debounce delay.
     * Debounce only the durable IDB write (or clear path).
     */
    #noteDirty() {
        if (!this.options.persistence) {
            return;
        }
        const key = this.#storageKey();
        memorySnapshots.set(key, Array.from(this.documents.values()));
        this.#scheduleDurablePersist();
    }

    #scheduleDurablePersist() {
        this.#clearPersistTimer();
        const delay = Math.max(0, Number(this.options.persistDebounceMs) || 150);
        const generation = this.#persistGeneration;
        this.#persistTimer = setTimeout(() => {
            this.#persistTimer = null;
            if (generation !== this.#persistGeneration) {
                return;
            }
            this.#persist(false).catch((error) => {
                console.warn('[FlexSearchAdapter] Failed to persist index', error);
            });
        }, delay);
    }

    async #persist(reset = false) {
        if (!this.options.persistence && !reset) {
            return;
        }

        const key = this.#storageKey();
        if (reset) {
            memorySnapshots.delete(key);
            if (typeof window !== 'undefined' && window.localStorage) {
                try {
                    window.localStorage.removeItem(key);
                } catch {
                    // ignore
                }
            }
            await this.#idbDelete(key);
            return;
        }

        const documents = Array.from(this.documents.values());
        memorySnapshots.set(key, documents);

        // Prefer IndexedDB. Avoid localStorage full-snapshot rewrite as primary path.
        const wrote = await this.#idbPut(key, documents);
        if (wrote && typeof window !== 'undefined' && window.localStorage) {
            // Drop any legacy localStorage snapshot after successful IDB write.
            try {
                window.localStorage.removeItem(key);
            } catch {
                // ignore
            }
        }
    }

    #restoreFromStorage() {
        const key = this.#storageKey();
        const fromMemory = memorySnapshots.get(key);
        if (Array.isArray(fromMemory) && fromMemory.length) {
            this.#ingestDocuments(fromMemory);
            return;
        }

        // Legacy localStorage migration (one-time read path).
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const snapshot = window.localStorage.getItem(key);
                if (snapshot) {
                    const documents = JSON.parse(snapshot);
                    if (Array.isArray(documents) && documents.length) {
                        this.#ingestDocuments(documents);
                        memorySnapshots.set(key, documents);
                        this.#idbPut(key, documents)
                            .then((ok) => {
                                if (ok) {
                                    try {
                                        window.localStorage.removeItem(key);
                                    } catch {
                                        // ignore
                                    }
                                }
                            })
                            .catch(() => {});
                        return;
                    }
                }
            } catch (error) {
                console.warn('[FlexSearchAdapter] Failed to restore persisted index', error);
                try {
                    window.localStorage.removeItem(key);
                } catch {
                    // ignore
                }
            }
        }

        // Async IDB restore for subsequent page loads (not available before init returns).
        this.#idbGet(key)
            .then((documents) => {
                if (!Array.isArray(documents) || !documents.length) {
                    return;
                }
                if (this.documents.size > 0) {
                    return;
                }
                memorySnapshots.set(key, documents);
                this.#ingestDocuments(documents);
            })
            .catch(() => {});
    }

    #ingestDocuments(documents) {
        documents.forEach((doc) => {
            if (doc && doc.id) {
                this.documents.set(doc.id, doc);
                const text = this.#normalizeDocument(doc) || doc.content || '';
                this.engine.add(doc.id, text);
            }
        });
    }

    #openDb() {
        if (typeof indexedDB === 'undefined') {
            return Promise.resolve(null);
        }
        if (this.#idb) {
            return Promise.resolve(this.#idb);
        }
        if (this.#idbReady) {
            return this.#idbReady;
        }

        this.#idbReady = new Promise((resolve) => {
            let request;
            try {
                request = indexedDB.open(DB_NAME, 1);
            } catch {
                this.#idbReady = null;
                resolve(null);
                return;
            }

            request.onerror = () => {
                this.#idbReady = null;
                resolve(null);
            };
            request.onsuccess = () => {
                this.#idb = request.result;
                resolve(this.#idb);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
        });

        return this.#idbReady;
    }

    async #idbPut(key, documents) {
        const db = await this.#openDb();
        if (!db) {
            return false;
        }
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put({ key, documents, updatedAt: Date.now() });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('flexsearch idb put failed'));
                tx.onabort = () => reject(tx.error || new Error('flexsearch idb aborted'));
            });
            return true;
        } catch {
            return false;
        }
    }

    async #idbGet(key) {
        const db = await this.#openDb();
        if (!db) {
            return null;
        }
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.get(key);
                request.onerror = () => reject(request.error || new Error('flexsearch idb get failed'));
                request.onsuccess = () => {
                    const row = request.result;
                    resolve(row?.documents || null);
                };
            });
        } catch {
            return null;
        }
    }

    async #idbDelete(key) {
        const db = await this.#openDb();
        if (!db) {
            return;
        }
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('flexsearch idb delete failed'));
            });
        } catch {
            // ignore
        }
    }
}
