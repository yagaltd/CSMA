import { AnalyticsService } from './services/AnalyticsService.js';
import { AnalyticsContracts } from './contracts/analytics-contracts.js';

export const manifest = {
    id: 'analytics',
    name: 'Analytics Module',
    version: '1.0.0',
    description: 'Web analytics tracking, batching, and flushing',
    dependencies: [],
    services: ['analytics'],
    contracts: [
        'ANALYTICS_PAGE_VIEW',
        'ANALYTICS_EVENT',
        'ANALYTICS_BATCH_FLUSH',
        'ANALYTICS_FLUSH_ERROR'
    ],
    contributes: {
        commands: [],
        navigation: [],
        panels: [],
        adapters: [],
        views: []
    }
};

export const services = {
    analytics: AnalyticsService
};

export const contracts = AnalyticsContracts;
