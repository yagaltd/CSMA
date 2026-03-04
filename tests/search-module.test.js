import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { randomUUID } from 'crypto';

const memoryStorage = () => {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        }
    };
};

if (typeof sessionStorage === 'undefined') {
    globalThis.sessionStorage = memoryStorage();
}

if (typeof window === 'undefined') {
    globalThis.window = {};
}

if (typeof window.localStorage === 'undefined') {
    window.localStorage = memoryStorage();
}

if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.randomUUID !== 'function') {
    globalThis.crypto = {
        randomUUID
    };
}

let EventBus;
let Contracts;
let createSearchService;

beforeAll(async () => {
    ({ EventBus } = await import('../src/runtime/EventBus.js'));
    ({ Contracts } = await import('../src/runtime/Contracts.js'));
    ({ createSearchService } = await import('../src/modules/search/index.js'));
});

function createEventBus() {
    const eventBus = new EventBus();
    eventBus.contracts = Contracts;
    return eventBus;
}

describe('Search Module - Core tier', () => {
    let eventBus;
    let search;
    let results;

    beforeEach(() => {
        eventBus = createEventBus();
        search = createSearchService(eventBus, { tier: 'core' });
        search.init();
        results = [];
        eventBus.subscribe('SEARCH_RESULTS_RETURNED', (payload) => results.push(payload));
    });

    it('indexes documents and returns ids', async () => {
        await search.addDocument({ id: 'doc-1', title: 'FlexSearch Intro', content: 'FlexSearch basics' });
        await eventBus.publish('SEARCH_QUERY_INITIATED', {
            version: 1,
            query: 'FlexSearch',
            tier: 'core',
            timestamp: Date.now()
        });

        expect(results.length).toBe(1);
        expect(results[0].results.ids).toContain('doc-1');
    });
});

describe('Search Module - Enhanced tier', () => {
    let eventBus;
    let search;
    let facetsEvent;
    let paginationEvent;

    beforeEach(() => {
        eventBus = createEventBus();
        search = createSearchService(eventBus, { tier: 'enhanced', facets: ['tags'] });
        search.init({ facets: ['tags'] });
        facetsEvent = null;
        paginationEvent = null;
        eventBus.subscribe('SEARCH_FACETS_UPDATED', (payload) => { facetsEvent = payload; });
        eventBus.subscribe('SEARCH_PAGINATION_CHANGED', (payload) => { paginationEvent = payload; });
    });

    it('publishes facets and pagination metadata', async () => {
        await search.addDocument({ id: 'doc-1', title: 'FlexSearch Guide', content: 'search docs', tags: ['search', 'guide'], category: 'docs' });
        await search.addDocument({ id: 'doc-2', title: 'CSMA Search', content: 'csma search module', tags: ['csma', 'search'], category: 'docs' });

        await eventBus.publish('SEARCH_QUERY_INITIATED', {
            version: 1,
            query: 'search',
            tier: 'enhanced',
            options: {
                facets: ['tags'],
                page: 1,
                pageSize: 1
            },
            timestamp: Date.now()
        });

        expect(facetsEvent?.facets?.tags?.search).toBeGreaterThan(0);
        expect(paginationEvent?.total).toBeGreaterThan(0);
    });
});

describe('Search Module - AI tier', () => {
    let eventBus;
    let aiSearch;
    let contextPayload;

    beforeEach(() => {
        eventBus = createEventBus();
        aiSearch = createSearchService(eventBus, { tier: 'ai', context: { documents: 2, charLimit: 500 } });
        aiSearch.init();
        contextPayload = null;
        eventBus.subscribe('AI_CONTEXT_RETRIEVED', (payload) => { contextPayload = payload; });
    });

    it('builds AI context from indexed documents', async () => {
        await aiSearch.addDocument({ id: 'doc-1', title: 'Authentication Guide', content: 'Learn how to implement auth search' });
        await aiSearch.addDocument({ id: 'doc-2', title: 'Search Module', content: 'Detailed overview of search module for CSMA' });

        await eventBus.publish('AI_CONTEXT_REQUESTED', {
            query: 'search module',
            tier: 'ai',
            timestamp: Date.now()
        });

        expect(contextPayload).not.toBeNull();
        expect(contextPayload.context).toContain('Search Module');
        expect(contextPayload.tokensSaved).toBeGreaterThan(0);
    });
});
