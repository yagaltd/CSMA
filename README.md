# CSMA Template

A robust, modules-first, framework-free application template built on the CSMA (Client-Side Microservices Architecture) pattern.

CSMA is designed for teams who want a secure, reactive, portable frontend runtime without React, Astro, or Svelte. This template includes hardened lifecycle ownership, contract-validated runtime boundaries, modular extension points, and a deliberately small vanilla JS starter surface for web, mobile, and desktop apps.

## Features

- **Zero frameworks** - Pure vanilla JavaScript
- **17KB gzipped** - Minimal bundle size
- **CSS-class reactivity** - 10x faster than manual DOM manipulation
- **Zero-trust security** - CSP, contracts, sanitization, honeypot, rate limiting
- **Type-safe EventBus** - Contract-validated pub/sub
- **Lifecycle-safe runtime** - Explicit cleanup, unload-safe modules, leak-resistant services
- **Modules-first extension model** - Commands, routes, navigation, panels, adapters, views
- **Observability split** - `LogAccumulator` for local diagnostics, analytics module for outbound telemetry and website analytics
- **SEO-ready** - MetaManager for meta tags
- **Dark mode** - Theme switching via CSS custom properties

## Quick Start

```bash
git clone <your-repo-url> csma && cd csma
npm install
npm run dev              # http://localhost:5173 with HMR
npm run build:prod       # production build to dist/
npm run test             # vitest unit tests
bun run generate-tokens  # regenerate CSS from design-tokens.json
```

Entry point: `src/main.js` boots the runtime and calls `initUI(eventBus)` from `src/ui/init.js`.

## Template Usage

This repository is a template source for developers to copy into their local repo and customize.

If you prefer guided setup with selective template extraction, use:

- https://github.com/yagaltd/csma-ssma-cli/

## Starting Paths

CSMA supports two practical frontend entry paths:

- **starter** - lean scaffold for smaller apps, uses lightweight seam files for `src/main.js` and `src/ui/init.js`. Intended for CLI-generated projects where you want a narrower default surface.
- **full** - preserves the full CSMA runtime/bootstrap structure from this repo. Intended when you want to start from the complete app shape and trim later only if needed.

For gateway middleware, SSMA remains an architecture choice in the CLI, not a CSMA mode. Choosing `csma-ssma` adds SSMA exactly as before.

## Delivery Presets

CSMA stays one template/framework with multiple delivery presets:

- `starter-csr` - lightweight starter bootstrap, CSR-only by default
- `full-csr` - full runtime CSR app
- `ssg-ready` - full runtime plus static export
- `ssr-ready` - `ssg-ready` plus Bun/Hono SSR with SSMA as the backend bridge

Current defaults in this repo:

- `template` uses `starter-csr`
- `demo` uses `full-csr`

Static export and SSR stay opt-in. A simple CDN site should use the normal CSMA template and opt into the `ssg-ready` path rather than switching to a separate framework.

## Generated Artifacts

Generated outputs are split by ownership:

- `tooling/generated/` for shared repo-level references such as AI catalogs and token/component reference JSON
- `<app>/generated/` for app-consumed assets such as `tokens.css`

`npm run generate-tokens` now generates app-local token CSS for `demo` and `template` by default. Use `npm run generate-tokens -- --app demo` or `--app template` to target one app.

## SSMA Gateway Middleware

For CSMA projects that need gateway middleware, see **SSMA**:

- Repository: https://github.com/yagaltd/SSMA
- Current runtime is **Rust**. The older JS gateway is archived in the SSMA repo.

Use this CSMA template for the client/app side, and SSMA when you need gateway/runtime integration.

## What You Get in This Template

- CSMA runtime (`src/runtime`)
- Modular services and contracts (`src/modules`, `src/services`)
- Modules-first extension model with contribution registries (`commandRegistry`, `routeRegistry`, `navigationRegistry`, `panelRegistry`, `adapterRegistry`, `viewRegistry`)
- Local diagnostics via `src/runtime/LogAccumulator.js` and outbound telemetry via `src/modules/analytics/`
- CSMA-compliant UI components and patterns (`src/ui`)
- Security and validation primitives
- Multi-target packaging hooks (web, Capacitor, Neutralino)
- Tests and examples

## UI Components

This template intentionally ships a small set of CSMA-compliant vanilla JavaScript UI components built around:
- CSS-defined state
- EventBus-driven interaction
- contract-validated runtime behavior
- lifecycle-safe initialization and cleanup

The component library lives under `src/ui/components/`. Three starter components ship by default:

| Component | Type | Location |
|-----------|------|----------|
| Button | Type I (pure CSS) | `src/ui/components/button/` |
| Badge | Type I (pure CSS) | `src/ui/components/badge/` |
| Toast | Type II (EventBus) | `src/ui/components/toast/` |

Each has a standalone `*.demo.html` for isolated testing. Additional UI should usually be introduced as modules or patterns instead of rebuilding a large generic component catalog in this repo.

## Extension Model

CSMA is **modules-first**.

The supported extension story in this template is:
- trusted modules under `src/modules/*`
- `Contracts` for payload validation and security
- contribution registries for commands, routes, navigation, panels, adapters, and views
- lifecycle-safe load/unload through `ModuleManager`, `ServiceManager`, and `destroyApp()`

AI work follows the same rule:
- `src/modules/ai/` is the frontend orchestration layer for AI requests and transport
- `src/modules/ai-ui/` is the CSMA-specific layer that exports safe command/view capabilities and validates AI UI actions
- AI must operate through runtime registries, not raw HTML, arbitrary selectors, or ad hoc DOM mutation

CSMA does **not** currently treat plugins as a core requirement. If you need to add app features, integrations, or backend adapters, start with a module.

## Building Modules

- Canonical module shape: `manifest`, `services`, optional `contracts`, optional `manifest.contributes`
- Use `src/modules/example-module/` as the copy/adapt scaffold
- See `docs/csma-runtime/SKILL.md` for the manifest and registry contracts

## AI Agent Guidance

If you use AI coding agents in this repo:
- `AGENTS.md` is the human-readable agent guide for architecture, rules, and extension patterns
- `ai-system-map.json` is the machine-readable repo map for fast orientation
- `docs/csma-*/SKILL.md` contains project-specific skills for CSMA architecture, services, patterns, runtime, observability, security, and testing

## Docs

- Main docs index: `docs/README.md`
- AI skills: `docs/csma-architecture/SKILL.md`, `docs/csma-runtime/SKILL.md`, `docs/csma-observability/SKILL.md`, `docs/csma-patterns/SKILL.md`, `docs/csma-service-pattern/SKILL.md`, `docs/csma-security/SKILL.md`, `docs/csma-testing/SKILL.md`
- Examples: `examples/todo-app/`
- Platforms: `platforms/mobile-capacitor/DEPLOYMENT.md`, `platforms/desktop-neutralino/DEPLOYMENT.md`
- Template catalog: `templates/README.md`

## Acknowledgements

- [Enrico Piovesan](https://medium.com/@enricopiovesan) - For the numerous articles on Client-Side Microservices Architecture
- Inspired by [JurisJS](https://github.com/jurisjs/juris) and [VanJS](https://github.com/vanjs-org/van)

## License

MIT
