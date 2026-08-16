// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { ServiceManager } from '../src/runtime/ServiceManager.js';
import { AdapterRegistry } from '../src/runtime/AdapterRegistry.js';
import { createRuntimeState } from '../src/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../docs/legacy/features.js';
import { FlexSearchAdapter, SearchModuleService, createSearchService } from '../src/modules/search/index.js';

function createAdapterRegistry(adapter = new FlexSearchAdapter()) {
    const eventBus = new EventBus();
    const serviceManager = new ServiceManager(eventBus);
    const adapterRegistry = new AdapterRegistry({ eventBus, serviceManager });

    serviceManager.register('searchFlexSearchAdapter', adapter);
    adapterRegistry.register('search', {
        id: 'search.flexsearch',
        type: 'search-engine',
        serviceName: 'searchFlexSearchAdapter',
        capabilities: ['local', 'in-memory', 'persistence', 'suggestions']
    });

    return { eventBus, serviceManager, adapterRegistry, adapter };
}

describe('FlexSearchAdapter', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('adds, searches, removes, and clears documents', async () => {
        const adapter = new FlexSearchAdapter().init({ variant: 'compact', indexName: 'unit' });

        await adapter.add('plain', 'alpha beta');
        await adapter.addDocument({ id: 'doc', title: 'Gamma guide', category: 'docs' });

        expect(await adapter.search('alpha')).toContain('plain');
        expect(await adapter.search('gamma')).toContain('doc');
        expect(adapter.getDocument('doc')).toEqual({ id: 'doc', title: 'Gamma guide', category: 'docs' });

        await adapter.remove('plain');
        expect(await adapter.search('alpha')).not.toContain('plain');

        await adapter.clear();
        expect(await adapter.search('gamma')).toEqual([]);
        expect(adapter.getIndexInfo()).toMatchObject({
            engine: 'flexsearch',
            variant: 'compact',
            indexName: 'unit',
            size: 0,
            persistence: false
        });
    });

    it('normalizes nested document values for indexing', async () => {
        const adapter = new FlexSearchAdapter().init();

        await adapter.addDocument({
            id: 'nested',
            title: 'Release',
            tags: ['search', 'adapter'],
            metadata: { owner: 'platform', beta: true }
        });

        expect(await adapter.search('platform')).toEqual(['nested']);
        expect(await adapter.search('true')).toEqual(['nested']);
    });

    it('restores persisted documents and clears persisted state on reset', async () => {
        const storageKey = 'search-adapter-persist-test';
        const first = new FlexSearchAdapter().init({ persistence: true, storageKey });
        await first.addDocument({ id: 'persisted', title: 'Saved Search Document' });

        const restored = new FlexSearchAdapter().init({ persistence: true, storageKey });
        expect(await restored.search('saved')).toEqual(['persisted']);
        expect(restored.getIndexInfo().size).toBe(1);

        await restored.clear();
        expect(localStorage.getItem(storageKey)).toBeNull();

        const empty = new FlexSearchAdapter().init({ persistence: true, storageKey });
        expect(await empty.search('saved')).toEqual([]);
    });
});

describe('SearchModuleService adapter registry integration', () => {
    it('resolves search.flexsearch from AdapterRegistry and passes options into the adapter', () => {
        const adapter = {
            init: vi.fn().mockReturnThis(),
            add: vi.fn(),
            addDocument: vi.fn(),
            addDocuments: vi.fn(),
            remove: vi.fn(),
            clear: vi.fn(),
            search: vi.fn().mockReturnValue([]),
            getDocument: vi.fn(),
            getIndexInfo: vi.fn()
        };
        const { eventBus, adapterRegistry } = createAdapterRegistry(adapter);
        const moduleService = new SearchModuleService(eventBus);

        const service = moduleService.init({
            adapterRegistry,
            adapter: 'search.flexsearch',
            tier: 'enhanced',
            variant: 'full',
            indexName: 'catalog',
            persistence: true,
            storageKey: 'catalog-search'
        });

        expect(service).toBeTruthy();
        expect(adapter.init).toHaveBeenCalledWith({
            variant: 'full',
            indexName: 'catalog',
            persistence: true,
            storageKey: 'catalog-search'
        });
    });

    it('throws a clear error when adapterRegistry is missing', () => {
        expect(() => createSearchService(new EventBus(), {})).toThrow(/adapterRegistry/);
    });

    it('throws a clear error when the configured adapter is unavailable', () => {
        const { eventBus, adapterRegistry } = createAdapterRegistry();

        expect(() => createSearchService(eventBus, {
            adapterRegistry,
            adapter: 'search.missing'
        })).toThrow(/search\.missing/);
    });
});

