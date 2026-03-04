import { getHydrator } from './hydrators/index.js';
import { rateLimiter } from '../../../runtime/RateLimiter.js';
import { TelemetryCollector } from './Telemetry.js';

export const STATIC_RENDER_EVENTS = {
    HYDRATION: 'ISLAND_HYDRATION_INITIATED',
    DATA_REQUEST: 'ISLAND_DATA_REQUESTED',
    DATA_RETURNED: 'ISLAND_DATA_RETURNED',
    HYDRATION_FAILED: 'ISLAND_HYDRATION_FAILED'
};

const DEFAULT_RATE_LIMIT = { requests: 5, window: 3000 };

export class IslandRuntime {
    constructor(eventBus, { fetchImpl = fetch, rateLimit = DEFAULT_RATE_LIMIT, disabledRoutes = [], modulesPath = null } = {}) {
        if (!eventBus) {
            throw new Error('[IslandRuntime] eventBus is required');
        }
        window.csma = window.csma || { config: { staticRender: {} } };
        this.eventBus = eventBus;
        const resolvedFetch = fetchImpl || fetch;
        this.fetch = resolvedFetch.bind(globalThis);
        this.registry = new Map();
        this.hydratedIslands = new Set();
        this.subscriptions = [];
        this.hydrationCounter = 0;
        this.initialized = false;
        this.bundleCache = new Map();
        this.rateLimit = rateLimit || DEFAULT_RATE_LIMIT;
        const configDisabled = window.csma?.config?.staticRender?.disabledRoutes || [];
        this.disabledRoutes = new Set([...(disabledRoutes || []), ...configDisabled]);
        this.modulesPath = modulesPath || window.csma?.config?.staticRender?.modulesPath || null;
        const budgets = window.csma?.config?.staticRender?.performanceBudgets || {};
        this.telemetry = new TelemetryCollector({
            budgets,
            onUpdate: (snapshot) => {
                window.csma.metrics = snapshot;
            }
        });
        window.csma.telemetry = this.telemetry;
    }

