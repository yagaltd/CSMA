import { SearchFacade } from '../adapters/SearchFacade.js';
import { sanitizeLLMInput } from '../../../utils/sanitize.js';

const DEFAULT_OPTIONS = {
    tier: 'core',
    variant: 'light',
    indexName: 'default',
    persistence: false,
    limit: 20,
    facets: [],
    pageSize: 20,
    suggestions: {
        enabled: false,
        max: 5
    }
};

export class BaseSearchService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            suggestions: {
                ...DEFAULT_OPTIONS.suggestions,
                ...(options.suggestions || {})
            }
        };

        this.facade = new SearchFacade({
            variant: this.options.variant,
            indexName: this.options.indexName,
            persistence: this.options.persistence
        });

        this.documents = new Map();
        this.subscriptions = [];
    }

    init(options = {}) {
        this.options = {
            ...this.options,
            ...options,
            suggestions: {
                ...this.options.suggestions,
                ...(options.suggestions || {})
            }
        };

        if (this.subscriptions.length === 0 && this.eventBus) {
            this.subscriptions.push(
                this.eventBus.subscribe('SEARCH_QUERY_INITIATED', (payload) => this.handleQuery(payload))
            );
        }

        return this;
    }

    async add(id, content) {
        const recordId = await this.facade.add(id, content);
        this.documents.set(recordId, { id: recordId, content: String(content) });
        this.#publishIndexUpdated(recordId, 'add');
        return recordId;
    }

    async addDocument(doc) {
        if (!doc || !doc.id) {
            throw new Error('Document requires an id');
        }
        await this.facade.addDocument(doc);
        this.documents.set(doc.id, { ...doc });
        this.#publishIndexUpdated(doc.id, 'add');
        return doc.id;
    }

    async addDocuments(docs) {
        if (!Array.isArray(docs)) return;
        const promises = docs.map(async (doc) => {
            if (!doc || !doc.id) return;
            await this.facade.addDocument(doc);
            this.documents.set(doc.id, { ...doc });
        });
        await Promise.all(promises);

        // Emit non-contract event for speed (or add contract later)
        this.eventBus?.publish('SEARCH_INDEX_BATCH_UPDATED', {
            count: docs.length,
            operation: 'add',
            timestamp: Date.now()
        });
    }

    async remove(id) {
        await this.facade.remove(id);
        this.documents.delete(id);
        this.#publishIndexUpdated(id, 'remove');
    }

    async clear() {
        await this.facade.clear();
        this.documents.clear();
        this.eventBus?.publish('SEARCH_INDEX_CLEARED', {
            timestamp: Date.now()
        });
    }

    getIndexInfo() {
        return this.facade.getIndexInfo();
    }

    async handleQuery(payload = {}) {
        if (!this.#matchesTier(payload.tier)) {
            return [];
        }

        const sanitizedQuery = sanitizeLLMInput(payload.query || '');
        if (!sanitizedQuery) {
            return [];
        }

        const start = this.#now();
        let ids = [];
        try {
            ids = await this.executeQuery(sanitizedQuery, payload);
        } catch (error) {
            this.publishError('search', sanitizedQuery, error);
            return [];
        }

        const durationMs = this.#now() - start;
        this.publishResults({
            version: payload.version ?? 1,
            query: sanitizedQuery,
            ids,
            durationMs
        });
        return ids;
    }

    async executeQuery(query, payload) {
        const limit = payload?.options?.limit ?? this.options.limit;
        const bool = payload?.options?.bool ?? 'or';
        const threshold = payload?.options?.threshold;
        const suggest = payload?.options?.suggest;
        return this.facade.search(query, { limit, bool, threshold, suggest });
    }

    publishResults({ version, query, ids, durationMs }) {
        this.eventBus?.publish('SEARCH_RESULTS_RETURNED', {
            version,
            query,
            results: { ids },
            durationMs
        });
    }

    publishError(operation, query, error) {
        this.eventBus?.publish('SEARCH_ERROR', {
            query,
            message: error?.message || String(error),
            operation,
            timestamp: Date.now()
        });
    }

    destroy() {
        this.subscriptions.forEach((unsubscribe) => unsubscribe && unsubscribe());
        this.subscriptions = [];
        this.documents.clear();
    }

    #matchesTier(requestedTier) {
        if (!requestedTier) {
            return true;
        }
        if (this.options.tier === 'ai') {
            return true; // AI tier responds to all search intents
        }
        return requestedTier === this.options.tier;
    }

    #publishIndexUpdated(id, operation) {
        this.eventBus?.publish('SEARCH_INDEX_UPDATED', {
            id,
            operation,
            timestamp: Date.now()
        });
    }

    #now() {
        if (typeof performance !== 'undefined' && performance.now) {
            return performance.now();
        }
        if (typeof process !== 'undefined' && process.hrtime) {
            const [seconds, nanoseconds] = process.hrtime();
            return seconds * 1000 + nanoseconds / 1e6;
        }
        return Date.now();
    }
}
