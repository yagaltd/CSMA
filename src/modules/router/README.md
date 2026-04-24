# Router Module

## Purpose

Optional SPA and hybrid route orchestration layered on the core runtime path
normalization and History API helpers.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `router` via `RouterService` |
| Contracts | Route navigation intent, route changed, blocked, not-found, and navigation failed contracts. |

## Runtime Integration

Loaded with `FEATURES.ROUTER_MODULE`. Pairs with `FEATURES.CLIENT_NAVIGATION`
for History API interception and uses `runtimeConfig.router` for route tables,
not-found behavior, and render hooks.

## Storage / Side Effects

No persistent storage. Publishes routing events, resolves route params, and
invokes configured view/render handlers.

## Tests

`tests/router-module.test.js`; contract coverage in `tests/contracts.test.js`.
