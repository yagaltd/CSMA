# Data Table Module

> **Catalog-only module:** not wired into any demo; not yet certified. Run
> `npm run certify:module` before relying on it.

## Purpose

Remote table loading, sorting, filtering, and table error state.

## Relationship to the `data-grid` archetype

Documented pairing — they are the two halves of one table surface, not
competitors:

- **`data-table` (this module)** = the data/state layer: remote fetch,
  sort/filter state, error/loading contracts over the EventBus.
- **`data-grid` (`src/modules/archetypes/data-grid/`)** = the presentation
  layer: the sortable/resizable/selectable grid UI archetype, fed via its
  `fetchData` option.

Intended composition: data-table owns state and publishes; data-grid renders
and calls back through `fetchData`. Do not add rendering to this module and do
not grow another data/state service into the archetype.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `dataTable` via `DataTableService` |
| Contracts | Data-table load, sort, filter, updated, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.DATA_TABLE_MODULE`; runtime passes the core API service when available.

## Storage / Side Effects

May call host API services for remote table data.

## Tests

`tests/contracts.test.js`; add service tests for remote loading and pagination rules.
