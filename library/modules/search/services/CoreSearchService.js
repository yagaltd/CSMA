import { BaseSearchService } from './BaseSearchService.js';

export class CoreSearchService extends BaseSearchService {
    constructor(eventBus, options = {}) {
        super(eventBus, {
            tier: 'core',
            variant: options.variant || 'light',
            ...options
        });
    }
}
