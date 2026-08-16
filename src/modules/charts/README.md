# Charts Module

## Purpose

KPI cards, chart adapter registry, formatting, and loading/error state.

## Relationship to the `stats-dashboard` archetype

Complementary, not competing:

- **`charts` (this module)** = the data/adapter layer: metrics queries,
  chart adapter registry, and the embeddable `chart-display` aiui surface
  (mountable inside slides and dashboards).
- **`stats-dashboard` (`src/modules/archetypes/stats-dashboard/`)** = a
  precomposed KPI dashboard layout (Layer 2). Its optional charts section
  takes an explicit chart renderer hook — point that hook at this module's
  adapter/surface rather than writing a bespoke renderer in the archetype.

## Runtime Integration

Loaded only when its explicit feature flag is enabled. The module owns client-side state, EventBus contracts, adapters, optimistic behavior, and safe local cache behavior.

## Frontend / Backend Boundary

This is a frontend CSMA module. It must not store secrets, perform authoritative writes, or replace backend/edge validation. Backend or edge companions are generated later by agent-frontend or backend agents for durable storage, private metrics, RBAC, audit sources, imports, or writes.

## Tests

See tests for module load, happy path, invalid contract payloads, and teardown.

## Gateway / SSMA Seam

This module supports the standard CSMA gateway seam. If an explicit module endpoint is configured, the service uses it. If no explicit endpoint is configured but `runtimeConfig.ssma.baseUrl` exists, runtime resolves the default route through SSMA. If neither exists, the module remains in local client mode.

- `endpoint` → default `/metrics/query` when `runtimeConfig.ssma.baseUrl` is set.
- Gateway calls are adapter boundaries only; backend/edge companions remain authoritative.
