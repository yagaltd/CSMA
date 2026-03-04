import { CoreSearchService } from './CoreSearchService.js';
import { EnhancedSearchService } from './EnhancedSearchService.js';
import { AISearchService } from './AISearchService.js';

const TIERS = {
    core: CoreSearchService,
    enhanced: EnhancedSearchService,
    ai: AISearchService
};

export function createSearchService(eventBus, options = {}) {
    const tier = options.tier ?? 'core';
    const ServiceClass = TIERS[tier];
    if (!ServiceClass) {
        throw new Error(`Unknown search tier: ${tier}`);
    }
    return new ServiceClass(eventBus, options);
}

export class SearchModuleService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { tier: 'core', ...options };
        this.service = null;
    }

    init(options = {}) {
        this.options = { ...this.options, ...options };
        this.service = createSearchService(this.eventBus, this.options);
        this.service.init?.(options);
        return this.service;
    }

    add(...args) {
        this.#ensureService();
        return this.service.add?.(...args);
    }

    addDocument(...args) {
        this.#ensureService();
        return this.service.addDocument?.(...args);
    }

    remove(...args) {
        this.#ensureService();
        return this.service.remove?.(...args);
    }

    search(...args) {
        this.#ensureService();
        return this.service.handleQuery?.(...args);
    }

    clear(...args) {
        this.#ensureService();
        return this.service.clear?.(...args);
    }

    getIndexInfo(...args) {
        this.#ensureService();
        return this.service.getIndexInfo?.(...args);
    }

    destroy() {
        this.service?.destroy?.();
        this.service = null;
    }

    #ensureService() {
        if (!this.service) {
            this.init(this.options);
        }
    }
}
