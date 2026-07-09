# Changelog

All notable changes to this repository should be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.1.0] - 2026-07-09

### Added

- Parallel optional feature loading: `loadOptionalFeatures` runs independent modules under `Promise.all` with `runFeature` isolation, while preserving dependency order (network → sync → optimistic; form before auth-ui/checkout; consent before analytics/notifications; router before client navigation; file-system before file-upload/media).
- Module-local EventBus contracts: feature modules export `contracts`; `ModuleManager.registerContracts` attaches them on load (intent rate limits normalized) and removes them on unload.
- `src/utils/dom.js` safe DOM helpers (`clearChildren`, `appendTextOrNode`, `createSvgElement`, `createIcon`) used by archetypes and other surfaces.
- Production security defaults hardening: OAuth allows both redirect and authorization URL allowlists, analytics fail-closed without consent, EventBus default-deny for unknown events when contracts are active, SW static cache limited to `/assets/`.
- `tests/security-hardening.test.js` and expanded tests for auth, analytics, contracts, offline cache, and wave modules.
- Frontend-only CSMA modules from `MODULE_IMPLEMENTATION_PLAN.md`:
  - Wave 1: `feature-flags`, `content-prefetch`, `cms-content`, `catalog`
  - Wave 2: `cart`, `payment-adapters`, `reviews`, `ab-testing`
  - Wave 3: `permissions-ui`, `charts`, `admin-audit-log`, `import-export`
  - Wave 4: `comments`, `content-workflow`, `edge-search`
- Wave-level tests for the new modules.
- Analytics runtime-log bridge and lifecycle-safe analytics flush fallback order.
- Archetype modules and demos: `data-grid`, `viewer`, `stats-dashboard`, `editor-builder`, `config-panel`, `media-browser`, `nav-tabs`, `overlay-manager`, plus newsletter-dashboard greenfield demo guidance.
- Unified `media` module consolidating camera / media-capture / media-transform / image-optimizer.
- `auth-ui`, `captcha`, AI UI composition catalog / streaming ops, router delivery presets, project artifact generator, token override patch workflow, design/responsive checks.

### Changed

- `src/runtime/Contracts.js` is **core-only**; optional module contracts no longer ship as a static mega-import. `tooling/scripts/check-security.js` scans core plus `src/modules/**/contracts/*-contracts.js`.
- Analytics durable queue prefers IndexedDB with item + byte caps; memory fallback (no full `localStorage` rewrite as primary path).
- FlexSearch persistence remains default-off; when enabled, debounced IndexedDB snapshots.
- Optimistic action log: IndexedDB preferred; localStorage full-array rewrite fallback removed (memory when IDB unavailable).
- EventBus `_scanPayloadSecurity` reuses a push/pop path buffer instead of allocating a new path array per node.
- Rate limiter uses O(1) fixed-window buckets.
- AI providers: browser API-key paths removed; Gemini defaults to backend proxy base `/ai/gemini/models`.
- Unsafe DOM sinks removed repo-wide under `src/` (textContent / DOM helpers / sanitized viewer fragment adoption).
- Form contracts: `sensitiveFields` narrowed to `optional(array(string()))`.
- Vite ^8 / Vitest ^4 upgrades; foundation layout media query uses canonical `768px` breakpoint value.
- Demo/showcase CSP meta tags on archetypes demo, newsletter dashboard, and token showcase.
- Docs/README: OAuth production allowlist keys, core vs module contracts, feature load waves.
- Updated runtime contract aggregation (core + module registration) and optional feature loading for the vertical modules.
- Added standard SSMA/gateway seams for backend-capable modules: explicit endpoint config, default `runtimeConfig.ssma.baseUrl` route resolution, and local client mode when no gateway is configured.
- Updated docs to clarify the CSMA frontend/backend split: CSMA owns client state, contracts, adapters, optimistic behavior, and local cache behavior; backend/edge companions own authoritative validation, secrets, durable writes, payments, private search, RBAC, moderation, audit sources, imports, and workflow persistence.
- Expanded legal/public artifact generator drafts for catalog, cart/payment, content/search/comments, admin/audit/import/export, and experiment/storage categories.
- Expanded AI UI `SAFE_TAGS` and Type I UI component set (see `879e1c1`).
- Cleaned generic framework boundary so production source stays free of demo-specific example-module contracts (`770e0c4`).

