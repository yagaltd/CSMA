export class ChartsService {
    constructor(eventBus) { this.eventBus = eventBus; this.adapters = new Map(); this.datasets = new Map(); this.endpoint = null; this.fetcher = null; this.subscriptions = []; this.initialized = false; }
    init(options = {}) { if (this.initialized) return; this.initialized = true; this.endpoint = options.endpoint || null; this.fetcher = options.fetcher || globalThis.fetch?.bind(globalThis); for (const adapter of options.adapters || []) this.registerAdapter(adapter); for (const dataset of options.datasets || []) this.setData(dataset.id, dataset); this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_CHART_REGISTER_ADAPTER', (p) => this.registerAdapter(p.data))); this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_CHART_SET_DATA', (p) => this.setData(p.id || p.key, p.data || {}))); this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_CHART_CLEAR', () => this.clear())); }
    destroy() { this.initialized = false; this.subscriptions.splice(0).forEach((u) => u?.()); }
    async query(query = {}) { if (!this.endpoint || !this.fetcher) return null; const response = await this.fetcher(this.endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) }); if (!response.ok) throw new Error(`Metrics query failed with ${response.status}`); const data = await response.json(); if (data.id || query.id) this.setData(data.id || query.id, data); return data; }
    registerAdapter(adapter = {}) { if (!adapter.id) return false; this.adapters.set(String(adapter.id), { id: String(adapter.id), label: adapter.label || adapter.id, render: adapter.render }); this.eventBus?.publish?.('CHART_ADAPTER_READY', { id: String(adapter.id), data: { label: adapter.label || adapter.id }, timestamp: Date.now() }); return true; }
    setData(id, dataset = {}) { if (!id) return false; const normalized = { id: String(id), type: dataset.type || 'series', points: Array.isArray(dataset.points) ? dataset.points : [], summary: dataset.summary || {}, status: dataset.status || 'ready' }; this.datasets.set(String(id), normalized); this.eventBus?.publish?.('CHARTS_UPDATED', { id: String(id), data: normalized, timestamp: Date.now() }); return true; }
    getData(id) { return this.datasets.get(String(id)) || null; }
    formatNumber(value, options = {}) { return new Intl.NumberFormat(options.locale || 'en', options).format(Number(value || 0)); }
    clear() { this.datasets.clear(); this.eventBus?.publish?.('CHARTS_UPDATED', { data: { datasets: [] }, timestamp: Date.now() }); }

    /**
     * Render a dataset into a target element using a registered adapter.
     *
     * @param {HTMLElement} target - Element to render into.
     * @param {Object} data - Dataset payload (id/type/points/summary).
     * @param {Object} [options] - Render options; `options.adapterId` selects
     *   the adapter, otherwise the first registered adapter is used.
     * @returns {HTMLElement|null} The rendered node, or null if no adapter.
     */
    render(target, data = {}, options = {}) {
        const adapterId = options.adapterId || data?.adapterId || this.adapters.keys().next().value;
        const adapter = this.adapters.get(adapterId);
        if (!adapter || typeof adapter.render !== 'function') {
            return null;
        }
        if (data?.id) this.setData(data.id, data);
        return adapter.render(target, data, options);
    }

    /**
     * Mount an aiui surface into a container element.
     *
     * Runtime contract for module aiui surfaces:
     *   mountSurface(surfaceId, container, props) → cleanupFn
     *
     * Supported surfaces:
     *   - 'chart-display' — renders `props.data` (a dataset payload) using the
     *     adapter named by `props.adapterId` (falls back to the first
     *     registered adapter). `props.options` forward render options.
     *
     * Returns a cleanup function that empties the container.
     */
    mountSurface(surfaceId, container, props = {}) {
        if (surfaceId !== 'chart-display') {
            throw new Error(`ChartsService.mountSurface: unknown surface "${surfaceId}"`);
        }
        const data = props.data || null;
        const options = { ...(props.options || {}) };
        if (props.adapterId) options.adapterId = props.adapterId;

        const renderChart = () => {
            const doc = container.ownerDocument || globalThis.document;
            container.replaceChildren();
            const stage = doc.createElement('canvas');
            stage.className = 'chart-display__stage';
            container.append(stage);
            const rendered = this.render(stage, data, options);
            // Adapters may return their own node; prefer it when provided.
            if (rendered && rendered !== stage) {
                stage.replaceWith(rendered);
            }
        };

        renderChart();
        const off = this.eventBus?.subscribe?.('CHARTS_UPDATED', renderChart);

        return () => {
            if (typeof off === 'function') off();
            container.replaceChildren();
        };
    }
}
