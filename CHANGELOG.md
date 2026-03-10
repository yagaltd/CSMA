# Changelog

All notable changes to this repository should be documented in this file.

The format is based on Keep a Changelog and this project uses Semantic Versioning.

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
