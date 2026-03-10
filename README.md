# CSMA Template

A robust, modules-first, framework-free application template built on the CSMA (Client-Side Microservices Architecture) pattern.

CSMA is designed for teams who want a secure, reactive, portable frontend runtime without React, Astro, or Svelte. This template includes hardened lifecycle ownership, contract-validated runtime boundaries, modular extension points, and a growing vanilla JS component system for web, mobile, and desktop apps.

## Features

✅ **Zero frameworks** - Pure vanilla JavaScript<br>
✅ **17KB gzipped** - Minimal bundle size<br>
✅ **CSS-class reactivity** - 10x faster than manual DOM manipulation<br>
✅ **Zero-trust security** - CSP, contracts, sanitization, honeypot, rate limiting<br>
✅ **Type-safe EventBus** - Contract-validated pub/sub<br>
✅ **Lifecycle-safe runtime** - Explicit cleanup, unload-safe modules, leak-resistant services<br>
✅ **Modules-first extension model** - Commands, routes, navigation, panels, adapters<br>
✅ **Telemetry/Analytics** - LogAccumulator with CSS tracking<br>
✅ **SEO-ready** - MetaManager for meta tags<br>
✅ **Dark mode** - Theme switching via CSS custom properties<br>

## Template Usage

This repository is a template source for developers to copy into their local repo and customize.

If you prefer guided setup with selective template extraction, use:

- https://github.com/yagaltd/csma-ssma-cli/

## SSMA Gateway Middleware (JavaScript + Rust)

For CSMA projects that need gateway middleware, see **SSMA**:

- Repository: https://github.com/yagaltd/SSMA
- Includes gateway middleware implementations in **JavaScript** and **Rust**.

Use this CSMA template for the client/app side, and SSMA when you need gateway/runtime integration.

## What You Get in This Template

- CSMA runtime (`src/runtime`)
- Modular services and contracts (`src/modules`, `src/services`)
- Modules-first extension model with contribution registries (`commandRegistry`, `routeRegistry`, `navigationRegistry`, `panelRegistry`, `adapterRegistry`)
- CSMA-compliant UI components and patterns (`src/ui`)
- Security and validation primitives
- Multi-target packaging hooks (web, Capacitor, Neutralino)
- Tests and examples

## UI Components

This template includes a growing set of CSMA-compliant vanilla JavaScript UI components built around:
- CSS-defined state
- EventBus-driven interaction
- contract-validated runtime behavior
- lifecycle-safe initialization and cleanup

The component library lives under `src/ui/components/`.

To explore the available components and interaction patterns, use the showcase page:
- `src/ui/components/index.html`

The showcase is intended as the live reference for component behavior, structure, and styling while the standalone `*.demo.html` files remain useful as isolated per-component smoke fixtures.

## Extension Model

CSMA is **modules-first**.

The supported extension story in this template is:
- trusted modules under `src/modules/*`
- `Contracts` for payload validation and security
- contribution registries for commands, routes, navigation, panels, and adapters
- lifecycle-safe load/unload through `ModuleManager`, `ServiceManager`, and `destroyApp()`

CSMA does **not** currently treat plugins as a core requirement. If you need to add app features, integrations, or backend adapters, start with a module.

## Building Modules

- Canonical module shape: `manifest`, `services`, optional `contracts`, optional `manifest.contributes`
- Use `src/modules/example-module/` as the copy/adapt scaffold
- See `docs/guides/building-modules.md` for the manifest and registry contract

## AI System Map

`ai-system-map.json` is a machine-readable map of the runtime/modules for automation and AI coding agents. 

Reference: `docs/operations/ai-system-map.md`

## AI Agent Guidance

If you use AI coding agents in this repo:
- `AGENTS.md` is the human-readable agent guide for architecture, rules, and extension patterns
- `ai-system-map.json` is the machine-readable repo map for fast orientation
- `skills/` contains project-specific guidance for CSMA architecture, services, and UI components

## Docs

- Main docs index: `docs/README.md`
- Getting started: `docs/guides/getting-started.md`
- CSMA overview: `docs/guides/csma-in-a-nutshell.md`
- Module authoring: `docs/guides/building-modules.md`
- Full guide: `docs/complete-csma-guide.md`
- Template catalog details: `templates/README.md`

## Acknowledgements

- [Enrico Piovesan](https://medium.com/@enricopiovesan) - For the numerous articles on Client-Side Microservices Architecture
- Inspired by [JurisJS](https://github.com/jurisjs/juris) and [VanJS](https://github.com/vanjs-org/van)

## License

MIT
