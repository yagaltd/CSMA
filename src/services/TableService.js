/**
 * CSMA Table Service
 * Manages table data, sorting, filtering, and pagination
 * 
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: service
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 */

/**
 * Table Service Class
 * Manages data table operations
 */
export class TableService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.tables = new Map();
        this.listeners = [];
        this.setupSubscriptions();
    }

    /**
     * Setup EventBus subscriptions
     */
    setupSubscriptions() {
        // Register table
        this.listeners.push(
            this.eventBus.subscribe('INTENT_TABLE_REGISTER', (payload) => {
                this.registerTable(payload);
            })
        );

        // Sort table
        this.listeners.push(
            this.eventBus.subscribe('INTENT_TABLE_SORT', (payload) => {
                this.sortTable(payload.tableId, payload.column, payload.direction);
            })
        );

        // Filter table
        this.listeners.push(
            this.eventBus.subscribe('INTENT_TABLE_FILTER', (payload) => {
                this.filterTable(payload.tableId, payload.filters);
            })
        );

        // Set page
        this.listeners.push(
            this.eventBus.subscribe('INTENT_TABLE_PAGE', (payload) => {
                this.setPage(payload.tableId, payload.page);
            })
        );

        // Set page size
        this.listeners.push(
            this.eventBus.subscribe('INTENT_TABLE_PAGE_SIZE', (payload) => {
                this.setPageSize(payload.tableId, payload.pageSize);
            })
        );

        // Update data
        this.listeners.push(
            this.eventBus.subscribe('INTENT_TABLE_SET_DATA', (payload) => {
                this.setTableData(payload.tableId, payload.data);
            })
        );
    }

    /**
     * Register a table
     * @param {Object} config - Table configuration
     */
    registerTable(config) {
        const { 
            tableId, 
            data = [], 
            columns = [], 
            pageSize = 10,
            sortable = true,
            filterable = true 
        } = config;

        this.tables.set(tableId, {
            data,
            originalData: [...data],
            columns,
            pageSize,
            currentPage: 1,
            totalItems: data.length,
            totalPages: Math.ceil(data.length / pageSize),
            sortColumn: null,
            sortDirection: null,
            filters: {},
            sortable,
            filterable
        });

        this.eventBus.publish('TABLE_REGISTERED', {
            tableId,
            timestamp: Date.now()
        });
    }

    /**
     * Set table data
     * @param {string} tableId - Table ID
     * @param {Array} data - New data
     */
    setTableData(tableId, data) {
        const table = this.tables.get(tableId);
        if (!table) return;

        table.data = [...data];
        table.originalData = [...data];
        table.totalItems = data.length;
        table.totalPages = Math.ceil(data.length / table.pageSize);
        table.currentPage = 1;

        // Re-apply filters and sort
        this.applyFiltersAndSort(tableId);

        this.eventBus.publish('TABLE_DATA_UPDATED', {
            tableId,
            data: table.data,
            pagination: this.getPagination(tableId),
            timestamp: Date.now()
        });
    }

    /**
     * Sort table by column
     * @param {string} tableId - Table ID
     * @param {string} column - Column to sort by
     * @param {string} direction - 'asc' or 'desc'
     */
    sortTable(tableId, column, direction) {
        const table = this.tables.get(tableId);
        if (!table || !table.sortable) return;

        table.sortColumn = column;
        table.sortDirection = direction;

        this.applyFiltersAndSort(tableId);

        this.eventBus.publish('TABLE_SORTED', {
            tableId,
            column,
            direction,
            data: this.getPaginatedData(tableId),
            timestamp: Date.now()
        });
    }

    /**
     * Filter table
     * @param {string} tableId - Table ID
     * @param {Object} filters - Filter criteria
     */
    filterTable(tableId, filters) {
        const table = this.tables.get(tableId);
        if (!table || !table.filterable) return;

        table.filters = filters;
        table.currentPage = 1;

        this.applyFiltersAndSort(tableId);

        this.eventBus.publish('TABLE_FILTERED', {
            tableId,
            filters,
            data: this.getPaginatedData(tableId),
            pagination: this.getPagination(tableId),
            timestamp: Date.now()
        });
    }

    /**
     * Set current page
     * @param {string} tableId - Table ID
     * @param {number} page - Page number
     */
    setPage(tableId, page) {
        const table = this.tables.get(tableId);
        if (!table) return;

        table.currentPage = Math.max(1, Math.min(page, table.totalPages));

        this.eventBus.publish('TABLE_PAGE_CHANGED', {
            tableId,
            page: table.currentPage,
            data: this.getPaginatedData(tableId),
            pagination: this.getPagination(tableId),
            timestamp: Date.now()
        });
    }

    /**
     * Set page size
     * @param {string} tableId - Table ID
     * @param {number} pageSize - Items per page
     */
    setPageSize(tableId, pageSize) {
        const table = this.tables.get(tableId);
        if (!table) return;

        table.pageSize = pageSize;
        table.totalPages = Math.ceil(table.data.length / pageSize);
        table.currentPage = 1;

        this.eventBus.publish('TABLE_PAGE_SIZE_CHANGED', {
            tableId,
            pageSize,
            data: this.getPaginatedData(tableId),
            pagination: this.getPagination(tableId),
            timestamp: Date.now()
        });
    }

    /**
     * Apply filters and sort to table data
     * @param {string} tableId - Table ID
     */
    applyFiltersAndSort(tableId) {
        const table = this.tables.get(tableId);
        if (!table) return;

        // Start with original data
        let data = [...table.originalData];

        // Apply filters
        Object.entries(table.filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                data = data.filter(item => {
                    const itemValue = String(item[key]).toLowerCase();
                    return itemValue.includes(String(value).toLowerCase());
                });
            }
        });

        // Apply sort
        if (table.sortColumn && table.sortDirection) {
            data.sort((a, b) => {
                const aVal = a[table.sortColumn];
                const bVal = b[table.sortColumn];

                let comparison = 0;
                if (aVal < bVal) comparison = -1;
                if (aVal > bVal) comparison = 1;

                return table.sortDirection === 'desc' ? -comparison : comparison;
            });
        }

        table.data = data;
        table.totalItems = data.length;
        table.totalPages = Math.ceil(data.length / table.pageSize);
    }

    /**
     * Get paginated data
     * @param {string} tableId - Table ID
     * @returns {Array} Paginated data
     */
    getPaginatedData(tableId) {
        const table = this.tables.get(tableId);
        if (!table) return [];

        const start = (table.currentPage - 1) * table.pageSize;
        const end = start + table.pageSize;

        return table.data.slice(start, end);
    }

    /**
     * Get pagination info
     * @param {string} tableId - Table ID
     * @returns {Object} Pagination info
     */
    getPagination(tableId) {
        const table = this.tables.get(tableId);
        if (!table) return null;

        return {
            currentPage: table.currentPage,
            pageSize: table.pageSize,
            totalItems: table.totalItems,
            totalPages: table.totalPages,
            hasNextPage: table.currentPage < table.totalPages,
            hasPrevPage: table.currentPage > 1
        };
    }

    /**
     * Get selected rows
     * @param {string} tableId - Table ID
     * @returns {Array} Selected row IDs
     */
    getSelectedRows(tableId) {
        const table = this.tables.get(tableId);
        return table?.selectedRows || [];
    }

    /**
     * Cleanup service
     */
    cleanup() {
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.tables.clear();
    }
}

/**
 * Create Table Service instance
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {TableService}
 */
export function createTableService(eventBus) {
    return new TableService(eventBus);
}
