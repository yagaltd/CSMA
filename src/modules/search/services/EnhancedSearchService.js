import { BaseSearchService } from './BaseSearchService.js';

export class EnhancedSearchService extends BaseSearchService {
    constructor(eventBus, options = {}) {
        super(eventBus, {
            tier: 'enhanced',
            variant: options.variant || 'compact',
            facets: options.facets || ['category'],
            pageSize: options.pageSize || 20,
            suggestions: {
                enabled: true,
                max: 5,
                ...(options.suggestions || {})
            },
            ...options
        });
    }

    async executeQuery(query, payload = {}) {
        const ids = await super.executeQuery(query, payload);
        const total = ids.length;
        const options = payload.options || {};
        const pageSize = options.pageSize || this.options.pageSize;
        const page = options.page || 1;
        const facets = options.facets || this.options.facets || [];
        const suggestionsRequested = this.#shouldPublishSuggestions(options);

        if (facets.length > 0) {
            this.#publishFacets(query, ids, facets);
        }

        let pagedIds = ids;
        if (options.page || options.pageSize) {
            const start = Math.max(0, (page - 1) * pageSize);
            pagedIds = ids.slice(start, start + pageSize);
            this.#publishPagination({ page, pageSize, total });
        }

        if (suggestionsRequested) {
            this.#publishSuggestions(query);
        }

        return pagedIds;
    }

    #publishFacets(query, ids, facetFields) {
        const docs = ids
            .map((id) => this.documents.get(id))
            .filter(Boolean);
        if (docs.length === 0) {
            return;
        }

        const facets = {};
        facetFields.forEach((field) => {
            const counts = new Map();
            docs.forEach((doc) => {
                const value = doc[field];
                if (Array.isArray(value)) {
                    value.forEach((entry) => {
                        if (!entry) return;
                        const key = String(entry).toLowerCase();
                        counts.set(key, (counts.get(key) || 0) + 1);
                    });
                } else if (value) {
                    const key = String(value).toLowerCase();
                    counts.set(key, (counts.get(key) || 0) + 1);
                }
            });

            if (counts.size > 0) {
                facets[field] = Object.fromEntries(counts.entries());
            }
        });

        if (Object.keys(facets).length > 0) {
            this.eventBus?.publish('SEARCH_FACETS_UPDATED', {
                query,
                facets,
                timestamp: Date.now()
            });
        }
    }

    #publishPagination({ page, pageSize, total }) {
        this.eventBus?.publish('SEARCH_PAGINATION_CHANGED', {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
            timestamp: Date.now()
        });
    }

    #shouldPublishSuggestions(options = {}) {
        if (typeof options.suggestions?.enabled === 'boolean') {
            return options.suggestions.enabled;
        }
        return this.options.suggestions.enabled;
    }

    #publishSuggestions(query) {
        const max = this.options.suggestions.max || 5;
        const lowerQuery = query.toLowerCase();
        const suggestions = [];

        for (const doc of this.documents.values()) {
            if (!doc) continue;
            const text = this.#extractPrimaryText(doc).toLowerCase();
            if (text.includes(lowerQuery)) {
                suggestions.push(doc.title || doc.name || doc.id);
            }
            if (suggestions.length >= max) {
                break;
            }
        }

        if (suggestions.length > 0) {
            this.eventBus?.publish('SEARCH_SUGGESTIONS_READY', {
                query,
                suggestions,
                timestamp: Date.now()
            });
        }
    }

    #extractPrimaryText(doc) {
        if (doc.title) return String(doc.title);
        if (doc.name) return String(doc.name);
        if (doc.content) return String(doc.content);
        return Object.values(doc)
            .filter((value) => typeof value === 'string')
            .join(' ');
    }
}
