import { ContributionRegistry } from './ContributionRegistry.js';

function ensureString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`[AdapterRegistry] ${label} must be a non-empty string`);
    }

    return value.trim();
}

export class AdapterRegistry extends ContributionRegistry {
    constructor({ eventBus, serviceManager } = {}) {
        super('adapters', { eventBus });
        this.serviceManager = serviceManager || null;
    }

    validate(contribution) {
        if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
            throw new Error('[AdapterRegistry] Contribution must be an object');
        }

        const id = ensureString(contribution.id, 'id');
        const type = ensureString(contribution.type, 'type');
        const serviceName = ensureString(contribution.serviceName, 'serviceName');

        if (contribution.capabilities !== undefined) {
            if (!Array.isArray(contribution.capabilities) || contribution.capabilities.some((capability) => typeof capability !== 'string')) {
                throw new Error(`[AdapterRegistry] capabilities must be an array of strings for adapter "${id}"`);
            }
        }

        return {
            id,
            type,
            serviceName,
            ...(contribution.capabilities ? { capabilities: [...contribution.capabilities] } : {})
        };
    }

    listByType(type) {
        return this.list().filter((adapter) => adapter.type === type);
    }

    resolve(type, adapterId = null) {
        const adapter = adapterId
            ? this.get(adapterId)
            : this.listByType(type)[0] || null;

        if (!adapter) {
            return null;
        }

        return this.serviceManager?.get(adapter.serviceName) || null;
    }
}
