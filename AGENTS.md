# AGENTS.md - AI Coding Agent Guide

> Quick reference for AI agents working in this CSMA codebase.

## Project Overview

CSMA (Client-Side Microservices Architecture) - Lean, secure, reactive vanilla JS framework.
- Bundle: ~17KB gzipped
- Reactivity: CSS-class pattern (10x faster than manual DOM)
- Security: 6-layer zero-trust validation

## Skills for AI Agents

Project-specific skills are in `skills/`:

| Skill | Purpose |
|-------|---------|
| `csma-architecture.md` | 6 rules, EventBus patterns, contracts, security |
| `csma-ui-components.md` | CSS tokens, component structure, theming |
| `csma-service-pattern.md` | Service templates, state management |

**Usage**: Read these files for detailed patterns when building CSMA components or services.

## Key Directories

| Path | Purpose |
|------|---------|
| `src/runtime/` | EventBus, ServiceManager, Contracts, Validation |
| `src/ui/components/` | Atomic UI components (Button, Dialog, Toast, etc.) |
| `src/ui/patterns/` | Composite patterns (AuthUI, DataTable, Sidebar) |
| `src/modules/` | Feature modules with services + contracts |
| `src/css/foundation/` | Design tokens, themes, base styles |

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
- require unload-safe ownership for services, contributions, listeners, timers, observers, and channels

## CSMA Component Types

| Type | Pattern | Example |
|------|---------|---------|
| I | Pure CSS, no JS | Badge, Card, Avatar |
| II | `init[Name]System(eventBus)` | Dialog, Toast, Tabs |
| III | `create[Name]Service()` + UI | Slider (SliderService) |

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
    adapters: []
  }
};
```

Use `src/modules/example-module/` as the module scaffold.

## CSS Token System

All components use `--fx-*` tokens from `src/css/foundation/tokens.css`:
- Colors: `--fx-color-primary`, `--fx-color-danger`, etc.
- Spacing: `--fx-space-sm`, `--fx-space-lg`, etc.
- Radii: `--fx-radius-md`, `--fx-radius-lg`, etc.

Theme switching: `document.documentElement.dataset.theme = 'dark'`

## Adding Components

1. Create in `src/ui/components/[name]/`
2. Register in `src/ui/init.js` (import + init + cleanup)
3. Define contracts in `src/runtime/Contracts.js` (if using EventBus)

## Full Reference

- Architecture: `docs/guides/csma-in-a-nutshell.md`
- Building Components: `docs/guides/building-components.md`
- Building Modules: `docs/guides/building-modules.md`
- CSS Foundation: `docs/css-foundation.md`
- Project Map: `ai-system-map.json` (auto-generated)

## Quick Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test         # Run tests
npm run generate-map # Update ai-system-map.json
```
