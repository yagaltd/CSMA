# AGENTS.md - AI Coding Agent Guide

> Quick reference for AI agents working in this CSMA codebase.

## Project Overview

CSMA (Client-Side Microservices Architecture) - Lean, secure, reactive vanilla JS framework.
- Bundle: ~17KB gzipped
- Reactivity: CSS-class pattern (10x faster than manual DOM)
- Security: 6-layer zero-trust validation
- Extension model: modules-first with lifecycle-safe contribution registries

## Prerequisites

- Node.js 18+
- Bun (for `npm run generate-tokens`)
- Vite (dev server + build)

## Skills for AI Agents

Project-specific skills live in `docs/`:

| Skill | Path | Purpose |
|-------|------|---------|
| CSMA Architecture | `docs/csma-architecture/SKILL.md` | 6 rules, EventBus patterns, contracts, component types, tokens |
| CSMA Rigor | `docs/csma-rigor/SKILL.md` | Decides when standard CSMA is enough and when to add property tests, service-local transitions, or stronger verification |
| CSMA Design | `docs/csma-design/SKILL.md` | Routes UI work across visual contract, structure contract, and UX contract |
| CSMA Patterns | `docs/csma-patterns/SKILL.md` | Pattern types, layout rules, composition |
| CSMA Services | `docs/csma-service-pattern/SKILL.md` | Service templates, state management, module contributions |
| CSMA Observability | `docs/csma-observability/SKILL.md` | LogAccumulator, analytics module, snapshots, consent |
| CSMA Testing | `docs/csma-testing/SKILL.md` | Test conventions, contract testing, module testing, accessibility |
| CSMA Security | `docs/csma-security/SKILL.md` | 6-layer security model, CSP, rate limiting, input sanitization |
| CSMA Runtime | `docs/csma-runtime/SKILL.md` | Bootstrap lifecycle, feature flags, ServiceManager, registries, observability seams, CSS layers, module catalog |

**Usage**: Read the relevant SKILL.md before building CSMA components, services, modules, or tests. When deciding test depth or lifecycle rigor for a module, start with `docs/csma-rigor/SKILL.md` and then follow its references into testing, service, security, or architecture guidance.

For UI work, the design split now lives in:
- `docs/csma-design/DESIGN.md` for visual rules
- `docs/csma-design/STRUCTURE.md` for primitives/archetypes/authoring rules
- `docs/csma-design/UX.md` for sitemap and flow definition

## Key Directories

| Path | Purpose |
|------|---------|
| `library/runtime/` | EventBus, ServiceManager, Contracts, Validation, Registries |
| `library/ui/components/` | Reusable UI primitives and controls |
| `library/ui/archetypes/` | Reusable layout and content archetypes |
| `library/modules/` | Reusable feature modules with services + contracts |
| `library/services/` | Core reusable services |
| `library/style/` | Theme contract, base styles, and generated library token CSS |
| `tooling/` | Generators, validators, schemas, and authoring scripts |
| `template/` | Starter project input the user copies and customizes |
| `demo/` | Example app plus generated preview/reference artifacts |

## Extension Model

CSMA is **modules-first**.

When extending the template:
- prefer `library/modules/*` or project-local modules over inventing a plugin layer
- keep `Contracts` as the validation/security boundary
- use runtime registries for module contributions:
  - `commandRegistry`
  - `routeRegistry`
  - `navigationRegistry`
  - `panelRegistry`
  - `adapterRegistry`
  - `viewRegistry`
- require unload-safe ownership for services, contributions, listeners, timers, observers, and channels

AI-specific guidance:
- `library/modules/ai/` is the frontend orchestration layer and may use SSMA as the backend gateway
- `library/modules/ai-ui/` owns CSMA-specific AI UI composition, archetype compilation, and validation
- `library/modules/ai/providers/SSMAGatewayProvider.js` now defaults to SSMA's public query boundary (`POST /query/:name`), not an ad hoc `/api/ai/generate` route
- AI must operate through registered commands and views, never through raw HTML or arbitrary DOM selectors

## CSMA Component Types

| Type | Pattern | Example |
|------|---------|---------|
| I | Pure CSS, no JS | Badge, Button |
| II | `init[Name]System(eventBus)` | Toast |

Current starter components: **Badge** (Type I), **Button** (Type I), **Card** (Type I), **Field** (Type I), **Input** (Type I), **Theme Toggle** (Type I), **Toast** (Type II).

## The 6 Rules

1. State changes = CSS classes/data attributes only
2. Define all states in CSS
3. JS publishes events, CSS handles rendering
4. Always validate (security first)
5. Use `data-*` for complex state
6. Components subscribe to own INTENT_* events