### Fixed

- Overlay manager z-index / backdrop; media browser demo issues.
- Charts not rendering / config theme switching / archetype demo performance issues.
- Share toast messaging distinguishes clipboard vs Web Share failures.

### Security

- Production profile rejects persistent access-token storage.
- OAuth production validation requires same-origin or configured `allowedRedirectOrigins` / `allowedRedirectUris` and `allowedAuthorizationOrigins` / `allowedAuthorizationUris` (HTTPS for external authorization URLs).
- Service worker denies sensitive prefixes (`/api/`, `/auth/`, `/forms/`, `/media/`, `/logs/`, `/optimistic/`, `/query/`, `/admin/`, `/internal/`, session/login/logout).
- Client rate limits remain UX/backpressure only; SSMA/backend remains authority.

### Backend / Edge Companion Status

- Not implemented in CSMA.
- Companion generation/implementation remains future work for `agent-frontend`, SSMA, `agents-framework`, or project-specific backend templates.

### History note

- Between `c0017df` and `919f237`, `CHANGELOG.md` temporarily lost pre-2.0 Keep a Changelog sections and only kept a short Unreleased waves block. The historical 1.1.0 / 1.2.0 / 2.0.0 sections below were restored from git (`fdd6e65` and earlier). Commit history on `main` was not force-rewritten.

## [2.0.0] - 2026-04-01

### Added

- `docs/csma-observability/SKILL.md` as the dedicated agent-facing reference for diagnostics, telemetry, consent, snapshot, and devtools ownership
- `docs/csma-testing/SKILL.md` — test conventions, contract testing, module testing, accessibility testing guidance
- `docs/csma-security/SKILL.md` — 6-layer security model, CSP, rate limiting, input sanitization reference
- design token pipeline: `design-tokens.json` -> `scripts/generate-tokens.js` -> `src/css/generated/tokens.css`
- `src/bootstrap/` directory with starter and full bootstrap seam files
- `src/runtime/ViewRegistry.js` for view contribution registration
- `src/runtime/dev/` for development-time utilities
- `src/css/foundation/hardening.css`, `motion.css`, `print.css` partials
- accessibility tests (`accessibility-axe.test.js`, `accessibility-contrast.test.js`)
- i18n/RTL test coverage (`i18n-rtl.test.js`)
- error handling and extreme input test coverage
- OpenAI-compatible provider (`src/modules/ai/providers/OpenAICompatibleProvider.js`)
- SSMA gateway provider (`src/modules/ai/providers/SSMAGatewayProvider.js`)

### Changed

- documented the completed observability refactor in top-level docs and agent guidance
- clarified the architecture split between local diagnostics (`LogAccumulator`) and outbound telemetry / website analytics (`src/modules/analytics/`)
- aligned `SSMAGatewayProvider` with SSMA's public query boundary instead of the older ad hoc AI route
- updated template metadata to reflect the current starter component set instead of removed UI components and patterns
- component registry updated to reflect starter set (Badge, Button, Toast)
- component showcase rewritten as SPA with layout styles
- AGENTS.md updated: fixed stale skill references, added testing/commit/anti-pattern sections
- existing test files updated for current runtime API surface

### Removed

**Breaking: UI components trimmed to starter set.** The following 40+ components were removed from `src/ui/components/`. If your project depends on any of these, copy the last version from the `ec84a73` commit before upgrading:

accordion, alert, alert-dialog, analytics-consent, aspect-ratio, avatar, breadcrumb, calendar, card, carousel, chat, checkbox, collapsible, combobox, command, context-menu, date-range-picker, datepicker, dialog, drawer, dropdown, file-upload, form, hover-card, input, menubar, multi-select, navbar, navigation-menu, number-field, otp, pagination, pin-input, popover, progress, radio, resizable, scroll-area, select, separator, skeleton, slider, slider-range, switch, table, tabs, textarea, toggle-group, tooltip

**Starter components that remain**: Badge (Type I), Button (Type I), Toast (Type II).

**Breaking: All UI patterns removed.** The following patterns were removed from `src/ui/patterns/`:

