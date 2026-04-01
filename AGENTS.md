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
| CSMA Patterns | `docs/csma-patterns/SKILL.md` | Pattern types, layout rules, composition |
| CSMA Services | `docs/csma-service-pattern/SKILL.md` | Service templates, state management, module contributions |
| CSMA Observability | `docs/csma-observability/SKILL.md` | LogAccumulator, analytics module, snapshots, consent, devtools |
| CSMA Testing | `docs/csma-testing/SKILL.md` | Test conventions, contract testing, module testing, accessibility |
| CSMA Security | `docs/csma-security/SKILL.md` | 6-layer security model, CSP, rate limiting, input sanitization |
| CSMA Runtime | `docs/csma-runtime/SKILL.md` | Bootstrap lifecycle, feature flags, ServiceManager, registries, observability seams, CSS layers, module catalog |

**Usage**: Read the relevant SKILL.md before building CSMA components, services, modules, or tests.

## Key Directories

| Path | Purpose |
|------|---------|
| `src/runtime/` | EventBus, ServiceManager, Contracts, Validation, Registries |
| `src/ui/components/` | Starter UI components (Button, Badge, Toast) |
| `src/modules/` | Feature modules with services + contracts |
| `src/services/` | Core services (ExampleService, FileUploadService, PlatformService) |
| `src/css/` | Theme contract, base styles, design tokens |
| `src/css/foundation/` | Utilities, motion, print, hardening |
| `src/css/generated/` | Auto-generated design token CSS (never edit directly) |
| `src/bootstrap/` | Starter/full bootstrap seam files |

## Extension Model

CSMA is **modules-first**.

When extending the template:
- prefer `src/modules/*` over inventing a plugin layer
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
- `src/modules/ai/` is the frontend orchestration layer and may use SSMA as the backend gateway
- `src/modules/ai-ui/` owns CSMA-specific AI capability export/validation
- `src/modules/ai/providers/SSMAGatewayProvider.js` now defaults to SSMA's public query boundary (`POST /query/:name`), not an ad hoc `/api/ai/generate` route
- AI must operate through registered commands and views, never through raw HTML or arbitrary DOM selectors

## CSMA Component Types

| Type | Pattern | Example |
|------|---------|---------|
| I | Pure CSS, no JS | Badge, Button |
| II | `init[Name]System(eventBus)` | Toast |

Current starter components: **Badge** (Type I), **Button** (Type I), **Toast** (Type II).

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

Use `src/modules/example-module/` as the module scaffold.

## CSS Token System

Use `src/css/theme.css` as the canonical token contract:
- Semantic theme tokens: `--background`, `--foreground`, `--primary`, `--border`, `--ring`, etc.
- Shared scales: `--space-*`, `--radius-*`, `--font-size-*`, `--shadow-*`
- Component recipe tokens: `--button-radius`, `--input-height`, `--card-shadow`, etc.
- New component work should use semantic, scale, and recipe tokens only.

Theme switching: `document.documentElement.dataset.theme = 'dark'`

Token pipeline: `design-tokens.json` -> `bun run scripts/generate-tokens.js` -> `src/css/generated/tokens.css` (never edit tokens.css directly).

## Adding Components

1. Create in `src/ui/components/[name]/`
2. Register in `src/ui/init.js` (import + init + cleanup)
3. Define contracts in `src/runtime/Contracts.js` (if using EventBus)
4. Add `@import` to `src/ui/components/index.css`

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
- Do not edit `src/css/generated/tokens.css` directly -- edit `design-tokens.json` and regenerate
- Do not bypass Contracts -- all EventBus payloads must be validated
- Do not use `innerHTML` for user data -- always use `textContent`
- Do not use inline styles for state changes -- use CSS classes or `data-*` attributes
- Do not hardcode colors/spacing -- use `var(--token)` for every visual value
- Do not put business logic in UI components -- keep components dumb, services smart
- Do not create plugin layers -- use the module system instead
- Do not modify `src/runtime/` validation schemas without updating corresponding tests

## Full Reference

- Architecture: `docs/csma-architecture/SKILL.md`
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
