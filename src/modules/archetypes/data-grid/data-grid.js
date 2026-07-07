/**
 * Data Grid Archetype — CSMA Token-Driven Sortable Data Table
 *
 * Factory: createDataGrid(container, emit, options) → { update, destroy, getSelected, sort, resizeColumn }
 *
 * Features:
 * - Sortable columns (click header to toggle ASC/DESC/none)
 * - Resizable columns (drag handles on column edges)
 * - Row selection (single, multi with checkboxes)
 * - Virtual scrolling (render only visible rows)
 * - Loading / empty / error states via data-state attribute
 * - Keyboard navigation (Arrow keys, Enter, Space)
 * - ARIA grid roles and live-region announcements
 * - CSMA design tokens for all visual values
 *
 * States (via data-state on root):
 *   "loading"  — spinner overlay, body non-interactive
 *   "empty"    — "No data" message
 *   "error"    — error message with retry button
 *   (absent)   — normal data display
 */

const SORT_ICON_SVG = `<svg class="csma-datagrid__sort-icon" viewBox="0 0 12 12" fill="none" aria-hidden="true">
  <path d="M6 1L9 5H3L6 1Z" fill="currentColor"/>
  <path d="M6 11L3 7H9L6 11Z" fill="currentColor" opacity="0.4"/>
</svg>`;

const DEFAULT_COLUMN_WIDTH = 150;
const MIN_COLUMN_WIDTH = 48;
const ROW_HEIGHT = 40;
const OVERSCAN = 5;

