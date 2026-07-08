# CSMA Archetypes — Usage Guide

## Overview

CSMA archetypes are reusable DOM factory functions that render UI components using
CSMA design tokens. They follow a consistent pattern:

```javascript
const instance = createArchetype(container, emit, options);
// instance.update(data)
// instance.destroy()
```

**Boundary rule**: Archetypes never import CSMA modules. Modules never import
archetypes. Wire them through the `emit` callback in your app code.

## Quick Reference

| Archetype | Factory | Key Options | States |
|-----------|---------|-------------|--------|
| data-grid | `createDataGrid(el, emit, opts)` | columns, data/fetch, selectable, resizable | loading, empty, error |
| viewer | `createViewer(el, emit, opts)` | fetch, render, markdown | loading, empty, error |
| stats-dashboard | `createStatsDashboard(el, emit, opts)` | cards[], charts[] | loading, empty, error |
| editor-builder | `createEditor(el, emit, opts)` | fields[], onSave, draftKey | saving, saved, error |
| config-panel | `createConfigPanel(el, emit, opts)` | sections[], onChange | — |
| media-browser | `createMediaBrowser(el, emit, opts)` | items[], selectable, onItemClick | loading, empty, error |
| nav-tabs | `createNavTabs(el, emit, opts)` | tabs[], closable, onTabClick | — |
| overlay-manager | `createOverlayManager(el, emit)` | (methods: openModal, openDrawer, etc.) | — |

## Data Grid

Sortable, resizable, selectable data table with virtual scrolling.

```javascript
const grid = createDataGrid(container, emit, {
  columns: [
    { id: 'name', label: 'Name', width: 200, sortable: true },
    { id: 'status', label: 'Status' },
    { id: 'date', label: 'Date', sortable: true, render: (val) => new Date(val).toLocaleDateString() },
  ],
  data: myRows,
  rowHeight: 36,
  selectable: true,
  multiSelect: true,
  resizable: true,
  onRowClick: (row) => console.log('clicked', row),
  onSelectionChange: (ids) => console.log('selected', ids),
});

// API
grid.update(newData);
grid.sort('columnId', 'desc');
grid.getSelected();      // → ['id1', 'id2']
grid.setSelected(['id1']);
grid.setLoading(true);
grid.destroy();
```

### Token Overrides

```json
{
  "components.data-grid.row-height.$value": "36px",
  "components.data-grid.header-height.$value": "44px"
}
```

## Viewer

Content display with fetch-and-render, safe markdown, sanitized HTML fragments,
and explicit plain-text handling.

```javascript
const viewer = createViewer(container, emit, {
  fetch: (id) => fetch(`/api/content/${id}`).then(r => r.json()),
  render: (data, el) => {
    el.textContent = ''; // Clear with text-safe DOM APIs
    const h2 = document.createElement('h2');
    h2.textContent = data.title;
    el.appendChild(h2);
  },
  markdown: 'auto', // 'auto' | true | false
  sanitize: true,
});

// API
viewer.update(newDataOrId);
viewer.retry(customFetchFn);
viewer.setLoading(true);
viewer.destroy();
```

Default rendering rules:

- markdown and HTML-shaped strings pass through the viewer sanitizer when `sanitize: true`
- object `{ html: '<p>Safe fragment</p>' }` is treated as sanitizable HTML
- object `{ text: '<p>literal text</p>' }` is treated as literal text and rendered through `textContent`
- use `render(data, el)` for trusted custom DOM construction instead of relying on raw `innerHTML`

### Token Overrides

```json
{
  "components.viewer.padding.$value": "1rem 1.5rem",
  "components.viewer.max-width.$value": "72ch"
}
```

## Stats Dashboard

Responsive stat cards with declarative metrics. Optional charts are explicit:
provide a `renderChart(chartDef, context)` callback to mount a chart node, or the
dashboard renders a textual summary fallback.

```javascript
const dash = createStatsDashboard(container, emit, {
  cards: [
    { id: 'total', label: 'Total Videos', fetch: () => api.count('videos'), format: 'number' },
    { id: 'views', label: 'Total Views', fetch: () => api.sum('views'), format: 'number' },
    { id: 'size', label: 'Storage', fetch: () => api.totalSize(), format: 'bytes' },
  ],
  charts: [
    { id: 'daily', label: 'Daily Events', type: 'line', description: 'Daily event totals' },
  ],
  renderChart(chartDef, { container }) {
    const chartNode = document.createElement('div');
    chartNode.dataset.chartType = chartDef.type;
    chartNode.textContent = `Render ${chartDef.label} here with your chart library`;
    container.appendChild(chartNode);
    return chartNode;
  },
  cols: { sm: 2, md: 3, lg: 4 },
});

// API
dash.refresh();
dash.update({ total: { value: 1500, trend: 4 } });
dash.getData();
dash.destroy();
```

### Formats

`number`, `bytes`, `percent`, `duration`, `currency`.

### Token Overrides

```json
{
  "components.stats.card-padding.$value": "1rem",
  "components.stats.chart-height.$value": "240px",
  "components.stats.grid-gap.$value": "1rem"
}
```

## Editor Builder

Form editor from field definitions with validation, draft persistence.

