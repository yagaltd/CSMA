import { ContributionRegistry, sortByOrderThenLabel } from './ContributionRegistry.js';

function ensureString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`[PanelRegistry] ${label} must be a non-empty string`);
    }

    return value.trim();
}

export class PanelRegistry extends ContributionRegistry {
    constructor({ eventBus } = {}) {
        super('panels', { eventBus });
    }

    validate(contribution) {
        if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
            throw new Error('[PanelRegistry] Contribution must be an object');
        }

        const id = ensureString(contribution.id, 'id');
        const title = ensureString(contribution.title, 'title');
        const mount = ensureString(contribution.mount, 'mount');

        if (contribution.placement !== undefined && typeof contribution.placement !== 'string') {
            throw new Error(`[PanelRegistry] placement must be a string for panel "${id}"`);
        }

        if (contribution.order !== undefined && typeof contribution.order !== 'number') {
            throw new Error(`[PanelRegistry] order must be a number for panel "${id}"`);
        }

        return {
            id,
            title,
            mount,
            ...(contribution.placement ? { placement: contribution.placement } : {}),
            ...(typeof contribution.order === 'number' ? { order: contribution.order } : {})
        };
    }

    list() {
        return sortByOrderThenLabel(super.list(), 'title');
    }
}