auth-ui, checkout, data-table, modal-system, search-demo, sidebar

**Breaking: Standalone services removed from `src/services/`.**

- `CommandService.js` — replaced by `src/runtime/CommandRegistry.js` contribution model
- `DateService.js` — removed without replacement
- `SliderService.js` — removed with slider component
- `TableService.js` — removed with table component

**Services that remain**: `ExampleService.js`, `FileUploadService.js`, `PlatformService.js`, `core/`.

**Breaking: Skills directory relocated.** Project-specific skill files moved from `skills/` to `docs/csma-*/SKILL.md`:
- `skills/csma-architecture.md` -> `docs/csma-architecture/SKILL.md`
- `skills/csma-ui-components.md` -> merged into `docs/csma-architecture/SKILL.md`
- `skills/csma-service-pattern.md` -> `docs/csma-service-pattern/SKILL.md`
- `skills/csma-patterns.md` -> `docs/csma-patterns/SKILL.md`
- `skills/csma-design-blocks.md` -> removed (content merged into patterns skill)

### Migration Guide (1.x -> 2.0)

1. If you used any removed component, copy its folder from commit `ec84a73` into your project before upgrading.
2. If you imported `CommandService`, `DateService`, `SliderService`, or `TableService`, switch to module-local services or the registry contribution pattern.
3. Update any `skills/` path references to `docs/csma-*/SKILL.md`.
4. The module system, EventBus, Contracts, and all 20 feature modules are unchanged — no migration needed for module-level code.

## [1.2.0] - 2026-03-19

### Added

- canonical UI theme contract in `src/css/theme.css` for semantic tokens, layer tokens, and shared component recipe tokens
- standalone demo pages for every component under `src/ui/components/*`
- explicit `demoPath` coverage for all registered components in `src/ui/components/component-registry.js`
- `componentDependencies` metadata for JS-backed UI components to document copy-paste integration requirements
- automated `check:ui-library` validation to verify registry coverage, demo coverage, canonical explorer links, and component dependency metadata

### Changed

- made `src/ui/components/index.html` the canonical component explorer entrypoint for docs and demos
- updated docs and skills to use the current `src/css/*`, `src/runtime/*`, explorer, and component dependency contracts
- standardized component demos to link back to the canonical explorer anchors
- aligned overlay components with centralized layer tokens from `src/css/theme.css`
- extended carousel and file-upload styling to use theme tokens instead of component-local fallback colors

### Fixed

- removed stale `demos.html` and `src/css/components.css` references across docs, demos, and patterns
- completed component registry coverage for missing components and explicit demo paths
- removed hidden copy-paste dependency gaps by documenting non-local runtime/shared dependencies in JS-backed components
- removed unsupported `data-theme="zinc"` demo scaffolding from dropdown demos
- reduced remaining theme-contract leaks in components such as alert, breadcrumb, context-menu, datepicker, file-upload, and carousel

## [1.1.0] - 2026-03-10

### Added

- modules-first extension runtime with lifecycle-safe contribution registries for commands, routes, navigation, panels, and adapters
- canonical module manifest validation and module contribution ownership tracking
- example module contributions that demonstrate command, route, navigation, panel, and adapter registration
- module authoring guide in `docs/guides/building-modules.md`
- targeted regression coverage for module registries, manifest validation, and load/unload cleanup

### Changed

- standardized `src/modules/*/index.js` manifests with required `id` and `services`
- updated `ModuleManager` to validate manifests, register contributions on load, and remove them on unload
- exposed registries through `window.csma` and the shared runtime boot path
- updated README, AGENTS, docs, and skills to position CSMA as modules-first and keep contracts as the validation boundary

### Fixed

- route contributions can now be detached cleanly because the router supports unregistering paths
- module lifecycle events and contribution lifecycle events now have runtime contracts

### Deferred

- plugin runtime, sandboxing, SDK, marketplace, and third-party install flows remain intentionally out of scope

[Unreleased]: https://github.com/yagaltd/CSMA/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/yagaltd/CSMA/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/yagaltd/CSMA/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/yagaltd/CSMA/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/yagaltd/CSMA/releases/tag/v1.1.0
