import { CmsContentService } from './services/CmsContentService.js';
import { CmsContentContracts } from './contracts/cms-content-contracts.js';

export const manifest = {
    id: 'cms-content',
    name: 'CMS Content',
    version: '1.0.0',
    description: 'Structured page, post, and block loading for static and API-backed content',
    dependencies: [],
    services: ['cmsContent'],
    contracts: Object.keys(CmsContentContracts),
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export const services = { cmsContent: CmsContentService };
export const contracts = CmsContentContracts;
export { CmsContentService };
