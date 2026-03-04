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

export class SearchFacade {
    constructor(options = {}) {
        this.options = {
            variant: 'light',
            indexName: 'default',
            persistence: false,
            storageKey: null,
            ...options
        };

        this.config = VARIANT_CONFIG[this.options.variant] || VARIANT_CONFIG.light;
        this.documents = new Map();
        this.engine = this.#createIndex();

        if (this.options.persistence) {
            this.#restoreFromStorage();
        }
    }

    async add(id, content) {
        if (!id) {
            throw new Error('SearchFacade.add requires an id');
        }
        const normalized = this.#normalizeContent(content);
        this.engine.add(id, normalized);
        this.documents.set(id, { id, content: normalized });
        this.#persist();
        return id;
    }

    async addDocument(doc) {
        if (!doc || !doc.id) {
            throw new Error('SearchFacade.addDocument requires an id');
        }
        const normalized = this.#normalizeDocument(doc);
        this.engine.add(doc.id, normalized);
        this.documents.set(doc.id, { ...doc });
        this.#persist();
        return doc.id;
    }

    async remove(id) {
        this.engine.remove(id);
        this.documents.delete(id);
        this.#persist();
    }

    async clear() {
        this.engine = this.#createIndex();
        this.documents.clear();
        this.#persist(true);
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

    #persist(reset = false) {
        if (!this.options.persistence) {
            return;
        }
        const key = this.options.storageKey || `csma-search-${this.options.indexName}`;
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        if (reset) {
            window.localStorage.removeItem(key);
            return;
        }
        const snapshot = JSON.stringify(Array.from(this.documents.values()));
        window.localStorage.setItem(key, snapshot);
    }

    #restoreFromStorage() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        const key = this.options.storageKey || `csma-search-${this.options.indexName}`;
        const snapshot = window.localStorage.getItem(key);
        if (!snapshot) {
            return;
        }
        try {
            const documents = JSON.parse(snapshot);
            if (Array.isArray(documents)) {
                documents.forEach((doc) => {
                    if (doc && doc.id) {
                        this.documents.set(doc.id, doc);
                        const text = this.#normalizeDocument(doc) || doc.content || '';
                        this.engine.add(doc.id, text);
                    }
                });
            }
        } catch (error) {
            console.warn('[SearchFacade] Failed to restore persisted index', error);
            window.localStorage.removeItem(key);
        }
    }
}
