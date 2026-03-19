# Changelog

All notable changes to this repository should be documented in this file.

The format is based on Keep a Changelog and this project uses Semantic Versioning.

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
