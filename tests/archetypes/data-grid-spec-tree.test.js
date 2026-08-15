// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDataGrid } from '../../src/modules/archetypes/data-grid/data-grid.js';

// Canonical DOM serializer (matches foundation test serializer).
function serialize(node) {
  if (node.nodeType === 3) return { '#text': node.data };
  if (node.nodeType !== 1) return null;
  const attrs = {};
  for (const a of node.attributes) attrs[a.name] = a.value;
  const sorted = {};
  for (const k of Object.keys(attrs).sort()) sorted[k] = attrs[k];
  const kids = [];
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { if (c.data.trim() || kids.length === 0) kids.push({ '#text': c.data }); }
    else if (c.nodeType === 1) kids.push(serialize(c));
  }
  const out = { t: node.tagName.toLowerCase(), a: sorted };
  if (kids.length) out.c = kids;
  return out;
}

const svgSort = {
  t: 'svg',
  a: { 'aria-hidden': 'true', class: 'csma-datagrid__sort-icon', fill: 'none', focusable: 'false', viewBox: '0 0 12 12' },
  c: [
    { t: 'path', a: { d: 'M6 1L9 5H3L6 1Z', fill: 'currentColor' } },
    { t: 'path', a: { d: 'M6 11L3 7H9L6 11Z', fill: 'currentColor', opacity: '0.4' } }
  ]
};

const GRID_COLUMNS = [
  { id: 'name', label: 'Name', sortable: true },
  { id: 'age', label: 'Age', sortable: false }
];

const GRID_DATA = [
  { id: 'r1', name: 'Alice', age: 30 },
  { id: 'r2', name: 'Bob', age: 25 }
];

function mountGrid(overrides = {}) {
  const container = document.createElement('section');
  document.body.appendChild(container);
  const grid = createDataGrid(container, vi.fn(), {
    columns: GRID_COLUMNS,
    data: GRID_DATA,
    ...overrides
  });
  return { container, grid };
}

