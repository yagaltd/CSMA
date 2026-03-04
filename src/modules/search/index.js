import { SearchModuleService, createSearchService } from './services/SearchModuleService.js';
import { CoreSearchService } from './services/CoreSearchService.js';
import { EnhancedSearchService } from './services/EnhancedSearchService.js';
import { AISearchService } from './services/AISearchService.js';

export const manifest = {
    name: 'Search Module',
    version: '1.0.0',
    description: 'Tiered FlexSearch integration for CSMA',
    dependencies: [],
    bundleSize: '+13KB',
    contracts: [
        'SEARCH_QUERY_INITIATED',
        'SEARCH_RESULTS_RETURNED',
        'SEARCH_INDEX_UPDATED',
        'SEARCH_INDEX_CLEARED',
        'SEARCH_ERROR',
        'SEARCH_FACETS_UPDATED',
        'SEARCH_PAGINATION_CHANGED',
        'SEARCH_SUGGESTIONS_READY',
        'AI_CONTEXT_REQUESTED',
        'AI_CONTEXT_RETRIEVED',
        'AI_CONTEXT_FAILED'
    ]
};

export const services = {
    search: SearchModuleService
};

export { createSearchService, CoreSearchService, EnhancedSearchService, AISearchService };
