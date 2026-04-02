---
name: csma-runtime
version: "1.1.0"
description: >-
  Expert guidance on how the CSMA application starts, wires itself together,
  and runs. Covers bootstrap lifecycle, feature flags, ServiceManager,
  ModuleManager, registry internals, CSS layer architecture, theme system,
  error propagation, observability seams, dev tools, module catalog, and build
  tooling. Use this when you need to understand how to plug code into the
  runtime, enable features, or debug the startup sequence.
tags:
  - bootstrap
  - runtime
  - service-manager
  - module-manager
  - registries
  - config
  - css-layers
  - modules
  - build
related_files:
  - src/main.js
  - src/bootstrap/runtime.js
  - src/bootstrap/features.js
  - src/bootstrap/theme.js
  - src/config.js
  - src/runtime/ServiceManager.js
  - src/runtime/ModuleManager.js
  - src/runtime/ContributionRegistry.js
  - src/runtime/ViewRegistry.js
  - src/runtime/LogAccumulator.js
  - src/runtime/diagnosticSnapshot.js
  - src/modules/analytics/services/AnalyticsService.js
  - src/css/main.css
---

# CSMA Runtime Skill

How the CSMA application starts, wires itself together, and runs.

## Bootstrap Lifecycle

`src/main.js` waits for `DOMContentLoaded`, then calls `init()`:

```
1. createRuntimeState()       -- EventBus, ServiceManager, registries, core services
2. loadOptionalFeatures()     -- dynamic imports gated by FEATURES flags
3. initUI(eventBus)           -- component init (Toast, etc.)
4. setupThemeToggle(eventBus) -- theme button wiring
5. loadTheme()                -- resolve persisted / system-preference theme
6. syncWindowRuntime()        -- expose runtime services on window.csma
7. publish('PAGE_CHANGED')    -- announce initial page load
```

`init()` is promise-gated -- calling it twice is a no-op.

### createRuntimeState()

In `src/bootstrap/runtime.js`. Creates in this order:

1. **EventBus** -- attaches `Contracts` as the validation layer
2. **ServiceManager** -- service registry and lifecycle
3. **ChannelManager** -- channel subscription orchestration
4. **MetaManager** -- page meta / title management
5. **LogAccumulator** -- local diagnostics observer, error/security logging, snapshot/export source
6. **CrossTabLeader** -- cross-tab leader election
7. **6 Registries** (see Registries section below)
8. **ModuleManager** -- receives eventBus, serviceManager, registries

Core services registered immediately:

| Name | Instance | Purpose |
|------|----------|---------|
| `leader` | CrossTabLeader | Tab leader election |
| `example` | ExampleService | Example service (safe to replace) |
| `platform` | PlatformService | Platform detection (Capacitor, Neutralino, web) |
| `channels` | ChannelManager | Channel subscriptions |
| `commandRegistry` | CommandRegistry | Module command contributions |
| `routeRegistry` | RouteRegistry | Module route contributions |
| `navigationRegistry` | NavigationRegistry | Module nav contributions |
| `panelRegistry` | PanelRegistry | Module panel contributions |
| `adapterRegistry` | AdapterRegistry | Module adapter contributions |
| `viewRegistry` | ViewRegistry | Module view contributions |

### loadOptionalFeatures()

In `src/bootstrap/features.js`. Iterates `FEATURES` flags and dynamically
imports modules:

```javascript
if (FEATURES.ROUTER) {
    await moduleManager.loadModule('router');
    const routerService = serviceManager.get('Router');
    state.routerServiceRef = routerService;
    registries.routes.attachRouter(routerService);
}
```

Each enabled module is loaded via `ModuleManager.loadModule()`, which
validates the manifest, registers contributions in registries, and
registers services in ServiceManager.

### Observability split

Current observability architecture is intentionally split:

- `src/runtime/LogAccumulator.js`
  - local runtime diagnostics only
  - records errors, attacks, and contract violations
  - owns `diagnosticSnapshot()` and structured export surface
  - integrates `ErrorBoundary`
- `src/modules/analytics/services/AnalyticsService.js`
  - outbound telemetry and website analytics
  - page views, custom analytics events, batching, classification, aggregation
  - SEO audit enrichment and consent gating
