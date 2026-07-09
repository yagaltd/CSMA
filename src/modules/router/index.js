import { RouterService } from './services/RouterService.js';
import { RouterContracts } from './contracts/router-contracts.js';

export const manifest = {
    id: 'router',
    name: 'Router Module',
    version: '1.0.0',
    description: 'Optional SPA and hybrid route orchestration layered on the core runtime',
    dependencies: [],
    services: ['router'],
    contracts: [
        'INTENT_ROUTE_NAVIGATE',
        'ROUTE_NAVIGATION_STARTED',
        'ROUTE_CHANGED',
        'ROUTE_BLOCKED',
        'ROUTE_NOT_FOUND',
        'ROUTE_NAVIGATION_FAILED'
    ]
};

export const services = {
    router: RouterService
};

export const contracts = RouterContracts;
