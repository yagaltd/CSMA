const STORAGE_KEY = 'csma.feature-flags.v1';

export class FeatureFlagsService {
    constructor(eventBus) { this.eventBus = eventBus; this.flags = {}; this.storage = null; this.endpoint = null; this.fetcher = null; this.subscriptions = []; this.initialized = false; }
    init(options = {}) {
        if (this.initialized) return;
        this.initialized = true; this.storage = options.storage || globalThis.localStorage || null; this.endpoint = options.endpoint || null; this.fetcher = options.fetcher || globalThis.fetch?.bind(globalThis);
        this.flags = { ...(options.defaults || {}), ...this.readStored(), ...(options.flags || {}) };
        this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_FEATURE_FLAGS_REFRESH', () => this.refresh()));
        this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_FEATURE_FLAG_SET', (payload) => this.setFlag(payload.key, payload.enabled, { persist: payload.data?.persist !== false })));
        this.publishReady();
    }
    destroy() { this.initialized = false; this.subscriptions.splice(0).forEach((u) => u?.()); }
    isEnabled(key, context = {}) { const value = this.flags[key]; return typeof value === 'function' ? Boolean(value(context)) : Boolean(value); }
    getFlags() { return { ...this.flags }; }
    setFlag(key, enabled, options = {}) { if (!key) return false; this.flags[key] = Boolean(enabled); if (options.persist) this.writeStored(); this.eventBus?.publish?.('FEATURE_FLAG_CHANGED', { key, enabled: Boolean(enabled), timestamp: Date.now() }); return true; }
    async refresh() { if (this.endpoint && this.fetcher) { try { const response = await this.fetcher(this.endpoint, { credentials: 'same-origin' }); if (!response.ok) throw new Error(`Feature flags failed with ${response.status}`); const data = await response.json(); this.flags = { ...this.flags, ...(data.flags || data) }; this.writeStored(); } catch (error) { this.publishError(error); } } this.publishReady(); return this.getFlags(); }
    readStored() { try { return this.storage ? JSON.parse(this.storage.getItem(STORAGE_KEY) || '{}') : {}; } catch { return {}; } }
    writeStored() { try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.flags)); } catch (error) { this.publishError(error); } }
    publishReady() { this.eventBus?.publish?.('FEATURE_FLAGS_READY', { data: this.getFlags(), timestamp: Date.now() }); }
    publishError(error) { this.eventBus?.publish?.('FEATURE_FLAGS_ERROR', { error: error?.message || String(error), timestamp: Date.now() }); }
}
