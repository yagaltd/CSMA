/**
 * Data Grid Archetype — CSMA Token-Driven Sortable Data Table
 *
 * Factory: createDataGrid(container, emit, options) → { update, destroy, getSelected, sort, resizeColumn }
 *
 * Phase 3.1 — aiui-native (Option a: factory-wrapping). All DOM construction
 * routes through `getComposer().mountTree(spec, target)`; no raw
 * `document.createElement` in archetype internals. Events are wired on the
 * mounted DOM. Virtual scrolling re-mounts visible rows via spec on each
 * scroll; cell widths + dynamic styles applied post-mount (allowed).
 *
 * Features preserved 1:1 from the pre-conversion implementation:
 * - Sortable columns (click header to toggle ASC/DESC/none)
 * - Resizable columns (drag handles on column edges)
 * - Row selection (single, multi with checkboxes)
 * - Virtual scrolling (render only visible rows)
 * - Loading / empty / error states via data-state attribute
 * - Keyboard navigation (Arrow keys, Enter, Space)
 * - ARIA grid roles and live-region announcements
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { clearChildren } from '../../../utils/dom.js';

// ─── SVG icon specs (composed through mountTree) ─────────────────────

function sortIconSpec() {
    return spec('svg', {
        attrs: {
            viewBox: '0 0 12 12',
            'aria-hidden': 'true',
            focusable: 'false',
            class: 'csma-datagrid__sort-icon'
        },
        children: [
            spec('path', { attrs: { d: 'M6 1L9 5H3L6 1Z', fill: 'currentColor' } }),
            spec('path', { attrs: { d: 'M6 11L3 7H9L6 11Z', fill: 'currentColor', opacity: '0.4' } })
        ]
    });
}

function emptyIconSpec() {
    return spec('svg', {
        attrs: {
            viewBox: '0 0 24 24',
            'aria-hidden': 'true',
            focusable: 'false',
            stroke: 'currentColor',
            'stroke-width': '1.5',
            fill: 'none'
        },
        children: [
            spec('rect', { attrs: { x: '3', y: '3', width: '18', height: '18', rx: '2' } }),
            spec('line', { attrs: { x1: '9', y1: '9', x2: '15', y2: '15' } }),
            spec('line', { attrs: { x1: '15', y1: '9', x2: '9', y2: '15' } })
        ]
    });
}

function errorIconSpec() {
    return spec('svg', {
        attrs: {
            viewBox: '0 0 24 24',
            'aria-hidden': 'true',
            focusable: 'false',
            stroke: 'currentColor',
            'stroke-width': '1.5',
            fill: 'none'
        },
        children: [
            spec('circle', { attrs: { cx: '12', cy: '12', r: '10' } }),
            spec('line', { attrs: { x1: '12', y1: '8', x2: '12', y2: '12' } }),
            spec('line', { attrs: { x1: '12', y1: '16', x2: '12.01', y2: '16' } })
        ]
    });
}

const DEFAULT_COLUMN_WIDTH = 150;
const MIN_COLUMN_WIDTH = 48;
const ROW_HEIGHT = 40;
const OVERSCAN = 5;

// ─── Spec builders ───────────────────────────────────────────────────

function headerCellSpec(col, columnWidths, resizable) {
    const width = columnWidths[col.id];
    const children = [];
    const attrs = {
        role: 'columnheader',
        class: 'csma-datagrid__header-cell',
        // width/flexShrink applied post-mount (inline style — spec helpers
        // don't model `style`; the runtime writes through cell.style).
    };
    attrs['data-column-id'] = col.id;

    if (col.sortable !== false) {
        attrs['aria-sort'] = 'none';
        attrs.tabindex = '0';
        children.push(spec('span', { text: col.label || col.id }));
        children.push(sortIconSpec());
    } else {
        // When not sortable, the pre-conversion code sets textContent directly.
        children.push(spec('span', { text: col.label || col.id }));
    }
    if (resizable) {
        children.push(spec('div', { className: 'csma-datagrid__resize-handle' }));
    }
    return spec('div', { attrs, children });
}

function stateOverlaySpec(state, message) {
    const children = [];
    if (state === 'loading') {
        children.push(spec('div', { className: 'csma-datagrid__spinner' }));
        children.push(spec('span', { className: 'csma-datagrid__state-message', text: message }));
    } else if (state === 'empty') {
        children.push(spec('div', { className: 'csma-datagrid__state-icon', children: [emptyIconSpec()] }));
        children.push(spec('span', { className: 'csma-datagrid__state-message', text: message }));
    } else if (state === 'error') {
        children.push(spec('div', { className: 'csma-datagrid__state-icon', children: [errorIconSpec()] }));
        children.push(spec('span', { className: 'csma-datagrid__state-message', text: message }));
        children.push(spec('button', {
            className: 'csma-datagrid__state-retry',
            text: 'Retry',
            dataset: { action: 'retry' }
        }));
    }
    return spec('div', {
        className: 'csma-datagrid__state',
        attrs: { role: 'status', 'aria-live': 'polite' },
        dataset: { state },
        children
    });
}

function checkboxCellSpec(row, index, selectedIds) {
    const checked = selectedIds.has(row.id);
    return spec('div', {
        className: 'csma-datagrid__cell csma-datagrid__cell--checkbox',
        attrs: { role: 'gridcell' },
        children: [
            spec('input', {
                className: 'csma-datagrid__checkbox',
                attrs: {
                    type: 'checkbox',
                    'aria-label': `Select row ${index + 1}`
                },
                ...(checked ? { dataset: { checked: 'true' } } : {})
            })
        ]
    });
}

function dataCellSpec(col, rendered) {
    // Cell content: text by default, Node passthrough when col.render returns
    // a DOM Node (mountTree accepts Node passthrough in a children array).
    const children = [];
    if (typeof rendered === 'string') {
        children.push(rendered);
    } else if (rendered && rendered.nodeType) {
        children.push(rendered);
    }
    return spec('div', {
        className: 'csma-datagrid__cell',
        attrs: { role: 'gridcell' },
        children
        // width/flexShrink applied post-mount
    });
}

function rowSpec(row, index, columns, columnWidths, selectable, multiSelect, selectedIds) {
    const cells = [];
    if (selectable && multiSelect) {
        cells.push(checkboxCellSpec(row, index, selectedIds));
    }
    for (const col of columns) {
        const rendered = col.render
            ? col.render(row[col.id], row, index)
            : (row[col.id] != null ? String(row[col.id]) : '');
        cells.push(dataCellSpec(col, rendered));
    }
    const attrs = {
        role: 'row',
        class: 'csma-datagrid__row',
        'aria-rowindex': String(index + 2)
    };
    attrs['data-row-index'] = String(index);
    attrs['data-row-id'] = row.id != null ? String(row.id) : String(index);
    if (selectedIds.has(row.id)) {
        attrs['aria-selected'] = 'true';
    }
    return spec('div', { attrs, children: cells });
}

export function createDataGrid(container, emit, options = {}) {
    const {
        columns = [],
        fetchData = null,
        // Deprecated alias — the old `fetch` option shadowed the global
        // `fetch` inside this factory. Prefer `fetchData`; the shim below
        // keeps legacy call sites working.
        fetch: legacyFetch = null,
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

    // Deprecation shim: legacy `fetch` option → fetchData.
    const dataFetcher = (fetchData !== null && fetchData !== undefined) ? fetchData : legacyFetch;

    const composer = getComposer();

    // ─── State ─────────────────────────────────────────

    let rows = initialData || [];
    let sortColumn = null;
    let sortDirection = null;
    let selectedIds = new Set();
    let focusedRowIndex = -1;
    let columnWidths = {};
    let isLoading = !initialData && dataFetcher !== null;
    let error = null;

    columns.forEach((col) => {
        columnWidths[col.id] = col.width || DEFAULT_COLUMN_WIDTH;
    });

    // ─── Static shell mount ────────────────────────────
    //
    // Root + header + body + state overlays mount once. Visible rows mount
    // into `visibleContainer` on each scroll/render (virtual scrolling).
    // Header cells get width applied post-mount (inline style).

    const shellSpec = spec('div', {
        className: 'csma-datagrid',
        attrs: {
            role: 'grid',
            'aria-label': 'Data grid',
            'aria-rowcount': String(rows.length + 1)
        },
        ...(isLoading ? { dataset: { state: 'loading' } } : {}),
        children: [
            spec('div', {
                className: 'csma-datagrid__header',
                attrs: { role: 'row' },
                children: columns.map((col) => headerCellSpec(col, columnWidths, resizable))
            }),
            spec('div', {
                className: 'csma-datagrid__body',
                attrs: { role: 'rowgroup' },
                children: [
                    spec('div', { className: 'csma-datagrid__spacer', dataset: { slot: 'top' } }),
                    spec('div', { dataset: { slot: 'visible' } }),
                    spec('div', { className: 'csma-datagrid__spacer', dataset: { slot: 'bottom' } })
                ]
            }),
            stateOverlaySpec('loading', loadingMessage),
            stateOverlaySpec('empty', emptyMessage),
            stateOverlaySpec('error', errorMessage)
        ]
    });

    const { root, cleanup } = composer.mountTree(shellSpec, container);

    // Apply post-mount width styles on header cells (spec helpers don't model
    // `style`; runtime write is allowed per the pattern).
    const header = root.querySelector('.csma-datagrid__header');
    header.querySelectorAll('.csma-datagrid__header-cell').forEach((cell) => {
        const colId = cell.dataset.columnId;
        cell.style.width = columnWidths[colId] + 'px';
        cell.style.flexShrink = '0';
    });

    const body = root.querySelector('.csma-datagrid__body');
    const topSpacer = root.querySelector('.csma-datagrid__spacer[data-slot="top"]');
    const bottomSpacer = root.querySelector('.csma-datagrid__spacer[data-slot="bottom"]');
    const visibleContainer = root.querySelector('[data-slot="visible"]');

    // ─── Wire header events (sort + resize) ────────────

    header.querySelectorAll('[aria-sort]').forEach((cell) => {
        const colId = cell.dataset.columnId;
        cell.addEventListener('click', () => handleSort(colId));
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSort(colId);
            }
        });
    });

    if (resizable) {
        header.querySelectorAll('.csma-datagrid__resize-handle').forEach((handle) => {
            const cell = handle.closest('.csma-datagrid__header-cell');
            const colId = cell.dataset.columnId;

            let startX = 0;
            let startWidth = 0;
            let activeHandle = null;

            const onMouseDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                startX = e.clientX;
                startWidth = columnWidths[colId];
                activeHandle = handle;
                activeHandle.dataset.active = 'true';
                root.classList.add('csma-datagrid--resizing');

                const onMouseMove = (ev) => {
                    if (!activeHandle) return;
                    const delta = ev.clientX - startX;
                    const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + delta);
                    columnWidths[colId] = newWidth;
                    cell.style.width = newWidth + 'px';
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
        });
    }

    // ─── Retry button on error overlay ─────────────────

    const retryBtn = root.querySelector('.csma-datagrid__state-retry');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => loadData());
    }

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
            clearChildren(visibleContainer);
            topSpacer.style.height = '0px';
            bottomSpacer.style.height = '0px';
            return;
        }

        updateContainerHeight();
        const { startIndex, endIndex, totalHeight } = getVisibleRange();

        topSpacer.style.height = (startIndex * rowHeight) + 'px';
        bottomSpacer.style.height = (totalHeight - endIndex * rowHeight) + 'px';

        clearChildren(visibleContainer);

        // Build spec fragment for visible rows; mount once; wire per-row events
        const rowSpecs = [];
        for (let i = startIndex; i < endIndex; i++) {
            rowSpecs.push(rowSpec_build(rows[i], i));
        }
        if (rowSpecs.length === 0) return;

        const { root: frag } = composer.mountTree(spec('div', { children: rowSpecs }));
        const rowEls = [...frag.children];

        for (let i = 0; i < rowEls.length; i++) {
            wireRowEvents(rowEls[i], rows[startIndex + i], startIndex + i);
        }

        visibleContainer.appendChild(frag);
        root.setAttribute('aria-rowcount', String(rows.length + 1));
    }

    // Internal alias to avoid shadowing the imported rowSpec helper.
    function rowSpec_build(row, index) {
        return rowSpec(row, index, columns, columnWidths, selectable, multiSelect, selectedIds);
    }

    function wireRowEvents(rowEl, row, index) {
        // Apply post-mount cell widths (inline style)
        const cells = rowEl.querySelectorAll('.csma-datagrid__cell');
        let cellIdx = 0;
        if (selectable && multiSelect) {
            // First cell is checkbox — no width style on checkbox cell
            cellIdx = 1;
        }
        columns.forEach((col, ci) => {
            const cell = cells[cellIdx + ci - (selectable && multiSelect ? 1 : 0)];
            if (cell && !cell.classList.contains('csma-datagrid__cell--checkbox')) {
                cell.style.width = columnWidths[col.id] + 'px';
                cell.style.flexShrink = '0';
            }
        });

        // Sync checkbox state post-mount
        if (selectable && multiSelect) {
            const checkbox = rowEl.querySelector('.csma-datagrid__checkbox');
            if (checkbox) {
                checkbox.checked = selectedIds.has(row.id);
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleSelection(row.id);
                });
            }
        }

        // Render cell content for `col.render` results that were DOM Nodes.
        // (rowSpec passes them through mountTree's DOM passthrough; nothing to do.)
        // For text content, the spec already set textContent via spec children.

        rowEl.addEventListener('click', () => {
            if (selectable) {
                if (multiSelect) {
                    toggleSelection(row.id);
                } else {
                    setSelection(row.id);
                }
            }
            if (onRowClick) onRowClick(row, index);
            if (emit) emit('datagrid:row-click', { row, index, rowId: row.id });
        });

        rowEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (selectable) toggleSelection(row.id);
                if (onRowClick) onRowClick(row, index);
            }
        });
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
        if (!sortColumn || !sortDirection) return;
        const col = columns.find((c) => c.id === sortColumn);
        const sortFn = col?.sortFn || defaultSort;
        const dir = sortDirection === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => sortFn(a[sortColumn], b[sortColumn]) * dir);
        renderAll();
    }

    function defaultSort(a, b) {
        if (a == null && b == null) return 0;
        if (a == null) return -1;
        if (b == null) return 1;
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    }

    function updateSortIndicators() {
        header.querySelectorAll('[aria-sort]').forEach((cell) => {
            const colId = cell.dataset.columnId;
            cell.setAttribute('aria-sort', colId === sortColumn
                ? (sortDirection === 'asc' ? 'ascending' : 'descending')
                : 'none');
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
        if (onSelectionChange) onSelectionChange([...selectedIds]);
        if (emit) emit('datagrid:selection-change', { selectedIds: [...selectedIds] });
    }

    // ─── Data Loading ──────────────────────────────────

    async function loadData() {
        if (!dataFetcher) return;
        setState('loading');
        error = null;
        try {
            const result = await dataFetcher({ sortColumn, sortDirection });
            rows = Array.isArray(result) ? result : (result?.rows || result?.data || []);
            isLoading = false;
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
            if (emit) emit('datagrid:error', { error: err.message || String(err) });
        }
    }

    function setState(state) {
        delete root.dataset.state;
        if (state) root.dataset.state = state;
    }

    // ─── Scroll + Resize ───────────────────────────────

    function onScroll() {
        scrollTop = body.scrollTop;
        renderVisibleRows();
    }
    body.addEventListener('scroll', onScroll, { passive: true });

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
            updateContainerHeight();
            renderVisibleRows();
        });
        resizeObserver.observe(body);
    }

    // ─── Keyboard Navigation ───────────────────────────

    root.addEventListener('keydown', (e) => {
        if (isLoading || rows.length === 0) return;
        let handled = true;
        switch (e.key) {
            case 'ArrowDown': focusedRowIndex = Math.min(focusedRowIndex + 1, rows.length - 1); break;
            case 'ArrowUp':   focusedRowIndex = Math.max(focusedRowIndex - 1, 0); break;
            case 'Home':      focusedRowIndex = 0; break;
            case 'End':       focusedRowIndex = rows.length - 1; break;
            case ' ':
                if (selectable && focusedRowIndex >= 0) {
                    e.preventDefault();
                    toggleSelection(rows[focusedRowIndex].id);
                }
                break;
            default: handled = false;
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
            if (rowEl && typeof rowEl.focus === 'function') rowEl.focus();
        });
    }

    // ─── Initial Load ─────────────────────────────────

    if (dataFetcher) {
        loadData();
    } else if (initialData) {
        if (rows.length === 0) setState('empty');
        renderAll();
    } else {
        setState('empty');
    }

    // ─── Public API ────────────────────────────────────

    return {
        update(newData) {
            rows = Array.isArray(newData) ? newData : [];
            error = null;
            if (rows.length === 0) setState('empty');
            else {
                setState(null);
                if (sortColumn && sortDirection) applySort();
            }
            renderAll();
        },

        sort(columnId, direction) {
            sortColumn = columnId;
            sortDirection = direction;
            applySort();
            updateSortIndicators();
            renderAll();
        },

        resizeColumn(columnId, width) {
            if (columnWidths[columnId] != null) {
                columnWidths[columnId] = Math.max(MIN_COLUMN_WIDTH, width);
                const headerCell = header.querySelector(`[data-column-id="${columnId}"]`);
                if (headerCell) headerCell.style.width = width + 'px';
                renderAll();
            }
        },

        getSelected() { return [...selectedIds]; },

        setSelected(ids) {
            selectedIds = new Set(ids);
            renderAll();
            notifySelection();
        },

        getData() { return rows; },

        setLoading(loading) {
            isLoading = loading;
            setState(loading ? 'loading' : (rows.length === 0 ? 'empty' : null));
            renderAll();
        },

        destroy() {
            body.removeEventListener('scroll', onScroll);
            if (resizeObserver) resizeObserver.disconnect();
            cleanup();
        },
    };
}
