import { WebmcpService } from './services/WebmcpService.js';
import { WebmcpContracts } from './contracts/webmcp-contracts.js';

export const manifest = {
    id: 'webmcp',
    name: 'Webmcp Module',
    version: '1.0.0',
    description: 'Webmcp state, contracts, and service for CSMA',
    dependencies: [],
    services: ['webmcp'],
    contracts: Object.keys(WebmcpContracts)
};

export const services = {
    'webmcp': WebmcpService
};

export { WebmcpService, WebmcpContracts };

export const contracts = WebmcpContracts;
