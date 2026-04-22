import { starterSchemas } from '../schema/starter.js';

function getBuilderType(builder) {
    return builder?.schemaType || builder?.name || null;
}

export class MetaManagerModuleService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.metaManager = null;
        this.schemaBuilders = new Map();
        this.activeEntries = new Set();
        this.owner = 'meta-manager';
    }

    init(options = {}) {
        this.metaManager = options.metaManager
            || globalThis.window?.csma?.metaManager
            || globalThis.window?.csma?.serviceManager?.get?.('metaManager')
            || null;

        if (!this.metaManager) {
            throw new Error('[MetaManagerModule] MetaManager runtime service is required');
        }

        if (options.includeStarter !== false) {
            this.registerSchemaPack(starterSchemas);
        }

        (options.schemaPacks || []).forEach((pack) => this.registerSchemaPack(pack));
        (options.schemas || []).forEach((schema) => this.registerSchema(schema));
        return this;
    }

    registerSchema(builder) {
        const type = getBuilderType(builder);
        if (!type || typeof builder !== 'function') {
            throw new Error('[MetaManagerModule] registerSchema expects a builder function with schemaType');
        }

        this.schemaBuilders.set(type, builder);
        return builder;
    }

    registerSchemaPack(pack) {
        if (Array.isArray(pack)) {
            pack.forEach((builder) => this.registerSchema(builder));
            return pack;
        }

        if (pack && typeof pack === 'object') {
            Object.values(pack).forEach((builder) => this.registerSchema(builder));
            return pack;
        }

        throw new Error('[MetaManagerModule] registerSchemaPack expects an array or object');
    }

    applySeoPage(payload = {}, options = {}) {
        this.ensureReady();
        const entry = {
            title: payload.title,
            htmlAttrs: payload.locale ? { lang: payload.locale } : {},
            meta: [
                { name: 'description', content: payload.description, key: 'description' },
                payload.image ? { property: 'og:image', content: payload.image, key: 'og:image' } : null,
                payload.robots ? { name: 'robots', content: payload.robots, key: 'robots' } : null
            ].filter(Boolean),
            link: payload.canonical ? [{ rel: 'canonical', href: payload.canonical, key: 'canonical' }] : [],
            script: []
        };

        const schemaNode = this.buildSchemaGraph(payload.schema || [], payload.context || {});
        if (schemaNode) {
            entry.script.push({
                type: 'application/ld+json',
                json: schemaNode,
                key: options.schemaKey || 'schema.org'
            });
        }

        return this.trackEntry(this.metaManager.push(entry, {
            owner: options.owner || this.owner,
            key: options.key || 'seo-page',
            safe: true,
            priority: Number.isFinite(options.priority) ? options.priority : 10
        }));
    }

    setSchema(nodes = [], options = {}) {
        this.ensureReady();
        const graph = this.buildSchemaGraph(nodes, options.context || {});
        if (!graph) {
            return null;
        }

        return this.trackEntry(this.metaManager.push({
            script: [{
                type: 'application/ld+json',
                json: graph,
                key: options.key || 'schema.org'
            }]
        }, {
            owner: options.owner || this.owner,
            key: options.entryKey || 'schema',
            safe: true,
            priority: Number.isFinite(options.priority) ? options.priority : 20
        }));
    }

    buildSchemaGraph(specs = [], context = {}) {
        const nodes = (Array.isArray(specs) ? specs : [specs])
            .flatMap((spec) => this.resolveSchemaSpec(spec, context))
            .filter(Boolean);

        if (!nodes.length) {
            return null;
        }

        return nodes.length === 1 ? nodes[0] : nodes;
    }

    resolveSchemaSpec(spec, context = {}) {
        if (!spec) {
            return [];
        }

        if (typeof spec === 'function') {
            const built = spec({}, context);
            return built ? [built] : [];
        }

        const builder = spec.builder || this.schemaBuilders.get(spec.type);
        if (!builder) {
            throw new Error(`[MetaManagerModule] Unknown schema type: ${spec.type}`);
        }

        const built = builder(spec.input || {}, context);
        return built ? [built] : [];
    }

    destroy() {
        this.activeEntries.forEach((entry) => entry.dispose?.());
        this.activeEntries.clear();
        this.metaManager = null;
        this.schemaBuilders.clear();
    }

    cleanup() {
        this.destroy();
    }

    ensureReady() {
        if (!this.metaManager) {
            throw new Error('[MetaManagerModule] Service has not been initialized');
        }
    }

    trackEntry(entry) {
        if (entry) {
            this.activeEntries.add(entry);
        }
        return entry;
    }
}
