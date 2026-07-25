import { formatMarkdown } from './formatters/MarkdownFormatter.js';
import { formatJson } from './formatters/JsonFormatter.js';
import { formatAscii } from './formatters/AsciiFormatter.js';

const DEFAULT_FORMAT = 'markdown';
const DEFAULT_MAX_BYTES = 50_000;
const GENERIC_FORMATTERS = {
    markdown: formatMarkdown,
    json: formatJson,
    ascii: formatAscii
};

const HISTORY_REQUIRED_EVENT = 'HISTORY_OP_RECORDED';

/**
 * Resolve a contribution's `fn` to a callable serializer.
 *
 * `fn` may be:
 *   - a function → return as-is
 *   - a string   → resolve by looking it up on `moduleExports` (the loaded
 *                 module's namespace) or `serviceManager` (registered service)
 *                 Returns null if no resolver is available, so the caller can
 *                 fall back to a generic formatter.
 */
function resolveFn(fn, entry, context) {
    if (typeof fn === 'function') {
        return fn;
    }
    if (typeof fn !== 'string') {
        return null;
    }
    const moduleName = entry.moduleId;
    // Try module exports if the agent-context module loader stored them.
    const exports = context.moduleExports?.[moduleName];
    if (exports && typeof exports[fn] === 'function') {
        return exports[fn];
    }
    // Try serviceManager lookup by service id, then method on service.
    if (context.serviceManager) {
        // Service id convention: module id (e.g. 'mindmap') exposes methods.
        const service = context.serviceManager.get?.(moduleName);
        if (service && typeof service[fn] === 'function') {
            return service[fn].bind(service);
        }
    }
    return null;
}

/**
 * AgentContextService
 *
 * Generic in-browser service for exposing CSMA module state to an AI agent
 * with format negotiation. Domain serializers are contributed by feature
 * modules via `contributes.contextSerializers` and routed through the
 * SerializerRegistry (a runtime registry created in bootstrap).
 *
 * When no domain serializer is registered for `{ store, format }`, a
 * generic best-effort formatter is used.
 *
 * v1 ships in-browser API only — no MCP transport.
 */
