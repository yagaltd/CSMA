# Changelog

All notable changes to this repository should be documented in this file.

The format is based on Keep a Changelog and this project uses Semantic Versioning.

## [2.0.0] - 2026-04-01

### Added

- `docs/csma-observability/SKILL.md` as the dedicated agent-facing reference for diagnostics, telemetry, consent, snapshot, and devtools ownership

### Changed

- documented the completed observability refactor in top-level docs and agent guidance
- clarified the architecture split between local diagnostics (`LogAccumulator`) and outbound telemetry / website analytics (`src/modules/analytics/`)
- aligned `SSMAGatewayProvider` with SSMA's public query boundary instead of the older ad hoc AI route
- updated template metadata to reflect the current starter component set instead of removed UI components and patterns

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

### Added

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

- component registry updated to reflect starter set (Badge, Button, Toast)
- component showcase rewritten as SPA with layout styles
- AGENTS.md updated: fixed stale skill references, added testing/commit/anti-pattern sections
- existing test files updated for current runtime API surface

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