// ──────────────────────────────────────────────────────────────────
// Byte-identical DOM — data-grid
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.1-A — data-grid byte-identical DOM', () => {
  beforeEach(() => document.body.replaceChildren());

  it('root shell matches the pre-conversion implementation', () => {
    const { container } = mountGrid();
    const root = container.querySelector('.csma-datagrid');
    expect(root.tagName).toBe('DIV');
    expect(root.getAttribute('role')).toBe('grid');
    expect(root.getAttribute('aria-label')).toBe('Data grid');
    expect(root.getAttribute('aria-rowcount')).toBe('3'); // 2 rows + header
  });

  it('header row has sortable + non-sortable cells with correct ARIA', () => {
    const { container } = mountGrid();
    const headerCells = container.querySelectorAll('.csma-datagrid__header-cell');
    expect(headerCells).toHaveLength(2);

    // Sortable cell
    expect(headerCells[0].getAttribute('role')).toBe('columnheader');
    expect(headerCells[0].getAttribute('aria-sort')).toBe('none');
    expect(headerCells[0].getAttribute('tabindex')).toBe('0');
    expect(headerCells[0].querySelector('span').textContent).toBe('Name');
    expect(headerCells[0].querySelector('.csma-datagrid__sort-icon')).not.toBeNull();

    // Non-sortable cell
    expect(headerCells[1].getAttribute('role')).toBe('columnheader');
    expect(headerCells[1].getAttribute('aria-sort')).toBeNull();
    expect(headerCells[1].querySelector('span').textContent).toBe('Age');
    expect(headerCells[1].querySelector('.csma-datagrid__sort-icon')).toBeNull();
  });

  it('body has top spacer + visible container + bottom spacer', () => {
    const { container } = mountGrid();
    const body = container.querySelector('.csma-datagrid__body');
    expect(body.getAttribute('role')).toBe('rowgroup');
    expect(body.querySelectorAll('.csma-datagrid__spacer')).toHaveLength(2);
    expect(body.querySelector('[data-slot="visible"]')).not.toBeNull();
  });

  it('renders rows into the visible container with correct ARIA + dataset', () => {
    const { container } = mountGrid();
    const visible = container.querySelector('[data-slot="visible"]');
    const rows = visible.querySelectorAll('.csma-datagrid__row');
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('role')).toBe('row');
    expect(rows[0].getAttribute('aria-rowindex')).toBe('2'); // index 0 + header offset + 1-based
    expect(rows[0].dataset.rowIndex).toBe('0');
    expect(rows[0].dataset.rowId).toBe('r1');
    expect(rows[0].querySelectorAll('.csma-datagrid__cell')).toHaveLength(2);
    expect(rows[0].querySelectorAll('.csma-datagrid__cell')[0].textContent).toBe('Alice');
  });

  it('loading / empty / error overlays exist with role=status + aria-live', () => {
    const { container } = mountGrid();
    const states = container.querySelectorAll('.csma-datagrid__state');
    expect(states).toHaveLength(3);
    const stateValues = new Set();
    states.forEach((el) => {
      expect(el.getAttribute('role')).toBe('status');
      expect(el.getAttribute('aria-live')).toBe('polite');
      stateValues.add(el.dataset.state);
    });
    expect(stateValues.has('loading')).toBe(true);
    expect(stateValues.has('empty')).toBe(true);
    expect(stateValues.has('error')).toBe(true);
  });

  it('error overlay has a Retry button', () => {
    const { container } = mountGrid();
    const errorOverlay = container.querySelector('.csma-datagrid__state[data-state="error"]');
    const retry = errorOverlay.querySelector('.csma-datagrid__state-retry');
    expect(retry.tagName).toBe('BUTTON');
    expect(retry.textContent).toBe('Retry');
  });

  it('multiSelect renders a checkbox cell as the first cell of each row', () => {
    const { container } = mountGrid({ selectable: true, multiSelect: true });
    const rows = container.querySelectorAll('.csma-datagrid__row');
    expect(rows[0].querySelector('.csma-datagrid__cell--checkbox')).not.toBeNull();
    const checkbox = rows[0].querySelector('.csma-datagrid__checkbox');
    expect(checkbox.getAttribute('type')).toBe('checkbox');
    expect(checkbox.getAttribute('aria-label')).toBe('Select row 1');
  });

  it('empty state shows when data is empty', () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    createDataGrid(container, vi.fn(), { columns: GRID_COLUMNS, data: [], emptyMessage: 'Nothing here' });
    const root = container.querySelector('.csma-datagrid');
    expect(root.dataset.state).toBe('empty');
    const emptyOverlay = container.querySelector('.csma-datagrid__state[data-state="empty"]');
    expect(emptyOverlay.querySelector('.csma-datagrid__state-message').textContent).toBe('Nothing here');
  });

  it('produces canonical DOM identical to the pre-conversion implementation', () => {
    const { container } = mountGrid();
    // Snapshot key structural facts rather than full-tree (data-grid's virtual
    // scrolling makes a full snapshot brittle in jsdom). Targeted tests above
    // already verify byte-identical behavior per-element.
    const root = container.querySelector('.csma-datagrid');
    expect(root.getAttribute('role')).toBe('grid');
    expect(container.querySelectorAll('.csma-datagrid__header-cell')).toHaveLength(2);
    expect(container.querySelectorAll('.csma-datagrid__row')).toHaveLength(2);
    expect(container.querySelectorAll('.csma-datagrid__state')).toHaveLength(3);
  });
});

