const csma = window.csma || {};
const dataTableService = csma.dataTable;
const eventBus = csma.eventBus;

const tableId = 'demo-table';
const endpoint = '/api/products';

const tbody = document.querySelector('[data-table-body]');
const statusEl = document.querySelector('[data-table-status]');
const paginationEl = document.querySelector('[data-table-pagination]');
const filterInput = document.querySelector('[data-table-filter]');

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

function init() {
    document.querySelectorAll('[data-sort-field]').forEach((btn) => {
        btn.addEventListener('click', () => applySort(btn.dataset.sortField));
    });

    document.querySelector('[data-table-apply-filter]').addEventListener('click', () => applyFilter());

    document.querySelector('[data-page-prev]').addEventListener('click', () => changePage(state.page - 1));
    document.querySelector('[data-page-next]').addEventListener('click', () => changePage(state.page + 1));

    if (eventBus?.subscribe) {
        eventBus.subscribe('DATA_TABLE_UPDATED', (payload) => {
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
        });
    }

    load();
}

function load() {
    setStatus('Loading rows...');
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
    // fallback
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
}

function applySort(field) {
    const direction = state.sort?.field === field && state.sort.direction === 'asc' ? 'desc' : 'asc';
    state.sort = { field, direction };
    if (dataTableService?.sort) {
        dataTableService.sort({ tableId, field, direction });
    } else if (eventBus?.publish) {
        eventBus.publish('INTENT_DATA_TABLE_SORT', { tableId, field, direction, timestamp: Date.now() });
    } else {
        load();
    }
}

function applyFilter() {
    state.filters = { query: filterInput.value.trim() };
    state.page = 1;
    if (dataTableService?.filter) {
        dataTableService.filter({ tableId, filters: state.filters });
    } else if (eventBus?.publish) {
        eventBus.publish('INTENT_DATA_TABLE_FILTER', { tableId, filters: state.filters, timestamp: Date.now() });
    } else {
        load();
    }
}

function changePage(page) {
    const maxPage = Math.max(1, Math.ceil(state.total / state.pageSize));
    state.page = Math.min(Math.max(1, page), maxPage);
    load();
}

function render() {
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
}

function setStatus(message) {
    statusEl.textContent = message;
}

init();
