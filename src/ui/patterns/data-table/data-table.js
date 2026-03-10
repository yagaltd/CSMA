const tableId = 'demo-table';
const endpoint = '/api/products';

const fallbackData = Array.from({ length: 50 }).map((_, idx) => ({
    id: `item-${idx + 1}`,
    name: `Component ${idx + 1}`,
    maintainer: idx % 2 ? 'Mobile' : 'Web',
    bundle: `${(Math.random() * 6 + 1).toFixed(1)}kb`
}));

let state = {
    page: 1,
    pageSize: 8,
    total: fallbackData.length,
    rows: fallbackData.slice(0, 8),
    sort: null,
    filters: {}
};

let dataTableCleanup = null;

function getRuntime() {
    return window.csma || {};
}

function getDataTableService() {
    return getRuntime().dataTable;
}

function getEventBus() {
    return getRuntime().eventBus;
}

export function initDataTablePattern() {
    dataTableCleanup?.();

    const tbody = document.querySelector('[data-table-body]');
    const statusEl = document.querySelector('[data-table-status]');
    const paginationEl = document.querySelector('[data-table-pagination]');
    const filterInput = document.querySelector('[data-table-filter]');
    const cleanups = [];

    const setStatus = (message) => {
        if (statusEl) {
            statusEl.textContent = message;
        }
    };

    const render = () => {
        if (!tbody || !paginationEl) {
            return;
        }

        tbody.innerHTML = '';
        state.rows.forEach((row) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.id}</td>
                <td>${row.name}</td>
                <td>${row.maintainer}</td>
                <td>${row.bundle}</td>
            `;
            tbody.appendChild(tr);
        });
        setStatus(`Showing ${state.rows.length} of ${state.total} records`);
        paginationEl.textContent = `Page ${state.page}`;
    };

    const load = () => {
        setStatus('Loading rows...');
        const dataTableService = getDataTableService();
        const eventBus = getEventBus();

        if (dataTableService?.load) {
            dataTableService.load({ tableId, endpoint, page: state.page, pageSize: state.pageSize, filters: state.filters, sort: state.sort });
            return;
        }
        if (eventBus?.publish) {
            eventBus.publish('INTENT_DATA_TABLE_LOAD', {
                tableId,
                endpoint,
                page: state.page,
                pageSize: state.pageSize,
                filters: state.filters,
                sort: state.sort,
                timestamp: Date.now()
            });
            return;
        }

        const start = (state.page - 1) * state.pageSize;
        const filtered = fallbackData.filter((row) =>
            !state.filters.query || row.name.toLowerCase().includes(state.filters.query.toLowerCase())
        );
        const sorted = state.sort ? [...filtered].sort((a, b) => {
            const dir = state.sort.direction === 'asc' ? 1 : -1;
            return a[state.sort.field].localeCompare(b[state.sort.field]) * dir;
        }) : filtered;
        state.total = sorted.length;
        state.rows = sorted.slice(start, start + state.pageSize);
        render();
    };

    const applySort = (field) => {
        const direction = state.sort?.field === field && state.sort.direction === 'asc' ? 'desc' : 'asc';
        state.sort = { field, direction };
        const dataTableService = getDataTableService();
        const eventBus = getEventBus();

        if (dataTableService?.sort) {
            dataTableService.sort({ tableId, field, direction });
        } else if (eventBus?.publish) {
            eventBus.publish('INTENT_DATA_TABLE_SORT', { tableId, field, direction, timestamp: Date.now() });
        } else {
            load();
        }
    };

    const applyFilter = () => {
        state.filters = { query: filterInput?.value.trim() || '' };
        state.page = 1;
        const dataTableService = getDataTableService();
        const eventBus = getEventBus();

        if (dataTableService?.filter) {
            dataTableService.filter({ tableId, filters: state.filters });
        } else if (eventBus?.publish) {
            eventBus.publish('INTENT_DATA_TABLE_FILTER', { tableId, filters: state.filters, timestamp: Date.now() });
        } else {
            load();
        }
    };

    const changePage = (page) => {
        const maxPage = Math.max(1, Math.ceil(state.total / state.pageSize));
        state.page = Math.min(Math.max(1, page), maxPage);
        load();
    };

    document.querySelectorAll('[data-sort-field]').forEach((btn) => {
        const handleClick = () => applySort(btn.dataset.sortField);
        btn.addEventListener('click', handleClick);
        cleanups.push(() => btn.removeEventListener('click', handleClick));
    });

    const applyFilterButton = document.querySelector('[data-table-apply-filter]');
    if (applyFilterButton) {
        const handleClick = () => applyFilter();
        applyFilterButton.addEventListener('click', handleClick);
        cleanups.push(() => applyFilterButton.removeEventListener('click', handleClick));
    }

    const prevButton = document.querySelector('[data-page-prev]');
    if (prevButton) {
        const handleClick = () => changePage(state.page - 1);
        prevButton.addEventListener('click', handleClick);
        cleanups.push(() => prevButton.removeEventListener('click', handleClick));
    }

    const nextButton = document.querySelector('[data-page-next]');
    if (nextButton) {
        const handleClick = () => changePage(state.page + 1);
        nextButton.addEventListener('click', handleClick);
        cleanups.push(() => nextButton.removeEventListener('click', handleClick));
    }

    const eventBus = getEventBus();
    if (eventBus?.subscribe) {
        cleanups.push(eventBus.subscribe('DATA_TABLE_UPDATED', (payload) => {
            if (payload.tableId !== tableId) return;
            state = {
                ...state,
                rows: payload.rows,
                page: payload.page,
                pageSize: payload.pageSize,
                total: payload.total ?? payload.rows.length,
                sort: payload.sort || state.sort,
                filters: payload.filters || state.filters
            };
            render();
        }));
    }

    load();

    dataTableCleanup = () => {
        cleanups.splice(0).reverse().forEach((cleanup) => cleanup?.());
        dataTableCleanup = null;
    };

    return dataTableCleanup;
}

if (typeof window !== 'undefined') {
    dataTableCleanup = initDataTablePattern();
}