- `src/runtime/diagnosticSnapshot.js`
  - merges local runtime diagnostics with analytics session summary data
- `src/runtime/seoAudit.js`
  - synchronous DOM audit used by page-view analytics and runtime inspection

Important rule:
- do not reintroduce outbound analytics methods on `LogAccumulator`
- analytics ownership stays in `src/modules/analytics/`
- `window.csma.logAccumulator` and `window.csma.analytics` are separate by design

### destroyApp()

Teardown runs in reverse order, each step wrapped in try/catch:

1. Clear welcome timer
2. Unsubscribe auth access listener
3. Theme toggle cleanup
4. UI cleanup (component listeners)
5. `moduleManager.destroy()` -- unload all modules
6. Unregister non-core services (in reverse registration order)
7. `serviceManager.destroyAll()` -- core services
8. analytics consent UI cleanup and feature cleanups
9. `metaManager.destroy()`, `logAccumulator.destroy()`
10. Null out `window.csma` references

## Feature Flags

`src/config.js` exports `FEATURES`:

```javascript
import { isEnabled, requireFeature, FEATURES } from './config.js';

isEnabled('CACHE_MANAGER')      // true
requireFeature('LLM_INSTRUCTOR') // throws if not enabled
```

### Flag Categories

**Always enabled:** `VALIDATION`, `EVENT_BUS`, `SERVICE_MANAGER`

**Optional modules:** `PWA`, `ROUTER`, `I18N`, `INDEXEDDB`, `LLM_INSTRUCTOR`

**Core services (Tier 3):** `CACHE_MANAGER`, `DATA_AGGREGATOR`,
`API_WRAPPER`, `AUTH_SERVICE`, `FORM_VALIDATOR`

**Module toggles:** `FORM_MANAGEMENT`, `MODAL_SYSTEM`, `CHECKOUT_MODULE`,
`NETWORK_STATUS_MODULE`, `SYNC_QUEUE`, `OPTIMISTIC_SYNC`, `STATIC_RENDER`,
`SEARCH_MODULE`, `AI_MODULE`, `MEDIA_CAPTURE`, `CAMERA_MODULE`,
`LOCATION_MODULE`, `MEDIA_TRANSFORM`, `IMAGE_OPTIMIZER`

**Observability toggles:** `ANALYTICS_MODULE`, `ANALYTICS_CONSENT`

**Platform-detected (runtime):** `FILE_SYSTEM`, `CAMERA`, `NOTIFICATIONS`,
`SERVICE_WORKER`, `GEOLOCATION`, `VIBRATION`

## ServiceManager API

`src/runtime/ServiceManager.js`:

```javascript
sm.register(name, instance, metadata?)   // Register a service
sm.get(name)                             // Retrieve by name (throws if missing)
sm.unregister(name)                      // Remove + call instance.cleanup()
sm.getAllStatus()                        // Array of { name, version, description }
sm.destroyAll()                          // Teardown all services
```

Core services (registered at bootstrap) cannot be overwritten. Module
services are registered dynamically during `loadOptionalFeatures()`.

### Registration with Metadata

```javascript
serviceManager.register('auth', authService, {
    version: '1.0.0',
    description: 'HTTP cookie-based authentication client'
});
```

Observability-related service names now used in the repo:

- `analytics`
- `analyticsConsent`
- `channels`
- `leader`

## ModuleManager API

`src/runtime/ModuleManager.js`:

```javascript
mm.loadModule(moduleId)     // Dynamic import + validate + register
mm.unloadModule(moduleId)   // Unregister contributions + services + cleanup
mm.destroy()                // Teardown all loaded modules
```

### Dynamic Loading

`loadModule('ai')` triggers:

1. `import('../modules/ai/index.js')`
2. `validateModuleDefinition()` from `ModuleManifest.js`
3. Register declared services with ServiceManager
4. Register declared contributions with appropriate registries
5. Publish `MODULE_LOADED` event

### Rollback on Failure

If any step fails during loading, all already-registered contributions and
services are unwound automatically. A `MODULE_LOAD_FAILED` event is published.

### Manifest Validation

`src/runtime/ModuleManifest.js` validates:

- `id` -- required, string
- `name` -- required, string
- `version` -- required, semver string
- `services` -- required, array of service names
- `contributes` -- optional object with arrays: `commands`, `routes`,
  `navigation`, `panels`, `adapters`, `views`

