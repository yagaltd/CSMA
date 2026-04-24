import { ShareService, createShareService } from './services/ShareService.js';
import { ShareContracts } from './contracts/share-contracts.js';

export const manifest = {
    id: 'share',
    name: 'Share Module',
    version: '1.0.0',
    description: 'Browser share and clipboard fallback service',
    dependencies: [],
    services: ['share'],
    bundleSize: '+3KB',
    contracts: [
        'INTENT_SHARE_REQUEST',
        'SHARE_COMPLETED',
        'SHARE_FAILED'
    ]
};

export const services = {
    share: ShareService
};

export const contracts = ShareContracts;

export { createShareService };
