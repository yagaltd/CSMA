# Data Table Module

## Purpose

Remote table loading, sorting, filtering, and table error state.

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