Use `src/modules/example-module/` as the canonical scaffold.

## Runtime Surface

`syncWindowRuntime()` in `src/bootstrap/runtime.js` keeps the public runtime
surface aligned with loaded services. Relevant observability exports:

- `window.csma.logAccumulator`
- `window.csma.analytics`
- `window.csma.analyticsConsent`
- `window.csma.diagnose()`
- `window.csma.seoAudit()`

Use these as inspection/debug surfaces. They are not a substitute for service
lookup through `ServiceManager` inside app code.

## Contribution Registries

All 7 registries extend `ContributionRegistry`
(`src/runtime/ContributionRegistry.js`):

```javascript
registry.register(moduleId, entry)       // Add contribution owned by module
registry.unregister(moduleId, id)        // Remove specific entry
registry.unregisterAll(moduleId)         // Remove all entries by module
registry.getAll()                        // Get all entries
registry.getByModule(moduleId)           // Get entries by owner
```

Events emitted:
- `MODULE_CONTRIBUTION_REGISTERED`
- `MODULE_CONTRIBUTION_UNREGISTERED`

### CommandRegistry

Dispatches commands to service methods:

```javascript
{
    id: 'checkout.submit',
    title: 'Submit checkout',
    handlerService: 'checkout',   // serviceManager.get('checkout')
    handlerMethod: 'submit'       // checkoutService.submit()
}
```

### ViewRegistry

Render mode registry with security validation:

```javascript
{
    id: 'cart-view',
    renderMode: 'replace',         // replace | append | prepend | update | remove
    target: '#cart-container',
    allowedTargets: ['#cart-container', '#main'],  // security: restricts targets
    props: { items: array() },     // props schema
    state: { loading: boolean() }, // state schema
    moduleName: 'checkout'
}
```

Handles `INTENT_VIEW_RENDER` events. Validates `allowedTargets`, `props`,
and `state` against schemas. Publishes `VIEW_RENDERED` or
`VIEW_RENDER_FAILED`.

## Diagnostics and Error Flow

`ErrorBoundary` is no longer buried inside a monolithic accumulator.

Runtime error path:
1. runtime event or thrown error is observed
2. `LogAccumulator` records local diagnostic entry
3. `ErrorBoundary` decides overlay/rendering behavior
4. analytics module may independently emit outbound error telemetry if enabled and consent allows it

Contract failures are expected to remain locally visible even if analytics is
disabled. This separation is intentional.

## CSS Layer Architecture

Import order in `src/css/main.css` -- later files override earlier ones:

```
1. base.css                        # Reset / normalize
2. theme.css                       # Theme token application
3. generated/tokens.css            # Auto-generated design tokens (never edit)
4. foundation/utilities.css        # Layout utilities (.stack, .grid, .cluster)
5. foundation/hardening.css        # Security hardening styles
6. foundation/motion.css           # Animation utilities
7. foundation/print.css            # Print styles
8. ../ui/components/index.css      # Component CSS aggregation
```

To customize tokens: edit `design-tokens.json`, run
`bun run generate-tokens`, then `tokens.css` is regenerated.

## Theme System

`src/bootstrap/theme.js`:

```javascript
setupThemeToggle(eventBus)   // Wires #theme-toggle or #themeToggle button
loadTheme()                  // Resolves: localStorage -> system preference -> 'light'
```

Theme is persisted via `localStorage.setItem('theme', theme)`.
CSS is driven by `document.documentElement.dataset.theme = 'light' | 'dark'`.
Event: `eventBus.publish('THEME_CHANGED', { theme })` on toggle.

## Runtime Services Reference

| Service | File | Purpose |
|---------|------|---------|
| CrossTabLeader | `src/runtime/CrossTabLeader.js` | Leader election across browser tabs |
| ChannelManager | `src/runtime/ChannelManager.js` | Channel subscription orchestration |
| LogAccumulator | `src/runtime/LogAccumulator.js` | Local diagnostics, error/security logging, snapshot export |
| ErrorBoundary | `src/runtime/ErrorBoundary.js` | Runtime error overlay and sanitized error presentation |
| AnalyticsService | `src/modules/analytics/services/AnalyticsService.js` | Outbound telemetry, website analytics, consent-aware batching |
| MetaManager | `src/runtime/MetaManager.js` | Page title, OpenGraph, Twitter Card management |
| ThreadManager | `src/runtime/ThreadManager.js` | Web Worker lifecycle (Tier 4) |
| LifecycleScope | `src/runtime/LifecycleScope.js` | Scoped cleanup for timers, observers, listeners |
| RateLimiter | `src/runtime/RateLimiter.js` | Per-event rate limiting used by EventBus |

