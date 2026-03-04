import { object, string, number, size, enums, optional, array, any, boolean } from '../../../runtime/validation/index.js';

export const SearchContracts = {
    SEARCH_QUERY_INITIATED: {
        version: 1,
        type: 'intent',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'User initiated a search query',
        security: {
            rateLimits: {
                perUser: { requests: 15, window: 60_000 }
            }
        },
        schema: object({
            version: number(),
            query: size(string(), 1, 200),
            tier: enums(['core', 'enhanced', 'ai']),
            options: optional(object({
                limit: optional(number()),
                page: optional(number()),
                pageSize: optional(number()),
                facets: optional(array(string())),
                suggestions: optional(object({
                    enabled: optional(boolean())
                }))
            })),
            timestamp: number()
        })
    },

    SEARCH_RESULTS_RETURNED: {
        version: 1,
        type: 'event',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Normalized search results payload',

        schema: object({
            version: number(),
            query: string(),
            results: object({
                ids: size(array(string()), 0, 500)
            }),
            durationMs: number()
        })
    },

    SEARCH_INDEX_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Search index mutation event',

        schema: object({
            id: string(),
            operation: enums(['add', 'remove']),
            timestamp: number()
        })
    },

    SEARCH_INDEX_CLEARED: {
        version: 1,
        type: 'event',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the index is cleared',

        schema: object({
            timestamp: number()
        })
    },

    SEARCH_ERROR: {
        version: 1,
        type: 'event',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when a search request fails',

        schema: object({
            query: optional(string()),
            message: string(),
            operation: optional(string()),
            timestamp: number()
        })
    },

    SEARCH_FACETS_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'beta',
        description: 'Facet breakdown for the current query',

        schema: object({
            query: string(),
            facets: any(),
            timestamp: number()
        })
    },

    SEARCH_PAGINATION_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Pagination metadata for current search results',

        schema: object({
            page: number(),
            pageSize: number(),
            total: number(),
            totalPages: number(),
            timestamp: number()
        })
    },

    SEARCH_SUGGESTIONS_READY: {
        version: 1,
        type: 'event',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Autocomplete suggestions ready',

        schema: object({
            query: string(),
            suggestions: size(array(string()), 0, 20),
            timestamp: number()
        })
    },

    AI_CONTEXT_REQUESTED: {
        version: 1,
        type: 'intent',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'AI tier requested semantic context',
        security: {
            rateLimits: {
                perUser: { requests: 5, window: 60_000 }
            }
        },

        schema: object({
            query: size(string(), 1, 400),
            tier: enums(['ai']),
            timestamp: number()
        })
    },

    AI_CONTEXT_RETRIEVED: {
        version: 1,
        type: 'event',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Context payload prepared for an AI request',

        schema: object({
            query: string(),
            context: size(string(), 0, 4000),
            tokensSaved: number(),
            timestamp: number()
        })
    },

    AI_CONTEXT_FAILED: {
        version: 1,
        type: 'event',
        owner: 'search-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Context generation failed',

        schema: object({
            query: optional(string()),
            error: string(),
            timestamp: number()
        })
    }
};
