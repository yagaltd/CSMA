import { ContributionRegistry } from './ContributionRegistry.js';

/**
 * SerializerRegistry
 *
 * Stores per-module "context serializer" contributions used by the
 * agent-context module. Each entry routes a `{ store, format }` pair to
 * a serializer function that converts raw records into a string suitable
 * for an AI agent (markdown / json / ascii / custom).
 *
 * Extends ContributionRegistry. The contribution `id` is derived from
 * `${moduleId}:${store}:${format}` so modules do not need to declare an
 * explicit id in their manifest.
 *
 * Entries declared in a module manifest look like:
 *   {
 *     store: 'maps',
 *     format: 'markdown',
 *     fn: serializeMapToMarkdown,        // function OR string export name
 *     label: 'Mindmap (markdown)',
 *     default: true
 *   }
 */

const ALLOWED_FORMATS = new Set(['markdown', 'json', 'ascii']);

function ensureNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`[SerializerRegistry] ${label} must be a non-empty string`);
    }
    return value.trim();
}

function ensureFn(value, label) {
    if (typeof value === 'function') {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        // Defer resolution: caller (AgentContextService) resolves string
        // names to functions by looking them up on the contributing module.
        return value.trim();
    }
    throw new Error(`[SerializerRegistry] ${label} must be a function or a non-empty export name string`);
}

export class SerializerRegistry extends ContributionRegistry {
    constructor(options = {}) {
        super('serializer', { eventBus: options.eventBus });
    }

    /**
     * Validate a raw contribution. Required: store, format, fn.
     * Optional: label, default, depth, description.
     */
    validate(contribution) {
        if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
            throw new Error('[SerializerRegistry] contribution must be an object');
        }

        const store = ensureNonEmptyString(contribution.store, 'store');
        const rawFormat = ensureNonEmptyString(contribution.format, 'format');
        const format = rawFormat.toLowerCase();
        const fn = ensureFn(contribution.fn, 'fn');

        if (!ALLOWED_FORMATS.has(format) && !format.startsWith('x-')) {
            throw new Error(
                `[SerializerRegistry] format "${format}" must be one of: ${Array.from(ALLOWED_FORMATS).join(', ')}, or a custom name prefixed with "x-"`
            );
        }

        return {
            ...contribution,
            store,
            format,
            fn,
            label: typeof contribution.label === 'string' ? contribution.label : `${store} (${format})`,
            default: contribution.default === true,
            description: typeof contribution.description === 'string' ? contribution.description : undefined
        };
    }

    /**
     * Override normalize to inject a stable id derived from store+format.
     * ContributionRegistry.normalize would otherwise require `validated.id`.
     */
    normalize(contribution, moduleId) {
        const validated = this.validate(contribution);
        const id = `${moduleId}:${validated.store}:${validated.format}`;

        return {
            ...validated,
            id,
            moduleId,
            registeredAt: Date.now()
        };
    }

    /**
     * Find an entry by `{ store, format }`. Returns the entry or null.
     */
    find(store, format) {
        if (typeof store !== 'string' || typeof format !== 'string') {
            return null;
        }
        const normalizedFormat = format.toLowerCase();
        return this.list().find(
            (entry) => entry.store === store && entry.format === normalizedFormat
        ) || null;
    }

    /**
     * List entries for a given store, regardless of format.
     */
    listByStore(store) {
        if (typeof store !== 'string') {
            return [];
        }
        return this.list().filter((entry) => entry.store === store);
    }

    /**
     * All distinct store names known to the registry.
     */
    stores() {
        const set = new Set();
        for (const entry of this.list()) {
            set.add(entry.store);
        }
        return Array.from(set).sort();
    }
}
