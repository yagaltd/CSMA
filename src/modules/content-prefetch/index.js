import { ContentPrefetchService } from './services/ContentPrefetchService.js';
import { ContentPrefetchContracts } from './contracts/content-prefetch-contracts.js';

export const manifest = {
    id: 'content-prefetch',
    name: 'Content Prefetch',
    version: '1.0.0',
    description: 'Route and content manifest prefetch orchestration',
    dependencies: [],
    services: ['contentPrefetch'],
    contracts: Object.keys(ContentPrefetchContracts),
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export const services = { contentPrefetch: ContentPrefetchService };
export const contracts = ContentPrefetchContracts;
export { ContentPrefetchService };