```javascript
const editor = createEditor(container, emit, {
  fields: [
    { id: 'name', type: 'text', label: 'Name', required: true },
    { id: 'email', type: 'email', label: 'Email', required: true },
    { id: 'role', type: 'select', label: 'Role', options: ['Engineer', 'Designer'] },
    { id: 'bio', type: 'textarea', label: 'Bio', help: 'Optional' },
    { id: 'notify', type: 'toggle', label: 'Notifications' },
  ],
  onSave: async (data) => { await api.save(data); },
  draftKey: 'my-form', // localStorage persistence key
});

// API
editor.getValues();           // → { name: '...', email: '...' }
editor.setValues({ name: 'Alice' }); // pre-fill
editor.submit();              // trigger save programmatically
editor.validate();            // → true/false
editor.reset();               // back to initial values
editor.destroy();
```

### Field Types

`text`, `email`, `number`, `password`, `textarea`, `select`, `toggle`

### Token Overrides

```json
{
  "components.input.radius.$value": "0.375rem",
  "components.input.height.$value": "2.5rem"
}
```

## Config Panel

Collapsible sections of labeled controls for settings UIs.

```javascript
const panel = createConfigPanel(container, emit, {
  sections: [
    {
      label: 'Appearance',
      controls: [
        { id: 'theme', type: 'select', label: 'Theme', options: ['Light', 'Dark', 'System'] },
        { id: 'density', type: 'slider', label: 'Density', min: 1, max: 10, value: 5 },
        { id: 'animations', type: 'toggle', label: 'Animations', value: true },
      ],
    },
    {
      label: 'Advanced',
      collapsed: true,
      controls: [
        { id: 'apiKey', type: 'text', label: 'API Key' },
      ],
    },
  ],
  onChange: (id, value) => { /* react to change */ },
});

// API
panel.getValues();            // → { theme: 'Light', density: 5, ... }
panel.setValues({ theme: 'Dark' });
panel.destroy();
```

### Control Types

`toggle`, `color`, `slider`, `select`, `text`

### Token Overrides

```json
{
  "components.config.section-padding.$value": "0.75rem 1rem"
}
```

## Media Browser

Thumbnail grid with search, sort, and selection. For image/video/file browsing.

```javascript
const browser = createMediaBrowser(container, emit, {
  items: [
    { id: '1', name: 'sunset.jpg', type: 'image', src: '/thumbs/sunset.jpg', size: 2.4e6, date: 'Jan 15' },
    { id: '2', name: 'demo.mp4', type: 'video', size: 48e6, date: 'Mar 10' },
  ],
  selectable: true,
  multiSelect: true,
  searchable: true,
  sortable: true,
  onItemClick: (item) => openViewer(item),
});

// API
browser.update(newItems);
browser.getSelected();        // → ['1']
browser.getItems();
browser.setLoading(true);
browser.destroy();
```

### Token Overrides

```json
{
  "components.media.grid-min.$value": "140px",
  "components.media.thumbnail-aspect.$value": "1"
}
```

## Nav Tabs

Horizontal tab bar with overflow arrows, badges, closable tabs.

```javascript
const tabs = createNavTabs(container, emit, {
  tabs: [
    { id: 'tab1', label: 'Dashboard', active: true },
    { id: 'tab2', label: 'Analytics', badge: 5 },
    { id: 'tab3', label: 'Settings' },
  ],
  closable: true,
  onTabClick: (tab) => switchView(tab.id),
  onTabClose: (tab) => removeView(tab.id),
});

// API
tabs.update(newTabs);
tabs.setActive('tab2');
tabs.addTab({ id: 'tab4', label: 'New Tab' });
tabs.removeTab('tab2');
tabs.getActive();             // → 'tab1'
tabs.destroy();
```

### Token Overrides

```json
{
  "components.tabs.height.$value": "2.5rem",
  "components.tabs.font-size.$value": "0.8125rem"
}
```

## Overlay Manager

Modal, drawer, popover, and lightbox with stacking and focus trap.

```javascript
const om = createOverlayManager(document.body, emit);

// Modal
const modal = om.openModal('<p>Content</p>', {
  title: 'Dialog Title',
  footer: '<button onclick="...">OK</button>',
  width: 480,
});
modal.close(); // or Escape / backdrop click

// Drawer (side panel)
om.openDrawer('<p>Settings form here</p>', { title: 'Settings' });

// Popover (anchored)
om.openPopover('<div>Menu items</div>', anchorElement);

// Lightbox (full-screen image)
om.openLightbox('/path/to/image.jpg', { alt: 'Description' });

// API
om.closeAll();
om.destroy();
```

## Migration Guide

### From custom HTML/CSS/JS to archetypes

| Before | After | Savings |
|--------|-------|---------|
| Custom `<table>` with sort JS, resize JS, selection JS | `createDataGrid({ columns, data })` | ~200 lines → 15 |
| Custom form with validation, draft save, status indicator | `createEditor({ fields, onSave, draftKey })` | ~300 lines → 20 |
| Custom metric cards with fetch, format, trend arrows | `createStatsDashboard({ cards })` | ~150 lines → 10 |
| Custom settings page with toggles, sliders, selects | `createConfigPanel({ sections })` | ~200 lines → 15 |
| Custom modal with backdrop, Escape, focus trap | `createOverlayManager(el).openModal(content, opts)` | ~100 lines → 5 |

### Pattern: wiring archetypes to CSMA modules

```javascript
// Archetype emits events, module handles them
const grid = createDataGrid(el, (event, payload) => {
  if (event === 'datagrid:row-click') {
    cartService.addItem(payload.row);
  }
}, { columns, data });

// Module publishes state changes, archetype consumes them
eventBus.subscribe('CART_UPDATED', (cart) => {
  grid.update(cart.items);
});
```
