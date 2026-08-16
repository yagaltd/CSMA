# Layout Module

> **Catalog-only module:** not wired into any demo; not yet certified. Run
> `npm run certify:module` before relying on it.

## Purpose

Generic viewport tracking, culling, and render scheduling utilities for CSMA surfaces.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | None — utilities are instantiated directly by consumers (no ServiceManager registration) |
| Contracts | `LayoutContracts` |
| Exports | `Viewport`, `CullingCore`, `RenderScheduler`, `yieldToMain` |

Complements CSS containment (`.content-auto` in foundation hardening): CSS
`content-visibility` skips paint for offscreen DOM you keep; `CullingCore`
skips creating DOM for offscreen data. Scroll-heavy data surfaces
(decks, grids, feeds) want both; `yieldToMain` covers synchronous CPU chunks
neither of them address.

## Runtime Integration

Not loaded by the runtime; consumer modules import the utilities they need
directly. Zero dependencies on other CSMA modules. No consumers wired yet —
the intended first consumer is a data-grid or slides perf pass.

## Storage / Side Effects

None — pure DOM measurement and scheduling utilities.

## Tests

`tests/layout-yield.test.js` covers `yieldToMain` (fallback path).
`Viewport`/`CullingCore`/`RenderScheduler` have no dedicated tests yet —
add them alongside the first real consumer, then run
`npm run certify:module`.
