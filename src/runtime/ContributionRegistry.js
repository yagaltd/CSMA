function ensureNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`[ContributionRegistry] ${label} must be a non-empty string`);
    }

    return value.trim();
}

export class ContributionRegistry {
    constructor(name, { eventBus } = {}) {
        this.name = ensureNonEmptyString(name, 'Registry name');
        this.eventBus = eventBus || null;
        this.entries = new Map();
        this.moduleEntries = new Map();
    }

    validate(contribution) {
        return contribution;
    }

    normalize(contribution, moduleId) {
        const validated = this.validate({ ...contribution });
        const id = ensureNonEmptyString(validated.id, `${this.name} contribution id`);

        return {
            ...validated,
            id,
            moduleId,
            registeredAt: Date.now()
        };
    }

    register(moduleId, contribution) {
        const ownerId = ensureNonEmptyString(moduleId, `${this.name} module id`);
        const normalized = this.normalize(contribution, ownerId);
        const existing = this.entries.get(normalized.id);

        if (existing) {
            throw new Error(
                `[${this.name}] Contribution "${normalized.id}" is already owned by module "${existing.moduleId}"`
            );
        }

        this.entries.set(normalized.id, normalized);

        if (!this.moduleEntries.has(ownerId)) {
            this.moduleEntries.set(ownerId, new Set());
        }

        this.moduleEntries.get(ownerId).add(normalized.id);
        this.publish('MODULE_CONTRIBUTION_REGISTERED', ownerId, normalized.id);
        this.onRegistered(normalized);
        return normalized;
    }

    onRegistered() {}

    unregister(moduleId, contributionId) {
        const ownerId = ensureNonEmptyString(moduleId, `${this.name} module id`);
        const id = ensureNonEmptyString(contributionId, `${this.name} contribution id`);
        const entry = this.entries.get(id);

        if (!entry) {
            return false;
        }

        if (entry.moduleId !== ownerId) {
            throw new Error(
                `[${this.name}] Module "${ownerId}" cannot remove contribution "${id}" owned by "${entry.moduleId}"`
            );
        }

        this.entries.delete(id);
        const moduleIds = this.moduleEntries.get(ownerId);
        moduleIds?.delete(id);
        if (moduleIds && moduleIds.size === 0) {
            this.moduleEntries.delete(ownerId);
        }

        this.onUnregistered(entry);
        this.publish('MODULE_CONTRIBUTION_UNREGISTERED', ownerId, id);
        return true;
    }

    onUnregistered() {}

    unregisterAll(moduleId) {
        const ownerId = ensureNonEmptyString(moduleId, `${this.name} module id`);
        const contributionIds = Array.from(this.moduleEntries.get(ownerId) || []);

        contributionIds.forEach((contributionId) => {
            this.unregister(ownerId, contributionId);
        });

        return contributionIds.length;
    }

    get(id) {
        if (typeof id !== 'string' || id.trim() === '') {
            return null;
        }

        return this.entries.get(id) || null;
    }

    list() {
        return Array.from(this.entries.values());
    }

    listByModule(moduleId) {
        const ownerId = ensureNonEmptyString(moduleId, `${this.name} module id`);
        const contributionIds = Array.from(this.moduleEntries.get(ownerId) || []);
        return contributionIds.map((id) => this.entries.get(id)).filter(Boolean);
    }

    destroy() {
        this.entries.clear();
        this.moduleEntries.clear();
    }

    publish(eventName, moduleId, contributionId) {
        if (!this.eventBus?.publishSync) {
            return;
        }

        this.eventBus.publishSync(eventName, {
            registry: this.name,
            moduleId,
            contributionId,
            timestamp: Date.now()
        });
    }
}

export function sortByOrderThenLabel(entries, labelKey = 'label') {
    return entries.sort((left, right) => {
        const leftOrder = typeof left.order === 'number' ? left.order : Number.MAX_SAFE_INTEGER;
        const rightOrder = typeof right.order === 'number' ? right.order : Number.MAX_SAFE_INTEGER;

        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        const leftLabel = String(left[labelKey] || left.id).toLowerCase();
        const rightLabel = String(right[labelKey] || right.id).toLowerCase();
        return leftLabel.localeCompare(rightLabel);
    });
}
