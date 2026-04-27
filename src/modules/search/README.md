# Search Module

## Purpose

Tiered search integration with core, enhanced, and AI-assisted search services.
FlexSearch is registered as the built-in local search-engine adapter.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `search` via `SearchModuleService`; `searchFlexSearchAdapter` via `FlexSearchAdapter` |
| Adapter | `search.flexsearch` contribution of type `search-engine` |
| Contracts | Search query, results, index, facets, pagination, suggestions, and AI context contracts. |

## Runtime Integration

Loaded with `FEATURES.SEARCH_MODULE`; runtime passes `runtimeConfig.search` plus the runtime `AdapterRegistry`.
`runtimeConfig.search.adapter` defaults to `search.flexsearch`.

## Storage / Side Effects

Builds in-memory search indexes through the selected adapter. The FlexSearch adapter can persist index documents to local storage when configured.

## Tests

`tests/search-module.test.js`; `tests/contracts.test.js`; registry/error/accessibility tests cover related runtime paths.
