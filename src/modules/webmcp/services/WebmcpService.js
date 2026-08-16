/**
 * WebmcpService — adapter between the CSMA intent registry and the browser's
 * WebMCP API (W3C Web Machine Learning CG draft; Chrome early preview).
 *
 * Catalog-only module: not wired into any demo. The draft-stage browser API
 * is feature-detected, never assumed:
 *
 *   - `init({ api })` — inject an explicit registration surface for hosts
 *     that know their browser shape ({ registerTool(tool) }).
 *   - Default detection walks known global entry points and picks the first
 *     that exposes registerTool; if none do, the service is an inert no-op.
 *
 * Translation only, zero behavior of its own:
 *   tool.name        ← contract key (INTENT_*)
 *   tool.description ← contract description
 *   tool.schema      ← contract schema (converted to a plain JSON-Schema-ish
 *                      descriptor via the validation lib's describe())
 *   tool handler     ← eventBus.publish(contractKey, input)
 *
 * Security invariants inherited, not reimplemented:
 *   - Only intents explicitly passed to exposeTools() (or allowlisted) are
 *     registered — never the whole registry by default.
 *   - Every agent invocation goes through eventBus.publish → contract
 *     validation → rate limits. The adapter cannot bypass them.
 *   - Companions/SSMA remain the authorization authority behind every
 *     handler (see docs/backend_for_modules.md).
 */

const KNOWN_ENTRY_POINTS = [
    () => globalThis.navigator?.modelContext,
    () => globalThis.modelContext,
    () => globalThis.navigator?.ai?.modelContext
];

function detectApi() {
    for (const probe of KNOWN_ENTRY_POINTS) {
        try {
            const api = probe();
            if (api && typeof api.registerTool === 'function') {
                return api;
            }
        } catch {
            // probe must never throw
        }
    }
    return null;
}

function describeSchema(schema) {
    // Superstruct-style structs expose `.type` and (for objects) a `.schema`
    // field map of Structs. Convert to a plain JSON-Schema-ish descriptor so
    // browser agents see parameter names/types; never leak struct internals.
    if (schema && typeof schema === 'object') {
        if (schema.type === 'object' && schema.schema && typeof schema.schema === 'object') {
            const properties = {};
            for (const [key, field] of Object.entries(schema.schema)) {
                properties[key] = field && typeof field.type === 'string'
                    ? { type: field.type }
                    : {};
            }
            return { type: 'object', properties };
        }
        if (typeof schema.type === 'string') {
            return { type: schema.type };
        }
        if (typeof schema.describe === 'function') {
            try {
                const described = schema.describe();
                if (described && typeof described === 'object') {
                    return JSON.parse(JSON.stringify(described));
                }
            } catch {
                // fall through to generic descriptor
            }
        }
    }
    return { type: 'object' };
}

export class WebmcpService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.api = null;
        this.contracts = null;
        this.registeredTools = new Map();
        this.subscriptions = [];
        this.initialized = false;
    }

    init(options = {}) {
        if (this.initialized) return this;
        this.initialized = true;

        this.api = options.api === undefined ? detectApi() : options.api;
        this.contracts = options.contracts || null;

        this.subscriptions.push(
            this.eventBus?.subscribe?.('INTENT_WEBMCP_EXPOSE_TOOLS', (payload) => {
                this.exposeTools(payload?.filter || null, payload?.reason || 'intent');
            })
        );

        return this;
    }

    /**
     * Register selected intents as browser-agent tools.
     *
     * @param {string|null} filter — intent-name substring filter (null = all
     *   of the provided intent list)
     * @param {string} reason — observability label
     * @param {Object} override — { intents: { KEY: contract } } explicit
     *   intent map for this call (defaults to the injected registry)
     * @returns {{ registered: string[], skipped: 'no-api'|'no-intents', surface: string }}
     */
    exposeTools(filter = null, reason = 'manual', override = null) {
        const intents = override?.intents || this.contracts || {};
        const names = Object.keys(intents).filter((key) => (
            key.startsWith('INTENT_') && (!filter || key.includes(filter.toUpperCase()))
        ));

        if (!this.api) {
            return { registered: [], skipped: 'no-api', surface: 'none' };
        }
        if (!names.length) {
            return { registered: [], skipped: 'no-intents', surface: 'none' };
        }

        const registered = [];
        for (const name of names) {
            const contract = intents[name];
            const tool = {
                name,
                description: contract?.description || name,
                schema: describeSchema(contract?.schema)
            };
            try {
                this.api.registerTool(tool, (input) => this.eventBus?.publish?.(name, input));
                this.registeredTools.set(name, tool);
                registered.push(name);
            } catch {
                // a failing single registration must not break the rest
            }
        }

        if (registered.length) {
            this.eventBus?.publish?.('WEBMCP_TOOLS_REGISTERED', {
                count: String(registered.length),
                surface: String(reason)
            });
        }

        return { registered, skipped: null, surface: 'browser' };
    }

    listRegisteredTools() {
        return [...this.registeredTools.keys()].sort();
    }

    destroy() {
        for (const unsub of this.subscriptions) {
            try { unsub(); } catch { /* best-effort */ }
        }
        this.subscriptions = [];
        this.registeredTools.clear();
        this.api = null;
        this.initialized = false;
    }
}