export class AgentContextService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this._serializerRegistry = null;
        this._storage = null;
        this._history = null;
        this._serviceManager = null;
        this._moduleExports = null;
        this._subscriptions = new Map();
        this._subscriptionCounter = 0;
        this._historyBound = false;
        this._initDone = false;
    }

    /**
     * Explicit wiring. Optional — fields may also be lazy-resolved via
     * serviceManager lookups at call time.
     */
    init({
        serializerRegistry = null,
        storage = null,
        history = null,
        serviceManager = null,
        moduleExports = null
    } = {}) {
        if (serializerRegistry) this._serializerRegistry = serializerRegistry;
        if (storage) this._storage = storage;
        if (history !== undefined) this._history = history;
        if (serviceManager) this._serviceManager = serviceManager;
        if (moduleExports) this._moduleExports = moduleExports;
        this._initDone = true;
    }

    /**
     * Resolve the serializer registry. Lazy lookup against serviceManager
     * so the service works whether init() was called explicitly or not.
     */
    _resolveRegistry() {
        if (this._serializerRegistry) {
            return this._serializerRegistry;
        }
        if (this._serviceManager) {
            const reg = this._serviceManager.get?.('serializerRegistry');
            if (reg) {
                this._serializerRegistry = reg;
                return reg;
            }
        }
        return null;
    }

    _resolveStorage() {
        if (this._storage) return this._storage;
        if (this._serviceManager) {
            const s = this._serviceManager.get?.('storage') || this._serviceManager.get?.('Storage');
            if (s) {
                this._storage = s;
                return s;
            }
        }
        return null;
    }

    _resolveHistory() {
        if (this._history !== null) return this._history;
        if (this._serviceManager) {
            const h = this._serviceManager.get?.('history') || this._serviceManager.get?.('HistoryService');
            if (h) {
                this._history = h;
                return h;
            }
        }
        // Negative cache: avoid re-querying serviceManager if it didn't have one.
        this._history = null;
        return null;
    }

    // ─── Discovery ──────────────────────────────────────────────────

    /**
     * All store names with at least one registered serializer, sorted.
     */
    stores() {
        const registry = this._resolveRegistry();
        return registry ? registry.stores() : [];
    }

    /**
     * Formats available for a given store. Always includes the three
     * built-in fallback formats (`markdown`, `json`, `ascii`).
     */
    formats(store) {
        if (typeof store !== 'string' || store.trim() === '') {
            return [];
        }
        const registry = this._resolveRegistry();
        const entries = registry ? registry.listByStore(store) : [];

        const result = [];
        const seen = new Set();
        for (const entry of entries) {
            if (seen.has(entry.format)) continue;
            seen.add(entry.format);
            result.push({
                store: entry.store,
                format: entry.format,
                label: entry.label,
                default: entry.default === true,
                builtin: false,
                moduleId: entry.moduleId
            });
        }
        // Always include built-in fallback formats.
        for (const f of ['markdown', 'json', 'ascii']) {
            if (!seen.has(f)) {
                result.push({
                    store,
                    format: f,
                    label: `${store} (${f}, generic)`,
                    default: f === DEFAULT_FORMAT && result.length === 0,
                    builtin: true,
                    moduleId: 'agent-context'
                });
            }
        }
        return result;
    }

    /**
     * Full listing of all registered serializers (no fallbacks), optionally
     * filtered by store.
     */
    serializers(store) {
        const registry = this._resolveRegistry();
        if (!registry) return [];
        const entries = store ? registry.listByStore(store) : registry.list();
        return entries.map((e) => ({
            moduleId: e.moduleId,
            store: e.store,
            format: e.format,
            label: e.label,
            default: e.default === true,
            registeredAt: e.registeredAt
        }));
    }

    // ─── Explicit registration (tests, non-manifest users) ─────────

    /**
     * Register a serializer directly. Bypasses the manifest contribution
     * system. Mostly useful for tests and ad-hoc wiring.
     */
    register({ store, format, fn, label, default: isDefault, moduleId = 'adhoc' } = {}) {
        const registry = this._resolveRegistry();
        if (!registry) {
            throw new Error('[AgentContext] no serializer registry available; pass one via init() or register it as a core service');
        }
        const entry = registry.register(moduleId, {
            store,
            format,
            fn,
            label,
            default: isDefault
        });
        this._publish('AGENT_CONTEXT_REGISTERED', {
            moduleId: entry.moduleId,
            store: entry.store,
            format: entry.format,
            label: entry.label,
            isDefault: entry.default === true
        });
        // Invalidate cursors on this store+format (lean default for open question #2).
        this._publish('AGENT_CONTEXT_INVALIDATED', {
            store: entry.store,
            format: entry.format,
            reason: 'serializer-registered',
            details: { moduleId: entry.moduleId }
        });
        return entry;
    }

    /**
     * Remove all serializers contributed by a module. Called automatically
     * by ModuleManager on unload (via the registry's unregisterAll), but
     * exposed here for explicit cleanup.
     */
    unregister(moduleId) {
        const registry = this._resolveRegistry();
        if (!registry) return 0;
        const count = registry.unregisterAll(moduleId);
        if (count > 0) {
            this._publish('AGENT_CONTEXT_UNREGISTERED', { moduleId, count });
        }
        return count;
    }

    // ─── Primary read ──────────────────────────────────────────────

    /**
     * Serialize a store's state for an agent.
     *
     * Resolves the registered serializer for `{ store, format }`, fetches
     * data (from explicit `data` arg, or storage if available), invokes the
     * serializer, truncates if over `maxLength`, and publishes
     * AGENT_CONTEXT_QUERIED.
     */
    async get({
        store,
        format = DEFAULT_FORMAT,
        id = null,
        data = undefined,
        filter = null,
        depth = null,
        cursor = null,
        maxLength = DEFAULT_MAX_BYTES
    } = {}) {
        if (typeof store !== 'string' || store.trim() === '') {
            throw new Error('[AgentContext] get() requires a non-empty `store`');
        }
        const normalizedFormat = String(format || DEFAULT_FORMAT).toLowerCase();

        // 1. Resolve data: explicit > storage lookup > null
        let resolvedData = data;
        if (resolvedData === undefined) {
            const storage = this._resolveStorage();
            if (storage && typeof storage.get === 'function') {
                try {
                    resolvedData = id !== null
                        ? await storage.get(store, id)
                        : (typeof storage.getAll === 'function' ? await storage.getAll(store) : null);
                } catch {
                    resolvedData = null;
                }
            } else {
                resolvedData = null;
            }
        }

        // 2. Resolve serializer
        const registry = this._resolveRegistry();
        const entry = registry ? registry.find(store, normalizedFormat) : null;
        const context = {
            serviceManager: this._serviceManager,
            moduleExports: this._moduleExports
        };
        const serializerFn = entry ? resolveFn(entry.fn, entry, context) : null;

        const options = {
            store,
            id,
            filter,
            depth,
            cursor,
            format: normalizedFormat
        };

        let text;
        let nextCursor = null;
        if (serializerFn) {
            const out = serializerFn(resolvedData, options);
            if (out && typeof out === 'object' && typeof out.text === 'string') {
                text = out.text;
                nextCursor = out.cursor || null;
            } else if (typeof out === 'string') {
                text = out;
            } else {
                throw new Error(`[AgentContext] serializer for ${store}/${normalizedFormat} returned ${typeof out}, expected string or {text, cursor?}`);
            }
        } else {
            const fallback = GENERIC_FORMATTERS[normalizedFormat];
            if (!fallback) {
                throw new Error(
                    `[AgentContext] no serializer registered for ${store}/${normalizedFormat}, and "${normalizedFormat}" is not a built-in format. Available built-ins: ${Object.keys(GENERIC_FORMATTERS).join(', ')}`
                );
            }
            text = fallback(resolvedData, options);
        }

        // 3. Truncate
        const bytes = BufferLike.byteLength(text);
        let truncated = false;
        if (bytes > maxLength) {
            // Truncate at maxLength bytes, on a character boundary.
            const cut = charSafeSlice(text, maxLength);
            text = cut.text;
            truncated = true;
            nextCursor = nextCursor || `bytes:${bytes}`;
        }

        this._publish('AGENT_CONTEXT_QUERIED', {
            store,
            format: normalizedFormat,
            id: id || undefined,
            bytes,
            truncated,
            cursor: nextCursor || undefined
        });

        const response = {
            text,
            format: normalizedFormat,
            bytes
        };
        if (truncated) response.truncated = true;
        if (nextCursor) response.cursor = nextCursor;
        return response;
    }

    // ─── Subscription (requires history module) ────────────────────

    /**
     * Subscribe to changes on a `{ store, format }` pair. Requires the
     * history module to be loaded — otherwise throws a clear error.
     *
     * Returns an unsubscribe function.
     */
    subscribe({ store, format = DEFAULT_FORMAT, filter = null }, callback) {
        if (typeof callback !== 'function') {
            throw new Error('[AgentContext] subscribe() requires a callback function');
        }
        if (typeof store !== 'string' || store.trim() === '') {
            throw new Error('[AgentContext] subscribe() requires a non-empty `store`');
        }

        const history = this._resolveHistory();
        if (!history) {
            throw new Error('[AgentContext] subscription requires history module');
        }

        // Lazy-bind the history listener on first subscribe.
        this._bindHistoryOnce();

        const id = ++this._subscriptionCounter;
        const normalizedFormat = String(format || DEFAULT_FORMAT).toLowerCase();
        this._subscriptions.set(id, { store, format: normalizedFormat, filter, callback });

        return () => {
            this._subscriptions.delete(id);
        };
    }

    _bindHistoryOnce() {
        if (this._historyBound || !this.eventBus) return;
        if (typeof this.eventBus.subscribe !== 'function') return;
        this.eventBus.subscribe(HISTORY_REQUIRED_EVENT, (payload) => {
            this._onHistoryOp(payload);
        });
        this._historyBound = true;
    }

    _onHistoryOp(payload) {
        if (!payload || this._subscriptions.size === 0) return;
        // Canonical history payload is { entry }. Store routing lives inside
        // entry.meta.store (modules that want agent-context routing pass
        // `meta: { store: 'X' }` to history.record). Falls back to entry.intent.
        const entry = payload.entry;
        if (!entry) return;
        const touchedStore = entry.meta?.store || entry.intent || null;
        for (const sub of this._subscriptions.values()) {
            if (sub.store !== '*' && sub.store !== touchedStore) continue;
            // Re-serialize and deliver. Best-effort — failures are swallowed.
            this.get({ store: sub.store, format: sub.format, filter: sub.filter })
                .then((response) => {
                    try {
                        sub.callback(response, { store: sub.store, format: sub.format });
                    } catch {
                        /* listener error — ignore */
                    }
                })
                .catch(() => {
                    /* serialization error — ignore */
                });
        }
    }

    // ─── Internal helpers ──────────────────────────────────────────

    _publish(eventName, payload) {
        if (!this.eventBus) return;
        if (typeof this.eventBus.publish === 'function') {
            this.eventBus.publish(eventName, payload);
        } else if (typeof this.eventBus.publishSync === 'function') {
            this.eventBus.publishSync(eventName, payload);
        }
    }

    /**
     * Test/diagnostic hook: invalidate all subscriptions (used when a
     * serializer is replaced at runtime).
     */
    _invalidateAll(reason = 'manual') {
        if (this._subscriptions.size === 0) return;
        const stores = new Set();
        for (const sub of this._subscriptions.values()) {
            stores.add(sub.store);
        }
        for (const store of stores) {
            for (const format of ['markdown', 'json', 'ascii']) {
                this._publish('AGENT_CONTEXT_INVALIDATED', {
                    store,
                    format,
                    reason
                });
            }
        }
    }
}

// ── helpers (kept module-local) ─────────────────────────────────────

const BufferLike = {
    byteLength(s) {
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(s).length;
        }
        // Node fallback
        return Buffer.byteLength(s, 'utf8');
    }
};

function charSafeSlice(text, maxBytes) {
    if (typeof TextEncoder !== 'undefined') {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf8', { fatal: false });
        const bytes = encoder.encode(text);
        if (bytes.length <= maxBytes) return { text, bytes: bytes.length };
        const slice = bytes.subarray(0, maxBytes);
        return { text: decoder.decode(slice, { stream: false }), bytes: maxBytes };
    }
    // Naive fallback: slice by string length.
    return { text: text.slice(0, maxBytes), bytes: BufferLike.byteLength(text.slice(0, maxBytes)) };
}