describe('Search tiers through injected adapter', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('preserves core search result publication', async () => {
        const { eventBus, adapterRegistry } = createAdapterRegistry();
        const service = createSearchService(eventBus, { adapterRegistry, tier: 'core' }).init();
        const results = [];
        eventBus.subscribe('SEARCH_RESULTS_RETURNED', (payload) => results.push(payload));

        await service.add('core-doc', 'core adapter result');
        const ids = await service.handleQuery({ query: 'adapter', tier: 'core' });

        expect(ids).toEqual(['core-doc']);
        expect(results[0].results.ids).toEqual(['core-doc']);
    });

    it('preserves enhanced facets, pagination, and suggestions', async () => {
        const { eventBus, adapterRegistry } = createAdapterRegistry();
        const service = createSearchService(eventBus, {
            adapterRegistry,
            tier: 'enhanced',
            facets: ['category'],
            suggestions: { enabled: true, max: 2 }
        }).init();
        const facets = [];
        const pagination = [];
        const suggestions = [];
        eventBus.subscribe('SEARCH_FACETS_UPDATED', (payload) => facets.push(payload));
        eventBus.subscribe('SEARCH_PAGINATION_CHANGED', (payload) => pagination.push(payload));
        eventBus.subscribe('SEARCH_SUGGESTIONS_READY', (payload) => suggestions.push(payload));

        await service.addDocuments([
            { id: 'a', title: 'Adapter Alpha', content: 'registry search', category: 'Docs' },
            { id: 'b', title: 'Adapter Beta', content: 'registry search', category: 'Docs' },
            { id: 'c', title: 'Adapter Gamma', content: 'registry search', category: 'Guides' }
        ]);
        const ids = await service.handleQuery({
            query: 'adapter',
            tier: 'enhanced',
            options: { page: 1, pageSize: 2 }
        });

        expect(ids).toHaveLength(2);
        expect(facets[0].facets.category).toEqual({ docs: 2, guides: 1 });
        expect(pagination[0]).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(suggestions[0].suggestions).toEqual(['Adapter Alpha', 'Adapter Beta']);
    });

    it('preserves AI context generation', async () => {
        const { eventBus, adapterRegistry } = createAdapterRegistry();
        const service = createSearchService(eventBus, {
            adapterRegistry,
            tier: 'ai',
            context: { documents: 1, charLimit: 200 }
        }).init();
        const contexts = [];
        eventBus.subscribe('AI_CONTEXT_RETRIEVED', (payload) => contexts.push(payload));

        await service.addDocument({
            id: 'ai-doc',
            title: 'Adapter Context',
            content: 'Search adapters provide AI context.',
            tags: ['search']
        });
        await eventBus.publish('AI_CONTEXT_REQUESTED', {
            query: 'adapters',
            tier: 'ai',
            timestamp: Date.now()
        });

        expect(contexts).toHaveLength(1);
        expect(contexts[0].context).toContain('Title: Adapter Context');
        expect(contexts[0].context).toContain('Content: Search adapters provide AI context.');
    });
});

describe('runtime search bootstrap', () => {
    beforeEach(() => {
        window.csma = {};
        localStorage.clear();
    });

    it('loads search, registers the FlexSearch adapter contribution, initializes search, and exposes window.csma.search', async () => {
        const state = createRuntimeState();

        await loadOptionalFeatures(state, {
            FEATURES: { SEARCH_MODULE: true },
            apiBaseUrl: '',
            runtimeConfig: {
                search: {
                    adapter: 'search.flexsearch',
                    tier: 'core',
                    indexName: 'runtime-search'
                }
            },
            pages: []
        });

        expect(state.registries.adapters.get('search.flexsearch')).toMatchObject({
            type: 'search-engine',
            serviceName: 'searchFlexSearchAdapter'
        });
        expect(state.serviceManager.get('searchFlexSearchAdapter')).toBeTruthy();
        expect(window.csma.search).toBe(state.serviceManager.get('search'));
        expect(window.csma.search.getIndexInfo()).toMatchObject({
            engine: 'flexsearch',
            indexName: 'runtime-search'
        });
    });
});
