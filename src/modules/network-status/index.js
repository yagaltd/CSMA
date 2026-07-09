import { NetworkStatusService } from './services/NetworkStatusService.js';
import { NetworkStatusContracts } from './contracts/network-status-contracts.js';

export const manifest = {
    id: 'network-status',
    name: 'Network Status',
    version: '1.0.0',
    description: 'Online/offline detection with latency sampling',
    dependencies: [],
    services: ['networkStatus'],
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

export const contracts = NetworkStatusContracts;