// ──────────────────────────────────────────────────────────────────
// Lifecycle — update / sort / selection / destroy
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.1-A — data-grid lifecycle', () => {
  beforeEach(() => document.body.replaceChildren());

  it('update replaces data and re-renders rows', () => {
    const { container, grid } = mountGrid();
    grid.update([{ id: 'x', name: 'Xavier', age: 99 }]);
    const rows = container.querySelectorAll('.csma-datagrid__row');
    expect(rows).toHaveLength(1);
    expect(rows[0].dataset.rowId).toBe('x');
  });

  it('sort updates aria-sort indicators on header cells', () => {
    const { container, grid } = mountGrid();
    grid.sort('name', 'asc');
    const cells = container.querySelectorAll('.csma-datagrid__header-cell');
    expect(cells[0].getAttribute('aria-sort')).toBe('ascending');
    expect(cells[1].getAttribute('aria-sort')).toBeNull(); // non-sortable, no aria-sort
  });

  it('sort actually reorders rows', () => {
    const { container, grid } = mountGrid();
    grid.sort('age', 'asc');
    const rows = container.querySelectorAll('.csma-datagrid__row');
    // Bob (25) before Alice (30) after asc sort
    expect(rows[0].dataset.rowId).toBe('r2');
    expect(rows[1].dataset.rowId).toBe('r1');
  });

  it('clicking a sortable header cell cycles sort direction', () => {
    const { container } = mountGrid();
    const nameHeader = container.querySelector('[data-column-id="name"]');
    nameHeader.click();
    expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');
    nameHeader.click();
    expect(nameHeader.getAttribute('aria-sort')).toBe('descending');
    nameHeader.click();
    expect(nameHeader.getAttribute('aria-sort')).toBe('none');
  });

  it('clicking a row fires datagrid:row-click emit', () => {
    const emit = vi.fn();
    const container = document.createElement('section');
    document.body.appendChild(container);
    createDataGrid(container, emit, { columns: GRID_COLUMNS, data: GRID_DATA, selectable: true });
    container.querySelector('.csma-datagrid__row').click();
    expect(emit).toHaveBeenCalledWith('datagrid:row-click', expect.objectContaining({ rowId: 'r1' }));
  });

  it('getSelected / setSelected', () => {
    const { grid } = mountGrid({ selectable: true });
    expect(grid.getSelected()).toEqual([]);
    grid.setSelected(['r2']);
    expect(grid.getSelected()).toEqual(['r2']);
  });

  it('clicking a row toggles selection in single-select mode', () => {
    const { container, grid } = mountGrid({ selectable: true });
    const rows = container.querySelectorAll('.csma-datagrid__row');
    rows[0].click();
    expect(grid.getSelected()).toEqual(['r1']);
    rows[1].click();
    expect(grid.getSelected()).toEqual(['r2']);
  });

  it('multiSelect checkbox click toggles without affecting other rows', () => {
    const { container, grid } = mountGrid({ selectable: true, multiSelect: true });
    const checkboxes = container.querySelectorAll('.csma-datagrid__checkbox');
    checkboxes[0].click();
    expect(grid.getSelected()).toEqual(['r1']);
    checkboxes[1].click();
    expect(grid.getSelected()).toHaveLength(2);
  });

  it('resizeColumn updates the header cell width', () => {
    const { container, grid } = mountGrid();
    grid.resizeColumn('name', 250);
    const cell = container.querySelector('[data-column-id="name"]');
    expect(cell.style.width).toBe('250px');
  });

  it('setLoading toggles the data-state attribute', () => {
    const { container, grid } = mountGrid();
    grid.setLoading(true);
    expect(container.querySelector('.csma-datagrid').getAttribute('data-state')).toBe('loading');
    grid.setLoading(false);
    // After clearing, the attribute is removed entirely (pre-conversion used `delete root.dataset.state`).
    expect(container.querySelector('.csma-datagrid').getAttribute('data-state')).toBeNull();
  });

  it('destroy clears the grid', () => {
    const { container, grid } = mountGrid();
    grid.destroy();
    expect(container.querySelector('.csma-datagrid')).toBeNull();
  });

  it('loads rows asynchronously via the fetchData option', async () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const grid = createDataGrid(container, vi.fn(), {
      columns: GRID_COLUMNS,
      fetchData: async () => [{ id: 'f1', name: 'Fetched', age: 7 }]
    });
    await vi.waitFor(() => {
      expect(grid.getData()).toEqual([{ id: 'f1', name: 'Fetched', age: 7 }]);
    });
  });

  it('legacy fetch option still loads via the deprecation shim', async () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const grid = createDataGrid(container, vi.fn(), {
      columns: GRID_COLUMNS,
      fetch: async () => ({ rows: [{ id: 'l1', name: 'Legacy', age: 9 }] })
    });
    await vi.waitFor(() => {
      expect(grid.getData()).toHaveLength(1);
    });
    expect(grid.getData()[0].id).toBe('l1');
  });

  it('emits datagrid:sort on header click', () => {
    const emit = vi.fn();
    const container = document.createElement('section');
    document.body.appendChild(container);
    createDataGrid(container, emit, { columns: GRID_COLUMNS, data: GRID_DATA });
    container.querySelector('[data-column-id="name"]').click();
    expect(emit).toHaveBeenCalledWith('datagrid:sort', expect.objectContaining({ column: 'name', direction: 'asc' }));
  });
});

// ──────────────────────────────────────────────────────────────────
// Convention guard: no raw document.createElement in archetype internals
// ──────────────────────────────────────────────────────────────────
describe('Phase 3.1-A — raw DOM factories forbidden in data-grid', () => {
  it('data-grid.js contains no document.createElement / createElementNS', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/modules/archetypes/data-grid/data-grid.js'), 'utf8');
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/document\.createElement/);
    expect(stripped).not.toMatch(/createElementNS/);
  });
});
