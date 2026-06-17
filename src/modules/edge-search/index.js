import { EdgeSearchService } from './services/EdgeSearchService.js';
import { EdgeSearchContracts } from './contracts/edge-search-contracts.js';

export const manifest = { id: 'edge-search', name: 'Edge Search', version: '1.0.0', description: 'Search client, facets, suggestions, result state, and public/static index adapter', dependencies: [], services: ['edgeSearch'], contracts: Object.keys(EdgeSearchContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { edgeSearch: EdgeSearchService };
export const contracts = EdgeSearchContracts;
export { EdgeSearchService };
