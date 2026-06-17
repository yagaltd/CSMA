import { CatalogService } from './services/CatalogService.js';
import { CatalogContracts } from './contracts/catalog-contracts.js';

export const manifest = {
    id: 'catalog',
    name: 'Catalog',
    version: '1.0.0',
    description: 'Product/content catalog state, filters, facets, and detail cache',
    dependencies: [],
    services: ['catalog'],
    contracts: Object.keys(CatalogContracts),
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export const services = { catalog: CatalogService };
export const contracts = CatalogContracts;
export { CatalogService };
