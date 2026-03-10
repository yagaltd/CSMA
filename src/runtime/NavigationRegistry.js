import { ContributionRegistry, sortByOrderThenLabel } from './ContributionRegistry.js';

function ensureString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`[NavigationRegistry] ${label} must be a non-empty string`);
    }

    return value.trim();
}

export class NavigationRegistry extends ContributionRegistry {
    constructor({ eventBus } = {}) {
        super('navigation', { eventBus });
    }

    validate(contribution) {
        if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
            throw new Error('[NavigationRegistry] Contribution must be an object');
        }

        const id = ensureString(contribution.id, 'id');
        const label = ensureString(contribution.label, 'label');
        const href = ensureString(contribution.href, 'href');

        if (contribution.group !== undefined && typeof contribution.group !== 'string') {
            throw new Error(`[NavigationRegistry] group must be a string for entry "${id}"`);
        }

        if (contribution.order !== undefined && typeof contribution.order !== 'number') {
            throw new Error(`[NavigationRegistry] order must be a number for entry "${id}"`);
        }

        return {
            id,
            label,
            href,
            ...(contribution.group ? { group: contribution.group } : {}),
            ...(typeof contribution.order === 'number' ? { order: contribution.order } : {})
        };
    }

    list() {
        return sortByOrderThenLabel(super.list(), 'label');
    }
}
