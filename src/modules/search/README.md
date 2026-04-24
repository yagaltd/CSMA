# Search Module

## Purpose

Tiered FlexSearch integration with core, enhanced, and AI-assisted search services.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `search` via `SearchModuleService` |
| Contracts | Search query, results, index, facets, pagination, suggestions, and AI context contracts. |

## Runtime Integration

Loaded with `FEATURES.SEARCH_MODULE`; runtime passes `runtimeConfig.search`.

## Storage / Side Effects

Builds in-memory search indexes and may call AI context services when configured.

## Tests

`tests/contracts.test.js`; registry/error/accessibility tests cover some search-related runtime paths.