## EventBus Patterns

```javascript
// Subscribe (returns cleanup function)
const unsubscribe = eventBus.subscribe('EVENT_NAME', handler);

// Publish
eventBus.publish('INTENT_ACTION', { payload });

// Contracts validate payloads automatically
```

## Module Manifest Pattern

Every module should export:

```javascript
export const manifest = {
  id: 'feature-id',
  name: 'Feature Name',
  version: '1.0.0',
  description: 'What this module does',
  dependencies: [],
  services: ['featureService'],
  contracts: ['FEATURE_EVENT'],
  contributes: {
    commands: [],
    routes: [],
    navigation: [],
    panels: [],
    adapters: [],
    views: []
  }
};
```

Use `library/modules/example-module/` as the module scaffold for reusable modules.

## CSS Token System

Use generated token CSS as the canonical token contract.
- In app targets here: `demo/generated/tokens.css` and `template/generated/tokens.css`
- In a project created from the template: `generated/tokens.css`
- Never edit generated token CSS directly; edit the project `design-tokens.json` input and regenerate.
- Semantic theme tokens: `--background`, `--foreground`, `--primary`, `--border`, `--ring`, etc.
- Shared scales: `--space-*`, `--radius-*`, `--font-size-*`, `--shadow-*`
- Component recipe tokens: `--button-radius`, `--input-height`, `--card-shadow`, etc.
- New component work should use semantic, scale, and recipe tokens only.

Theme switching: `document.documentElement.dataset.theme = 'dark'`

Token pipeline: `<app>/design-tokens.json` -> `npm run generate-tokens [-- --app <app>]` -> `<app>/generated/tokens.css`

Shared generated tooling artifacts live under `tooling/generated/`. App-consumed generated assets live under each app’s own `generated/` directory.

## Adding Components

1. Create in `library/ui/components/[name]/`
2. Register in `library/ui/init.js` (import + init + cleanup)
3. Define contracts in `library/runtime/Contracts.js` (if using EventBus)
4. Add `@import` to `library/ui/components/index.css`

## Testing

Run with `npm run test` (vitest). Key scripts:

```bash
npm run test              # Full test suite
npm run test:contracts    # Contract validation only
npm run test:validation   # Input validation only
npm run test:smoke        # Todo-app smoke test
```

Test conventions:
- Tests live in `tests/` at repo root
- One test file per module/service: `tests/[module-name].test.js`
- Use vitest + jsdom; no browser required for unit tests
- E2E tests use Playwright: `npm run test:e2e`
- Test helpers in `tests/helpers/`
- Use `docs/csma-rigor/SKILL.md` first when deciding whether a module needs only standard tests, property tests, or service-local transitions
- See `docs/csma-testing/SKILL.md` for full testing patterns
- For logging/telemetry changes, also read `docs/csma-observability/SKILL.md`

## Commit Conventions

This repo uses **Conventional Commits**:

```
feat(scope): description
fix(scope): description
docs: description
refactor(scope): description
release: description
chore: description
```

Common scopes: `ui`, `runtime`, `modules`, `css`, `docs`, `tests`

## Anti-Patterns (Do Not)

- Do not add frameworks (React, Vue, Svelte, etc.) -- CSMA is vanilla JS
- Do not edit generated token CSS directly -- edit `design-tokens.json` and regenerate
- Do not bypass Contracts -- all EventBus payloads must be validated
- Do not use `innerHTML` for user data -- always use `textContent`
- Do not use inline styles for state changes -- use CSS classes or `data-*` attributes
- Do not hardcode colors/spacing -- use `var(--token)` for every visual value
- Do not put business logic in UI components -- keep components dumb, services smart
- Do not create plugin layers -- use the module system instead
- Do not modify `library/runtime/` validation schemas without updating corresponding tests

## Full Reference

- Architecture: `docs/csma-architecture/SKILL.md`
- Rigor selection: `docs/csma-rigor/SKILL.md`
- Building Components and Tokens: `docs/csma-architecture/SKILL.md`
- Building Modules and Registries: `docs/csma-runtime/SKILL.md`
- Observability and Telemetry: `docs/csma-observability/SKILL.md`
- Patterns and Composition: `docs/csma-patterns/SKILL.md`
- Project Map: `ai-system-map.json` (auto-generated)
- Documentation Index: `docs/README.md`

## Quick Commands

```bash
npm run dev              # Start dev server (Vite)
npm run build            # Production build
npm run test             # Run tests (vitest)
npm run generate-map     # Update ai-system-map.json
npm run generate-tokens  # Regenerate CSS tokens from design-tokens.json
```
