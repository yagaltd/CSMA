# Admin Audit Log Module

## Purpose

Audit table UI state, filters, and export affordances.

## Runtime Integration

Loaded only when its explicit feature flag is enabled. The module owns client-side state, EventBus contracts, adapters, optimistic behavior, and safe local cache behavior.

## Frontend / Backend Boundary

This is a frontend CSMA module. It must not store secrets, perform authoritative writes, or replace backend/edge validation. Backend or edge companions are generated later by agent-frontend or backend agents for durable storage, private metrics, RBAC, audit sources, imports, or writes.

## Tests

See tests for module load, happy path, invalid contract payloads, and teardown.

## Gateway / SSMA Seam

This module supports the standard CSMA gateway seam. If an explicit module endpoint is configured, the service uses it. If no explicit endpoint is configured but `runtimeConfig.ssma.baseUrl` exists, runtime resolves the default route through SSMA. If neither exists, the module remains in local client mode.

- `endpoint` → default `/admin/audit-log`; `exportEndpoint` → default `/admin/audit-log/export` when `runtimeConfig.ssma.baseUrl` is set.
- Gateway calls are adapter boundaries only; backend/edge companions remain authoritative.
