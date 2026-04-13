const DEFAULT_OPTIONS = {
    pageSize: 25
};

export class DataTableService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.api = options.api || null;
        this.fetcher = options.fetcher || null;
        this.tables = new Map();
        this.subscriptions = [];
    }

    init({ apiService, fetcher } = {}) {
        if (apiService) {
            this.api = apiService;
        }
        if (fetcher) {
            this.fetcher = fetcher;
        }

        if (this.eventBus) {
            this.subscriptions.push(
                this.eventBus.subscribe('INTENT_DATA_TABLE_LOAD', (payload) => this.load(payload)),
                this.eventBus.subscribe('INTENT_DATA_TABLE_SORT', (payload) => this.sort(payload)),
                this.eventBus.subscribe('INTENT_DATA_TABLE_FILTER', (payload) => this.filter(payload))
            );
        }
    }

    async load({ tableId, endpoint, page = 1, pageSize, filters, sort } = {}) {
        if (!tableId) {
            throw new Error('tableId is required');
        }
        const table = this.tables.get(tableId) || {
            endpoint: null,
            rows: [],
            filters: {},
            sort: null,
            page: 1,
            pageSize: this.options.pageSize,
            total: 0
        };

        if (!table.endpoint && !endpoint) {
            throw new Error(`Table ${tableId} has no endpoint defined`);
        }

        table.endpoint = endpoint || table.endpoint;
        table.page = page;
        table.pageSize = pageSize || table.pageSize || this.options.pageSize;
        table.filters = filters ?? table.filters;
        table.sort = sort ?? table.sort;
        this.tables.set(tableId, table);

        const fetcher = this.#getFetcher();
        if (!fetcher) {
            throw new Error('No fetcher available for data table');
        }

        try {
            const response = await fetcher(table.endpoint, {
                page: table.page,
                pageSize: table.pageSize,
                filters: table.filters,
                sort: table.sort
            });
            const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : response?.items || [];
            const total = response?.total ?? rows.length;

            table.rows = rows;
            table.total = total;
            this.tables.set(tableId, table);

            this.#publish('DATA_TABLE_UPDATED', {
                tableId,
                rows,
                page: table.page,
                pageSize: table.pageSize,
                total,
                sort: table.sort || undefined,
                filters: Object.keys(table.filters || {}).length > 0 ? table.filters : undefined,
                timestamp: Date.now()
            });
        } catch (error) {
            this.#publish('DATA_TABLE_ERROR', {
                tableId,
                error: error?.message || String(error),
                timestamp: Date.now()
            });
        }
    }

    async sort({ tableId, field, direction }) {
        const table = this.tables.get(tableId);
        if (!table) {
            throw new Error(`Table ${tableId} not initialized`);
        }
        table.sort = { field, direction };
        return this.load({ tableId, sort: table.sort });
    }

    async filter({ tableId, filters }) {
        const table = this.tables.get(tableId);
        if (!table) {
            throw new Error(`Table ${tableId} not initialized`);
        }
        table.filters = filters || {};
        return this.load({ tableId, filters: table.filters, page: 1 });
    }

    getState(tableId) {
        const table = this.tables.get(tableId);
        if (!table) {
            return null;
        }
        return {
            ...table,
            rows: Array.isArray(table.rows) ? [...table.rows] : []
        };
    }

    destroy() {
        this.tables.clear();
        this.subscriptions.forEach((unsubscribe) => unsubscribe && unsubscribe());
        this.subscriptions = [];
    }

    #getFetcher() {
        if (typeof this.fetcher === 'function') {
            return this.fetcher;
        }
        if (this.api?.get) {
            return async (endpoint, params) => this.api.get(endpoint, { params });
        }
        return null;
    }

    #publish(eventName, payload) {
        this.eventBus?.publish(eventName, payload);
    }
}