## Module Catalog

20 feature modules under `src/modules/`:

| Module | Purpose | Enabled by Default |
|--------|---------|---------------------|
| `ai` | LLM orchestration (OpenAI-compatible, SSMA gateway) | no |
| `camera` | Camera / photo access via platform API | no |
| `checkout` | Cart + payment flow orchestration | yes |
| `data-table` | Data table utilities | no |
| `example-module` | Canonical module scaffold (use as template) | -- |
| `file-system` | File system access via platform API | auto |
| `form-management` | Form state management | yes |
| `i18n` | Internationalization / translations | no |
| `image-optimizer` | Client-side image optimization | no |
| `location` | Geolocation tracking + geofence | no |
| `media-capture` | Audio recording module | no |
| `media-transform` | Client-side media conversions | no |
| `modal-system` | Modal stack controller | yes |
| `network-status` | Online / offline detection + latency | yes |
| `optimistic-sync` | Cross-tab optimistic sync | yes |
| `router` | Hash-based SPA routing | no |
| `search` | FlexSearch-powered search | no |
| `static-render` | Build-time static page generation | yes |
| `storage` | IndexedDB / localStorage abstraction | no |
| `sync-queue` | Background sync queue | yes |

Enable modules via `FEATURES` flags in `src/config.js`.

## Error Propagation

### EventBus Errors

- Contract validation failure -> throws Error
- Rate limit exceeded -> event silently dropped, `SECURITY_RATE_LIMITED` published

### Module Load Rollback

If `loadModule()` fails during service registration, all already-registered
contributions and services are unwound. `MODULE_LOAD_FAILED` is published.

### destroyApp() Resilience

Each teardown step is wrapped in try/catch so partial failures do not block
remaining cleanup. Warnings are logged to console.

## Dev Tools

### window.csma

Populated by `syncWindowRuntime()` in `src/bootstrap/runtime.js`:

```javascript
window.csma = {
    eventBus,           // Direct EventBus access
    serviceManager,     // serviceManager.get(name)
    moduleManager,      // loadModule / unloadModule
    registries,         // All 7 registries
    logAccumulator,     // Runtime/error/security logs
    analytics,          // Phase 1 extracted analytics service
    exportAnalytics(),  // Export current analytics payload snapshot
    destroyApp          // Clean teardown
};
```

### Design Token Debugging

`src/runtime/dev/` contains development utilities:
- `dtcg-reader.js` -- Parse and inspect `design-tokens.json`
- `token-inspector.js` -- Validate generated CSS tokens match source JSON

## Build Tooling

Build system: **Vite** (HMR in dev, tree-shaking in production).

```bash
npm run dev              # Start dev server with HMR
npm run build            # Production build to dist/
npm run test             # vitest (unit / smoke / a11y)
npm run generate-map     # Update ai-system-map.json
npm run generate-tokens  # design-tokens.json -> src/css/generated/tokens.css
```

Tree-shaking: `FEATURES` flags in `src/config.js` control dead code
elimination. Modules set to `false` are never imported, so Vite removes
them entirely from the production bundle.

`import.meta.env.DEV` auto-enables dev-only features.

## What To Watch For

- Do not call `createRuntimeState()` directly -- use `init()` in `main.js`
- Do not register services before `createRuntimeState()` completes
- Do not edit `src/css/generated/tokens.css` -- edit `design-tokens.json`
- Do not load modules directly -- use `ModuleManager.loadModule()` or `FEATURES` flags
- Do not bypass `ContributionRegistry` ownership -- always pass `moduleId`
- Do not modify CSS import order -- later files override earlier ones
- Do not forget to return cleanup functions from init / setup calls
- Do not skip `destroyApp()` when hot-reloading -- prevents memory leaks