export function createDataGrid(container, emit, options = {}) {
    const {
        columns = [],
        fetch = null,
        data: initialData = null,
        rowHeight = ROW_HEIGHT,
        selectable = false,
        multiSelect = false,
        resizable = false,
        onRowClick = null,
        onSelectionChange = null,
        emptyMessage = 'No data to display',
        loadingMessage = 'Loading data…',
        errorMessage = 'Failed to load data',
    } = options;

    // ─── State ─────────────────────────────────────────

    let rows = initialData || [];
    let sortColumn = null;
    let sortDirection = null; // 'asc' | 'desc' | null
    let selectedIds = new Set();
    let focusedRowIndex = -1;
    let columnWidths = {};
    let isLoading = !initialData && fetch !== null;
    let error = null;

    // ─── Column Width Init ─────────────────────────────

    columns.forEach((col) => {
        columnWidths[col.id] = col.width || DEFAULT_COLUMN_WIDTH;
    });

    // ─── DOM Construction ──────────────────────────────

    const root = document.createElement('div');
    root.className = 'csma-datagrid';
    root.setAttribute('role', 'grid');
    root.setAttribute('aria-label', 'Data grid');
    root.setAttribute('aria-rowcount', String(rows.length + 1)); // +1 for header
    if (isLoading) root.dataset.state = 'loading';

    // Header
    const header = document.createElement('div');
    header.className = 'csma-datagrid__header';
    header.setAttribute('role', 'row');

    columns.forEach((col) => {
        const cell = document.createElement('div');
        cell.className = 'csma-datagrid__header-cell';
        cell.setAttribute('role', 'columnheader');
        cell.style.width = columnWidths[col.id] + 'px';
        cell.style.flexShrink = '0';
        cell.dataset.columnId = col.id;

        if (col.sortable !== false) {
            cell.setAttribute('aria-sort', 'none');
            cell.setAttribute('tabindex', '0');
            cell.innerHTML = `${col.label || col.id} ${SORT_ICON_SVG}`;

            cell.addEventListener('click', () => handleSort(col.id));
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort(col.id);
                }
            });
        } else {
            cell.textContent = col.label || col.id;
        }

        // Resize handle
        if (resizable) {
            const handle = document.createElement('div');
            handle.className = 'csma-datagrid__resize-handle';

            let startX = 0;
            let startWidth = 0;
            let activeHandle = null;

            const onMouseDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                startX = e.clientX;
                startWidth = columnWidths[col.id];
                activeHandle = handle;
                activeHandle.dataset.active = 'true';
                root.classList.add('csma-datagrid--resizing');

                const onMouseMove = (ev) => {
                    if (!activeHandle) return;
                    const delta = ev.clientX - startX;
                    const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + delta);
                    columnWidths[col.id] = newWidth;
                    cell.style.width = newWidth + 'px';
                    // Re-render visible rows to match new widths
                    renderVisibleRows();
                };

                const onMouseUp = () => {
                    if (activeHandle) {
                        activeHandle.dataset.active = 'false';
                        activeHandle = null;
                    }
                    root.classList.remove('csma-datagrid--resizing');
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };

            handle.addEventListener('mousedown', onMouseDown);
            cell.appendChild(handle);
        }

        header.appendChild(cell);
    });

    // Body
    const body = document.createElement('div');
    body.className = 'csma-datagrid__body';
    body.setAttribute('role', 'rowgroup');

    // Spacer elements for virtual scrolling
    const topSpacer = document.createElement('div');
    topSpacer.className = 'csma-datagrid__spacer';
    const bottomSpacer = document.createElement('div');
    bottomSpacer.className = 'csma-datagrid__spacer';

    const visibleContainer = document.createElement('div');

    body.appendChild(topSpacer);
    body.appendChild(visibleContainer);
    body.appendChild(bottomSpacer);

    // State overlays
    const stateEls = {};
    ['loading', 'empty', 'error'].forEach((state) => {
        const el = document.createElement('div');
        el.className = 'csma-datagrid__state';
        el.dataset.state = state;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        stateEls[state] = el;
    });

    // Loading
    const spinner = document.createElement('div');
    spinner.className = 'csma-datagrid__spinner';
    stateEls.loading.appendChild(spinner);
    const loadingMsg = document.createElement('span');
    loadingMsg.className = 'csma-datagrid__state-message';
    loadingMsg.textContent = loadingMessage;
    stateEls.loading.appendChild(loadingMsg);

    // Empty
    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'csma-datagrid__state-icon';
    emptyIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>`;
    stateEls.empty.appendChild(emptyIcon);
    const emptyMsg = document.createElement('span');
    emptyMsg.className = 'csma-datagrid__state-message';
    emptyMsg.textContent = emptyMessage;
    stateEls.empty.appendChild(emptyMsg);

    // Error
    const errorIcon = document.createElement('div');
    errorIcon.className = 'csma-datagrid__state-icon';
    errorIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    stateEls.error.appendChild(errorIcon);
    const errorMsg = document.createElement('span');
    errorMsg.className = 'csma-datagrid__state-message';
    errorMsg.textContent = errorMessage;
    stateEls.error.appendChild(errorMsg);
    const retryBtn = document.createElement('button');
    retryBtn.className = 'csma-datagrid__state-retry';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => loadData());
    stateEls.error.appendChild(retryBtn);

    root.appendChild(header);
    root.appendChild(body);
    Object.values(stateEls).forEach((el) => root.appendChild(el));

    // ─── Virtual Scrolling ─────────────────────────────

    let scrollTop = 0;
    let containerHeight = 0;

    function updateContainerHeight() {
        containerHeight = body.clientHeight;
    }

    function getVisibleRange() {
        const totalHeight = rows.length * rowHeight;
        const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
        const endIndex = Math.min(
            rows.length,
            Math.ceil((scrollTop + containerHeight) / rowHeight) + OVERSCAN
        );
        return { startIndex, endIndex, totalHeight };
    }

    function renderVisibleRows() {
        if (isLoading || error || rows.length === 0) {
            visibleContainer.innerHTML = '';
            topSpacer.style.height = '0px';
            bottomSpacer.style.height = '0px';
            return;
        }

        updateContainerHeight();
        const { startIndex, endIndex, totalHeight } = getVisibleRange();

        topSpacer.style.height = (startIndex * rowHeight) + 'px';
        bottomSpacer.style.height = (totalHeight - endIndex * rowHeight) + 'px';

        visibleContainer.innerHTML = '';

        for (let i = startIndex; i < endIndex; i++) {
            const row = rows[i];
            const rowEl = createRowElement(row, i);
            visibleContainer.appendChild(rowEl);
        }

        root.setAttribute('aria-rowcount', String(rows.length + 1));
    }

    function createRowElement(row, index) {
        const rowEl = document.createElement('div');
        rowEl.className = 'csma-datagrid__row';
        rowEl.setAttribute('role', 'row');
        rowEl.setAttribute('aria-rowindex', String(index + 2)); // +1 header, +1 1-based
        rowEl.dataset.rowIndex = String(index);
        rowEl.dataset.rowId = row.id != null ? String(row.id) : String(index);

        if (selectedIds.has(row.id)) {
            rowEl.setAttribute('aria-selected', 'true');
        }

        if (selectable && multiSelect) {
            const checkboxCell = document.createElement('div');
            checkboxCell.className = 'csma-datagrid__cell csma-datagrid__cell--checkbox';
            checkboxCell.setAttribute('role', 'gridcell');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'csma-datagrid__checkbox';
            checkbox.checked = selectedIds.has(row.id);
            checkbox.setAttribute('aria-label', `Select row ${index + 1}`);
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSelection(row.id);
            });
            checkboxCell.appendChild(checkbox);
            rowEl.appendChild(checkboxCell);
        }

        columns.forEach((col) => {
            const cell = document.createElement('div');
            cell.className = 'csma-datagrid__cell';
            cell.setAttribute('role', 'gridcell');
            cell.style.width = columnWidths[col.id] + 'px';
            cell.style.flexShrink = '0';

            if (col.render) {
                const rendered = col.render(row[col.id], row, index);
                if (typeof rendered === 'string') {
                    cell.textContent = rendered;
                } else if (rendered instanceof Node) {
                    cell.appendChild(rendered);
                }
            } else {
                cell.textContent = row[col.id] != null ? String(row[col.id]) : '';
            }

            rowEl.appendChild(cell);
        });

        rowEl.addEventListener('click', () => {
            if (selectable) {
                if (multiSelect) {
                    toggleSelection(row.id);
                } else {
                    setSelection(row.id);
                }
            }

            if (onRowClick) {
                onRowClick(row, index);
            }

            if (emit) {
                emit('datagrid:row-click', { row, index, rowId: row.id });
            }
        });

        rowEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (selectable) toggleSelection(row.id);
                if (onRowClick) onRowClick(row, index);
            }
        });

        return rowEl;
    }

    function renderAll() {
        renderVisibleRows();
    }

    // ─── Sort ──────────────────────────────────────────

    function handleSort(columnId) {
        if (sortColumn === columnId) {
            if (sortDirection === 'asc') {
                sortDirection = 'desc';
            } else if (sortDirection === 'desc') {
                sortColumn = null;
                sortDirection = null;
            }
        } else {
            sortColumn = columnId;
            sortDirection = 'asc';
        }

        applySort();
        updateSortIndicators();

        if (emit) {
            emit('datagrid:sort', { column: sortColumn, direction: sortDirection });
        }
    }

    function applySort() {
        if (!sortColumn || !sortDirection) {
            // Restore original order — re-fetch or restore from options
            return;
        }

        const col = columns.find((c) => c.id === sortColumn);
        const sortFn = col?.sortFn || defaultSort;
        const dir = sortDirection === 'asc' ? 1 : -1;

        rows = [...rows].sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];
            return sortFn(aVal, bVal) * dir;
        });

        renderAll();
    }

    function defaultSort(a, b) {
        if (a == null && b == null) return 0;
        if (a == null) return -1;
        if (b == null) return 1;
        const sa = String(a);
        const sb = String(b);
        return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
    }

    function updateSortIndicators() {
        const headerCells = header.querySelectorAll('[aria-sort]');
        headerCells.forEach((cell) => {
            const colId = cell.dataset.columnId;
            if (colId === sortColumn) {
                cell.setAttribute('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');
            } else {
                cell.setAttribute('aria-sort', 'none');
            }
        });
    }

    // ─── Selection ─────────────────────────────────────

    function toggleSelection(rowId) {
        if (selectedIds.has(rowId)) {
            selectedIds.delete(rowId);
        } else {
            if (!multiSelect) selectedIds.clear();
            selectedIds.add(rowId);
        }
        renderAll();
        notifySelection();
    }

    function setSelection(rowId) {
        selectedIds.clear();
        selectedIds.add(rowId);
        renderAll();
        notifySelection();
    }

    function notifySelection() {
        if (onSelectionChange) {
            onSelectionChange([...selectedIds]);
        }
        if (emit) {
            emit('datagrid:selection-change', { selectedIds: [...selectedIds] });
        }
    }

    // ─── Data Loading ──────────────────────────────────

    async function loadData() {
        if (!fetch) return;

        setState('loading');
        error = null;

        try {
            const result = await fetch({ sortColumn, sortDirection });
            rows = Array.isArray(result) ? result : (result?.rows || result?.data || []);
            if (rows.length === 0) {
                setState('empty');
            } else {
                setState(null);
                if (sortColumn && sortDirection) applySort();
            }
            renderAll();
        } catch (err) {
            error = err;
            setState('error');
            if (emit) {
                emit('datagrid:error', { error: err.message || String(err) });
            }
        }
    }

    function setState(state) {
        delete root.dataset.state;
        if (state) root.dataset.state = state;
    }

    // ─── Scroll Handler ────────────────────────────────

    function onScroll() {
        scrollTop = body.scrollTop;
        renderVisibleRows();
    }

    body.addEventListener('scroll', onScroll, { passive: true });

    // ─── Keyboard Navigation ───────────────────────────

    root.addEventListener('keydown', (e) => {
        if (isLoading || rows.length === 0) return;

        let handled = true;

        switch (e.key) {
            case 'ArrowDown':
                focusedRowIndex = Math.min(focusedRowIndex + 1, rows.length - 1);
                break;
            case 'ArrowUp':
                focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
                break;
            case 'Home':
                focusedRowIndex = 0;
                break;
            case 'End':
                focusedRowIndex = rows.length - 1;
                break;
            case ' ':
                if (selectable && focusedRowIndex >= 0) {
                    e.preventDefault();
                    toggleSelection(rows[focusedRowIndex].id);
                }
                break;
            default:
                handled = false;
        }

        if (handled) {
            e.preventDefault();
            scrollToRow(focusedRowIndex);
            renderAll();
            focusRowElement(focusedRowIndex);
        }
    });

    function scrollToRow(index) {
        const targetScroll = index * rowHeight;
        const visibleStart = Math.floor(scrollTop / rowHeight);
        const visibleEnd = Math.ceil((scrollTop + containerHeight) / rowHeight);

        if (index < visibleStart || index >= visibleEnd) {
            body.scrollTop = Math.max(0, targetScroll - containerHeight / 2 + rowHeight / 2);
        }
    }

    function focusRowElement(index) {
        requestAnimationFrame(() => {
            const rowEl = visibleContainer.querySelector(`[data-row-index="${index}"]`);
            if (rowEl) rowEl.focus();
        });
    }

    // ─── Resize Observer ───────────────────────────────

    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
            updateContainerHeight();
            renderVisibleRows();
        });
        ro.observe(body);
    }

    // ─── Initial Load ─────────────────────────────────

    container.appendChild(root);

    if (fetch) {
        loadData();
    } else if (initialData) {
        if (rows.length === 0) {
            setState('empty');
        }
        renderAll();
    } else {
        setState('empty');
    }

    // ─── Public API ────────────────────────────────────

    return {
        /** Update grid with new data. Pass an array of row objects. */
        update(newData) {
            rows = Array.isArray(newData) ? newData : [];
            error = null;
            if (rows.length === 0) {
                setState('empty');
            } else {
                setState(null);
                if (sortColumn && sortDirection) applySort();
            }
            renderAll();
        },

        /** Sort by column. Direction: 'asc', 'desc', or null to clear. */
        sort(columnId, direction) {
            sortColumn = columnId;
            sortDirection = direction;
            applySort();
            updateSortIndicators();
            renderAll();
        },

        /** Programmatically resize a column. */
        resizeColumn(columnId, width) {
            if (columnWidths[columnId] != null) {
                columnWidths[columnId] = Math.max(MIN_COLUMN_WIDTH, width);
                const headerCell = header.querySelector(`[data-column-id="${columnId}"]`);
                if (headerCell) headerCell.style.width = width + 'px';
                renderAll();
            }
        },

        /** Get currently selected row IDs. */
        getSelected() {
            return [...selectedIds];
        },

        /** Set selected row IDs (replaces current selection). */
        setSelected(ids) {
            selectedIds = new Set(ids);
            renderAll();
            notifySelection();
        },

        /** Get current row data. */
        getData() {
            return rows;
        },

        /** Set loading state manually. */
        setLoading(loading) {
            isLoading = loading;
            setState(loading ? 'loading' : rows.length === 0 ? 'empty' : null);
            renderAll();
        },

        /** Destroy the grid, removing all DOM and listeners. */
        destroy() {
            body.removeEventListener('scroll', onScroll);
            root.remove();
        },
    };
}