    async init() {
        if (this.initialized) return;
        if (window.csma?.config?.staticRender?.enabled === false) {
            console.warn('[IslandRuntime] static render disabled via feature flag');
            return;
        }
        const response = await this.fetch('/_islands/registry.json', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`[IslandRuntime] failed to load registry (${response.status})`);
        }
        const manifest = await response.json();
        Object.values(manifest.routes || {}).forEach((route) => {
            (route.islands || []).forEach((island) => {
                this.registry.set(island.id, island);
            });
        });
        this.#scanAndSchedule();
        this.#bindInvalidations();
        this.#bindDataEvents();
        this.initialized = true;
    }

    #scanAndSchedule() {
        const elements = document.querySelectorAll('[data-island]');
        const currentRoute = window.location.pathname?.replace(/\/$/, '') || '/';
        const routeDisabled = this.disabledRoutes.has(currentRoute);
        elements.forEach((element) => {
            const islandId = element.dataset.island;
            if (!islandId) {
                return;
            }
            if (routeDisabled || element.dataset.disabled === 'true') {
                return;
            }
            const parameters = this.#extractParameters(element);
            const key = this.#hydrationKey(islandId, parameters);
            if (this.hydratedIslands.has(key)) {
                return;
            }
            const meta = this.registry.get(islandId) || {};
            const trigger = element.dataset.trigger || meta.trigger || 'visible';
            this.#scheduleHydration({ element, islandId, trigger });
        });
    }

    #scheduleHydration({ element, islandId, trigger }) {
        const hydrate = () => this.#hydrateIsland(element, islandId, trigger);
        const hydrator = getHydrator(trigger);
        hydrator(element, hydrate);
    }

    #hydrateIsland(element, islandId, triggerOverride) {
        const parameters = this.#extractParameters(element);
        const key = this.#hydrationKey(islandId, parameters);
        if (this.hydratedIslands.has(key)) {
            return;
        }
        if (!this.#respectRateLimit(element, islandId)) {
            this.eventBus.publish(STATIC_RENDER_EVENTS.HYDRATION_FAILED, {
                islandId,
                reason: 'rate-limit'
            });
            const failureKey = this.#hydrationKey(islandId, parameters);
            this.telemetry.recordHydrationFailure(failureKey, 'rate-limit');
            return;
        }
        this.hydratedIslands.add(key);
        element.setAttribute('data-hydrated', 'true');
        this.hydrationCounter += 1;
        const hydratedAt = Date.now();
        element.dataset.hydratedAt = `${hydratedAt}-${this.hydrationCounter}`;
        this.telemetry.recordHydrationStart(key);
        const payload = {
            islandId,
            route: window.location.pathname,
            trigger: triggerOverride || element.dataset.trigger || 'visible',
            parameters,
            timestamp: hydratedAt
        };
        this.eventBus.publish(STATIC_RENDER_EVENTS.HYDRATION, payload);
        this.eventBus.publish(STATIC_RENDER_EVENTS.DATA_REQUEST, {
            islandId,
            dataContract: element.dataset.contract,
            parameters: payload.parameters,
            timestamp: hydratedAt
        });
        this.#invokeIslandModule(islandId, { element, parameters, trigger: payload.trigger }).catch(() => {});
    }

    #extractParameters(element) {
        const dataset = { ...element.dataset };
        delete dataset.island;
        delete dataset.contract;
        delete dataset.trigger;
        delete dataset.hydratedAt;
        delete dataset.hydrated;
        return dataset;
    }

    #hydrationKey(islandId, parameters = {}) {
        const parts = Object.keys(parameters)
            .sort()
            .map((key) => `${key}:${parameters[key]}`);
        return `${islandId}::${parts.join('|')}`;
    }

    #bindInvalidations() {
        if (!this.eventBus?.subscribe) {
            return;
        }
        const dispose = this.eventBus.subscribe('ISLAND_INVALIDATED', (payload) => {
            this.#handleInvalidation(payload);
        });
        this.subscriptions.push(dispose);
    }

    #bindDataEvents() {
        if (!this.eventBus?.subscribe) {
            return;
        }
        this.subscriptions.push(
            this.eventBus.subscribe(STATIC_RENDER_EVENTS.DATA_RETURNED, (payload) => this.#handleDataReturned(payload))
        );
        this.subscriptions.push(
            this.eventBus.subscribe(STATIC_RENDER_EVENTS.HYDRATION_FAILED, (payload) => {
                if (!payload?.islandId) {
                    return;
                }
                const key = this.#hydrationKey(payload.islandId, payload.parameters || {});
                this.telemetry.recordHydrationFailure(key, payload.reason || 'unknown');
            })
        );
    }

    #handleInvalidation(payload) {
        if (!payload?.islandId) {
            return;
        }
        const { islandId } = payload;
        const parameters = payload.parameters || {};
        const elements = document.querySelectorAll(`[data-island="${islandId}"]`);
        elements.forEach((element) => {
            if (!this.#matchesParameters(element, parameters)) {
                return;
            }
            const elementParams = this.#extractParameters(element);
            const key = this.#hydrationKey(islandId, elementParams);
            if (!this.hydratedIslands.has(key)) {
                return;
            }
            this.hydratedIslands.delete(key);
            element.setAttribute('data-hydrated', 'stale');
            this.#hydrateIsland(element, islandId, 'manual');
        });
    }

    #matchesParameters(element, expected = {}) {
        const entries = Object.entries(expected || {});
        if (!entries.length) {
            return true;
        }
        const dataset = this.#extractParameters(element);
        return entries.every(([key, value]) => {
            const expectedValue = value == null ? '' : String(value);
            return dataset[key] === expectedValue;
        });
    }

    #handleDataReturned(payload) {
        if (!payload?.islandId) {
            return;
        }
        const nodes = document.querySelectorAll(`[data-island="${payload.islandId}"]`);
        nodes.forEach((node) => {
            if (!this.#matchesParameters(node, payload.parameters || {})) {
                return;
            }
            const key = this.#hydrationKey(payload.islandId, payload.parameters || {});
            this.telemetry.recordDataReturned(key);
            node.dataset.lastUpdated = String(payload.timestamp || Date.now());
            node.setAttribute('data-hydrated', 'true');
        });
    }

    #respectRateLimit(element, islandId) {
        const limitAttr = element.dataset.rateLimit;
        let limits = this.rateLimit;
        if (limitAttr) {
            const [requestsRaw, windowRaw] = limitAttr.split('/');
            const requests = Number(requestsRaw);
            const windowMs = Number(windowRaw);
            if (Number.isFinite(requests) && Number.isFinite(windowMs)) {
                limits = { requests, window: windowMs };
            }
        }
        return rateLimiter.checkRateLimit(`island:${islandId}`, limits);
    }

    async #invokeIslandModule(islandId, context) {
        const globalModule = window.csma?.islandBundles?.[islandId];
        if (globalModule && typeof globalModule.hydrate === 'function') {
            await globalModule.hydrate(context);
            return;
        }
        const module = await this.#loadIslandModule(islandId);
        if (module?.hydrate) {
            await module.hydrate(context);
        }
    }

    async #loadIslandModule(islandId) {
        if (!this.modulesPath) {
            return null;
        }
        const modulePath = `${this.modulesPath}/${islandId}.js`;
        if (this.bundleCache.has(modulePath)) {
            return this.bundleCache.get(modulePath);
        }
        try {
            const module = await import(/* @vite-ignore */ modulePath);
            this.bundleCache.set(modulePath, module);
            return module;
        } catch (error) {
            console.warn('[IslandRuntime] Failed to load island module', modulePath, error.message);
            this.bundleCache.set(modulePath, null);
            return null;
        }
    }
}

export default IslandRuntime;
