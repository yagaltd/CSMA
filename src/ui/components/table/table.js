/**
 * CSMA Table Component
 * Data table UI with sorting and selection using EventBus
 * Works with TableService for data management
 * 
 * Contracts: INTENT_TABLE_SORT, INTENT_TABLE_SELECT, TABLE_SELECTION_CHANGED
 */

/**
 * Initialize Table UI with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initTableUI(eventBus) {
    if (!eventBus) {
        console.warn('[Table] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const tables = document.querySelectorAll('.table-wrapper');

    tables.forEach(tableWrapper => {
        const cleanup = initTable(tableWrapper, eventBus);
        cleanups.push(cleanup);
    });

    return () => {
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single table
 */
function initTable(wrapper, eventBus) {
    const table = wrapper.querySelector('.table');
    if (!table) return () => {};

    // Assign ID if not present
    if (!wrapper.id) {
        wrapper.id = `table-${Math.random().toString(36).substr(2, 9)}`;
    }

    const eventHandlers = [];
    const tableId = wrapper.id;
    let selectedRows = new Set();

    // Sortable headers
    const sortableHeaders = table.querySelectorAll('th[data-sortable="true"]');
    sortableHeaders.forEach(header => {
        const handleClick = () => {
            const column = header.dataset.column;
            const currentSort = header.dataset.sorted;
            
            // Toggle sort direction
            let newSort = 'asc';
            if (currentSort === 'asc') newSort = 'desc';
            else if (currentSort === 'desc') newSort = null;

            // Clear other sorts
            sortableHeaders.forEach(h => {
                delete h.dataset.sorted;
            });

            // Set new sort
            if (newSort) {
                header.dataset.sorted = newSort;
            }

            eventBus.publish('INTENT_TABLE_SORT', {
                tableId,
                column,
                direction: newSort,
                timestamp: Date.now()
            });
        };
        header.addEventListener('click', handleClick);
        eventHandlers.push({ element: header, event: 'click', handler: handleClick });
    });

    // Row selection
    const selectAllCheckbox = table.querySelector('th[data-selectable="true"] .table-checkbox');
    const rowCheckboxes = table.querySelectorAll('td[data-selectable="true"] .table-checkbox');

    // Select all handler
    if (selectAllCheckbox) {
        const handleSelectAll = () => {
            const isChecked = selectAllCheckbox.checked;
            
            rowCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
                const row = checkbox.closest('tr');
                if (row) {
                    row.dataset.selected = isChecked ? 'true' : 'false';
                    const rowId = row.dataset.id;
                    if (rowId) {
                        if (isChecked) {
                            selectedRows.add(rowId);
                        } else {
                            selectedRows.delete(rowId);
                        }
                    }
                }
            });

            eventBus.publish('TABLE_SELECTION_CHANGED', {
                tableId,
                selectedRows: Array.from(selectedRows),
                selectAll: isChecked,
                timestamp: Date.now()
            });
        };
        selectAllCheckbox.addEventListener('change', handleSelectAll);
        eventHandlers.push({ element: selectAllCheckbox, event: 'change', handler: handleSelectAll });
    }

    // Individual row selection
    rowCheckboxes.forEach(checkbox => {
        const handleChange = () => {
            const isChecked = checkbox.checked;
            const row = checkbox.closest('tr');
            
            if (row) {
                row.dataset.selected = isChecked ? 'true' : 'false';
                const rowId = row.dataset.id;
                if (rowId) {
                    if (isChecked) {
                        selectedRows.add(rowId);
                    } else {
                        selectedRows.delete(rowId);
                    }
                }
            }

            // Update select all checkbox
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = rowCheckboxes.length === 
                    table.querySelectorAll('td[data-selectable="true"] .table-checkbox:checked').length;
                selectAllCheckbox.indeterminate = 
                    table.querySelectorAll('td[data-selectable="true"] .table-checkbox:checked').length > 0 &&
                    selectAllCheckbox.checked === false;
            }

            eventBus.publish('TABLE_SELECTION_CHANGED', {
                tableId,
                selectedRows: Array.from(selectedRows),
                rowId: row?.dataset.id,
                selected: isChecked,
                timestamp: Date.now()
            });
        };
        checkbox.addEventListener('change', handleChange);
        eventHandlers.push({ element: checkbox, event: 'change', handler: handleChange });
    });

    // Row click for selection
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const handleRowClick = (e) => {
            // Ignore if clicking on checkbox or action button
            if (e.target.closest('.table-checkbox') || e.target.closest('.table-action-btn')) {
                return;
            }

            const rowId = row.dataset.id;
            eventBus.publish('TABLE_ROW_CLICKED', {
                tableId,
                rowId,
                data: getRowData(row),
                timestamp: Date.now()
            });
        };
        row.addEventListener('click', handleRowClick);
        eventHandlers.push({ element: row, event: 'click', handler: handleRowClick });
    });

    // Action buttons
    const actionButtons = table.querySelectorAll('.table-action-btn');
    actionButtons.forEach(btn => {
        const handleClick = () => {
            const action = btn.dataset.action;
            const row = btn.closest('tr');
            const rowId = row?.dataset.id;

            eventBus.publish('TABLE_ACTION_TRIGGERED', {
                tableId,
                action,
                rowId,
                data: row ? getRowData(row) : null,
                timestamp: Date.now()
            });
        };
        btn.addEventListener('click', handleClick);
        eventHandlers.push({ element: btn, event: 'click', handler: handleClick });
    });

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Get row data as object
 */
function getRowData(row) {
    const cells = row.querySelectorAll('td:not([data-selectable])');
    const data = {};
    
    cells.forEach((cell, index) => {
        const key = cell.dataset.column || `col_${index}`;
        data[key] = cell.textContent.trim();
    });

    return data;
}

/**
 * Update table with new data (helper function)
 */
export function updateTableData(wrapperId, data, eventBus) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const table = wrapper.querySelector('.table');
    const tbody = table?.querySelector('tbody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    // Render new rows
    data.forEach(rowData => {
        const row = document.createElement('tr');
        if (rowData.id) row.dataset.id = rowData.id;

        Object.entries(rowData).forEach(([key, value]) => {
            if (key === 'id') return;
            const cell = document.createElement('td');
            cell.textContent = value;
            cell.dataset.column = key;
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });

    // Re-initialize table
    initTable(wrapper, eventBus);
}
