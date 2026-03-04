import { NetworkStatusService } from './services/NetworkStatusService.js';

export const manifest = {
    name: 'Network Status',
    version: '1.0.0',
    description: 'Online/offline detection with latency sampling',
    dependencies: [],
    bundleSize: '+2KB',
    contracts: [
        'INTENT_NETWORK_STATUS_REFRESH',
        'NETWORK_STATUS_CHANGED',
        'NETWORK_STATUS_ERROR'
    ]
};

export const services = {
    networkStatus: NetworkStatusService
};

export function createNetworkStatus(eventBus, options = {}) {
    const service = new NetworkStatusService(eventBus, options);
    service.init(options);
    return service;
}
