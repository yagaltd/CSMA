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
| Exports | `Viewport`, `CullingCore`, `RenderScheduler` |

## Runtime Integration

Not loaded by the runtime; consumer modules (e.g. MorphEditor) import
the utilities they need directly. Zero dependencies on other CSMA modules.

## Storage / Side Effects

None — pure DOM measurement and scheduling utilities.

## Tests

`LayoutContracts` is exported via the module index; no dedicated utility tests
yet. Run `npm run certify:module` before relying on this module.
