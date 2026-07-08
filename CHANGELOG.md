# Changelog

## Unreleased

### Added

- Added frontend-only CSMA modules from `MODULE_IMPLEMENTATION_PLAN.md`:
  - Wave 1: `feature-flags`, `content-prefetch`, `cms-content`, `catalog`
  - Wave 2: `cart`, `payment-adapters`, `reviews`, `ab-testing`
  - Wave 3: `permissions-ui`, `charts`, `admin-audit-log`, `import-export`
  - Wave 4: `comments`, `content-workflow`, `edge-search`
- Added wave-level tests for the new modules.
- Added analytics runtime-log bridge and lifecycle-safe analytics flush fallback order.

### Changed

- Updated runtime contract aggregation and optional feature loading for the new modules.
- Added standard SSMA/gateway seams for new backend-capable modules: explicit endpoint config, default `runtimeConfig.ssma.baseUrl` route resolution, and local client mode when no gateway is configured.
- Updated docs to clarify the CSMA frontend/backend split: CSMA owns client state, contracts, adapters, optimistic behavior, and local cache behavior; backend/edge companions own authoritative validation, secrets, durable writes, payments, private search, RBAC, moderation, audit sources, imports, and workflow persistence.
- Expanded legal/public artifact generator drafts for catalog, cart/payment, content/search/comments, admin/audit/import/export, and experiment/storage categories.

### Backend / Edge Companion Status

- Not implemented in CSMA.
- Companion generation/implementation remains future work for `agent-frontend`, SSMA, `agents-framework`, or project-specific backend templates.
