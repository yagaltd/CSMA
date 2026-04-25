import { starterSchemas } from '../schema/starter.js';

function getBuilderType(builder) {
    return builder?.schemaType || builder?.name || null;
}

export class MetaManagerModuleService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.metaManager = null;
        this.i18nService = null;
        this.schemaBuilders = new Map();
        this.activeEntries = new Set();
        this.bindings = new Set();
        this.owner = 'meta-manager';
    }

    init(options = {}) {
        this.metaManager = options.metaManager
            || globalThis.window?.csma?.metaManager
            || globalThis.window?.csma?.serviceManager?.get?.('metaManager')
            || null;
        this.i18nService = options.i18nService
            || globalThis.window?.csma?.i18n
            || globalThis.window?.csma?.serviceManager?.get?.('I18n')
            || this.i18nService
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
        const locale = typeof payload.locale === 'string' ? payload.locale.trim() : '';
        const currentUrl = globalThis.window?.location?.href || '';
        const alternateMeta = this.buildAlternateLocaleMeta(payload.alternates, locale);
        const entry = {
            title: payload.title,
            htmlAttrs: locale ? { lang: locale } : {},
            meta: [
                { name: 'description', content: payload.description, key: 'description' },
                { property: 'og:title', content: payload.title, key: 'og:title' },
                { property: 'og:description', content: payload.description, key: 'og:description' },
                { property: 'og:url', content: payload.canonical || currentUrl, key: 'og:url' },
                payload.image ? { property: 'og:image', content: payload.image, key: 'og:image' } : null,
                { name: 'twitter:card', content: payload.image ? 'summary_large_image' : 'summary', key: 'twitter:card' },
                { name: 'twitter:title', content: payload.title, key: 'twitter:title' },
                { name: 'twitter:description', content: payload.description, key: 'twitter:description' },
                payload.image ? { name: 'twitter:image', content: payload.image, key: 'twitter:image' } : null,
                locale ? { property: 'og:locale', content: locale, key: 'og:locale' } : null,
                ...alternateMeta,
                payload.robots ? { name: 'robots', content: payload.robots, key: 'robots' } : null
            ].filter(Boolean),
            link: [
                ...(payload.canonical ? [{ rel: 'canonical', href: payload.canonical, key: 'canonical' }] : []),
                ...this.buildAlternateLinks(payload.alternates)
            ],
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

    bindLocalizedPage(resolvePageMeta, options = {}) {
        this.ensureReady();
        if (typeof resolvePageMeta !== 'function') {
            throw new Error('[MetaManagerModule] bindLocalizedPage expects a resolver function');
        }

        let activeEntry = null;
        const apply = () => {
            const payload = resolvePageMeta({
                locale: this.getCurrentLocale(),
                i18n: this.i18nService
            }) || {};

            if (activeEntry) {
                activeEntry.dispose?.();
            }
            activeEntry = this.applySeoPage(payload, options);
            return activeEntry;
        };

        apply();

        const unsubscribe = this.eventBus?.subscribe?.('LANGUAGE_CHANGED', () => {
            apply();
        }) || (() => {});

        const binding = {
            dispose: () => {
                unsubscribe();
                activeEntry?.dispose?.();
                activeEntry = null;
                this.bindings.delete(binding);
            }
        };

        this.bindings.add(binding);
        return binding;
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
        this.bindings.forEach((binding) => binding.dispose?.());
        this.bindings.clear();
        this.activeEntries.forEach((entry) => entry.dispose?.());
        this.activeEntries.clear();
        this.metaManager = null;
        this.i18nService = null;
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
        if (!entry) {
            return entry;
        }

        const trackedEntry = {
            ...entry,
            dispose: () => {
                this.activeEntries.delete(trackedEntry);
                entry.dispose?.();
            }
        };
        this.activeEntries.add(trackedEntry);
        return trackedEntry;
    }

    getCurrentLocale() {
        return this.i18nService?.locale || null;
    }

    buildAlternateLinks(alternates = []) {
        if (!Array.isArray(alternates)) {
            return [];
        }

        return alternates
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry, index) => {
                const href = typeof entry.href === 'string' ? entry.href.trim() : '';
                const hreflang = typeof entry.locale === 'string' ? entry.locale.trim() : '';
                if (!href || !hreflang) {
                    return null;
                }

                return {
                    rel: 'alternate',
                    hreflang,
                    href,
                    key: `alternate:${hreflang}:${index}`
                };
            })
            .filter(Boolean);
    }

    buildAlternateLocaleMeta(alternates = [], locale = '') {
        if (!Array.isArray(alternates)) {
            return [];
        }

        return alternates
            .map((entry) => (typeof entry?.locale === 'string' ? entry.locale.trim() : ''))
            .filter((entry, index, values) => entry && entry !== locale && values.indexOf(entry) === index)
            .map((entry, index) => ({
                property: 'og:locale:alternate',
                content: entry,
                key: `og:locale:alternate:${entry}:${index}`
            }));
    }
}
