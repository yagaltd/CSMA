# CSMA

> A robust, modules-first, framework-free application template built on the
> **Client-Side Microservices Architecture** pattern.

Zero frameworks. Zero virtual DOM. Vanilla JavaScript, token-driven CSS, and a
reactive tree-shakable runtime that stays small and stays fast.

## Features

✅ **Zero frameworks** — Pure vanilla JavaScript, no React, no Vue, no Svelte  
✅ **~5KB gzipped runtime** — EventBus, Contracts, ModuleManager, runtime navigation primitives  
✅ **CSS-class reactivity** — State changes via `data-*` attributes, not inline styles  
✅ **Zero-trust security** — CSP, contract validation, sanitization, honeypot, rate limiting  
✅ **Type-safe EventBus** — Every payload validated by schema before it reaches a handler  
✅ **Lifecycle-safe runtime** — Explicit cleanup, unload-safe modules, leak-resistant services  
✅ **Modules-first extension model** — Commands, navigation, panels, adapters, views  
✅ **Design-token-first** — One `design-tokens.json` drives every color, spacing, radius, shadow  
✅ **Dark mode** — Light / dark / contrast themes via CSS custom properties  
✅ **SSMA-ready** — Optimistic sync module connects to the Rust gateway out of the box  

## What is CSMA

CSMA separates concerns the way the web was meant to:

- **JavaScript manages state** — Services publish events, modules register contributions
- **CSS handles rendering** — Visual state lives in classes and `data-*` attributes, never inline styles
- **Contracts enforce boundaries** — Every EventBus payload is validated before it fires

This gives you reactive UI without a framework, a security boundary without a
backend, and a module system without a plugin marketplace.

## Quick Start

```bash
git clone https://github.com/yagaltd/CSMA.git my-app
cd my-app
npm install
npm run tokens    # regenerate CSS from the current token seed
npm run dev       # opens /frontend/ when present, else /demo/
```

Default dev entrypoints:

- `npm run dev`:
  opens `/frontend/` when `frontend/index.html` exists, otherwise `/demo/`
- `npm run dev:demo`:
  always opens `/demo/`
- `npm run dev:showcase`:
  always opens `/showcase/token-showcase.html`

Open `http://localhost:5173/demo/` to see the demo app running on the real CSMA
runtime. It is a todo-based reference surface with a few module examples, not
just a standalone todo tutorial. Treat it as a smoke test and reference
implementation, not the final shape of your app.

Open `http://localhost:5173/showcase/token-showcase.html` after token edits to
inspect the current palette, typography, spacing, layout primitives, shape,
elevation, components, motion, and light/dark/contrast themes. For token work,
this showcase inspection is required; CSS output alone is not a substitute.

## What You Get

| Path | What it is |
|------|-----------|
| `src/runtime/` | EventBus, Contracts, ModuleManager, ServiceManager, Router, RateLimiter |
| `src/modules/` | 30+ feature modules — auth, storage, sync, camera, form-management, search, file-upload, consent... |
| `src/ui/components/` | 18 token-driven CSS primitives — Badge, Button, Card, Field, Input, Toast, Theme-Toggle + 11 settings primitives (Radio-Group, Toggle-Card, Slider, Section-Header, Shortcut-List, Code-Editor, Swatch, etc.) |
| `src/modules/ai-ui/` | AIUI Composer Service — secure component catalog, mount/unmount/setState ops, SAFE_TAGS whitelist (54 tags), intent-based behavior contracts |
| `src/style/design-tokens.json` | CSMA base token seed (DTCG format) |
| `src/style/token-overrides.json` | Project and brand token patches |
| `demo/` | Todo-based reference app showing CSMA components, theme switching, runtime events, and a few module examples |
| `showcase/` | Standalone visual inspection pages for generated tokens |
| `docs/` | Agent skills — design, architecture, security, testing, patterns |

## Design-First Workflow

All visual work is driven by tokens. Your coding agent records design intent in
root `DESIGN.md`, writes focused dot-notation patches to
`src/style/token-overrides.json`, and regenerates CSS through the patch script.

```bash
# 1. Edit token overrides
src/style/token-overrides.json

# 2. Merge into the base seed and regenerate CSS
npm run tokens:patch

# 3. Use generated custom properties in your components
var(--primary)
var(--space-lg)
var(--radius-md)
```

`src/style/design-tokens.json` remains the CSMA base token seed. For app-specific
work, do not edit it directly. Never edit generated CSS directly.

## After The Demo: Build Your App

The app under `demo/` exists to show how CSMA works: primitive components,
generated tokens, theme switching, EventBus state flow, DOM rendering without a
framework, and a few module-driven behaviors in one small surface. Use it as a
reference while building your actual application.

Start with one of two design paths:

| Starting point | Agent skill |
|----------------|-------------|
| You do not have a design brief yet | `docs/design/SKILL.md` |
| You have an external or uploaded `DESIGN.md` | `docs/design-import/SKILL.md` |

Then use product planning when the request is bigger than token/style work:

| User goal | Agent skill |
|-----------|-------------|
| Landing page, website, app, navigation, routes, pages, or critical flows | `docs/product-planning/SKILL.md` |
| Runtime animation, splash screen, route transition, or scroll motion | `docs/animation/SKILL.md` after product planning |
| Existing video asset integration | `docs/video/SKILL.md` |

Recommended flow:

1. Run the demo app as a smoke test.
2. Choose design path: from scratch or import.
3. Choose product planning path: landing page, website, app, page, flow,
   or animation.
4. Create only the needed artifacts: `DESIGN.md`, `SITE.md`, `APP.md`,
   `pages/*.md`, `flows/*.md`, or `animations/*.md`.
5. Create or update `project-manifest.json` with the product type, public web
   presence, route inventory, organization metadata, and canonical module ids.
6. Run `npm run generate-project-artifacts` to scaffold legal drafts and public
   discovery files when they are missing.
7. Patch only the needed branches in `src/style/token-overrides.json`.
8. Run `npm run tokens:patch`.
9. Inspect `/showcase/token-showcase.html` across light, dark, and contrast themes.
10. Choose one delivery mode per surface: `static-mpa`, `spa`, or `hybrid`.
11. For public multi-page work, run `npm run verify:frontend-routes` so planned routes match built URLs.
12. Compose screens from `src/ui/components/`, layout utilities, and app-specific
   CSS that uses generated variables.
13. Classify behavior as Type I (CSS-only) or Type II (EventBus + Contracts).
14. Run `npm run lint:styles` and relevant tests.

Product planning keeps concerns separate:

| Artifact | Owns |
|----------|------|
| `DESIGN.md` | Visual system, token intent, component recipes, anti-patterns |
| `project-manifest.json` | Machine-readable product metadata for legal and SEO scaffolding |
| `SITE.md` | Website navigation, pages, shell, SEO, legal, consent |
| `APP.md` | App screens, roles, navigation, modules, state model |
| `pages/*.md` | Page sections, content, layout, CTAs, motion |
| `flows/*.md` | Multi-step behavior, validation, events, persistence, failures |
| `animations/*.md` | Runtime motion plans: splash, route transition, reusable sequence |

`demo/` is not a required scaffold for your production app. You can either:

- keep `demo/` as reference and create your own app entry under `frontend/`; or
- replace the todo files in `demo/` if you want the fastest single-entry
  starter path.

In both cases, keep `src/style/design-tokens.json` as the CSMA base seed, put
project changes in `src/style/token-overrides.json`, and keep generated CSS out
of manual edits.

Delivery contract:

- `static-mpa`: public routes are real `frontend/**/*.html` files that build to matching root URLs
- `spa`: client-routed surfaces use the optional `router` module
- `hybrid`: public routes stay static while app routes use the router module
- do not mix public HTML routes with JS `export const html = ...` page modules

Video boundary:

- video briefs, storyboards, and new promo/explainer asset creation are not default CSMA planning artifacts
- CSMA may integrate an existing video asset into the site/app
- handle new video content planning upstream, then pass the finished brief or asset into implementation

## Manifest-Driven Legal And SEO Scaffolding

CSMA includes a first-class scaffold generator driven by one root manifest:
`project-manifest.json`.

Minimum shape:

```json
{
  "schemaVersion": 1,
  "productType": "site | web-app | hybrid | mobile-app",
  "organization": {
    "legalName": "string",
    "productName": "string",
    "supportEmail": "string",
    "jurisdiction": "string",
    "addressCountry": "string"
  },
  "web": {
    "enabled": true,
    "baseUrl": "https://example.com",
    "indexable": true,
    "defaultLocale": "en",
    "routes": ["/", "/pricing", "/docs"]
  },
  "modules": ["consent", "analytics", "auth", "checkout"]
}
```

Generation rules:

- Always scaffold `pages/privacy.md` and `pages/terms.md`
- When `web.enabled=true`, also scaffold `pages/cookies.md` and `public/robots.txt`
- When `web.enabled=true` and `web.indexable=true`, also scaffold
  `public/sitemap.xml` and `public/llms.txt`
- Existing files are never overwritten
- `web.routes` is the sitemap and `llms.txt` source

Run it with:

```bash
npm run generate-project-artifacts
```

The generator fails fast on missing required fields, missing `web.baseUrl`,
empty route inventories for indexable web projects, and unknown module ids.
Generated legal content is scaffold text only and must be reviewed before use.

## Architecture

```
┌─────────────┐     events      ┌─────────────┐
│  UI layer   │ ◄─────────────► │  Services   │
│  CSS + DOM  │                 │  (state)    │
└─────────────┘                 └─────────────┘
       ▲                              │
       │                              │
       └────────── EventBus ──────────┘
                    │
                    ▼
            ┌─────────────┐
            │  Contracts  │
            │ (validate)  │
            └─────────────┘
```

- **EventBus** — Pub/sub between services and UI. Every payload validated.
- **Contracts** — Schema + rate limits + security rules per event type.
- **Services** — Business logic, state management, persistence.
- **UI** — Dumb components that subscribe to events and update CSS classes.

## Modules

Import what you need. Each module has a manifest, contracts, and services.

```javascript
import { manifest, services } from './src/modules/search/index.js';
```

Current modules: A/B Testing, Admin Audit Log, AI, AI UI, Analytics, Auth,
Auth UI, Captcha, Cart, Catalog, Charts, Checkout, CMS Content, Comments,
Consent, Content Prefetch, Content Workflow, Data Table, Edge Search,
Feature Flags, File System, File Upload, Form Management, I18n, Import Export,
Location, Media, Meta Manager, Modal System, Network Status, Notifications,
Optimistic Sync, Payment Adapters, Permissions UI, Reviews, Router, Search,
Share, Storage, Sync Queue.

The newer vertical modules are **frontend halves**: they own UI state, EventBus
contracts, adapters, optimistic behavior, safe local/cache behavior, and standard
SSMA/gateway seams. Explicit `runtimeConfig.<module>` endpoints are honored; when
`runtimeConfig.ssma.baseUrl` is present, default companion routes resolve through
SSMA; otherwise modules remain in local client mode. Authoritative backend/edge
companions — payments, inventory, moderation, RBAC, private search, audit
sources, imports, workflow persistence — are intentionally outside CSMA runtime
code and should be generated by `agent-frontend`, SSMA, or project-specific
backend agents.

For multilingual apps, `i18n` remains the locale/translation source of truth
while `meta-manager` owns head-tag output. When `FEATURES.I18N` is enabled, the
runtime auto-loads `meta-manager` so page/app code can compose localized SEO
through `PAGE_CHANGED` or `metaManagerModule`.

See `MODULE_IMPLEMENTATION_PLAN.md` for the frontend/backend boundary and wave implementation status.

## Security Model

CSMA is secure-by-default. Missing security config resolves to the production
profile; development-only runtime behavior requires
`securityProfile: "development"`.

Production behavior:

- access tokens are memory-only; persistent browser token storage is rejected
- cookie sessions are the preferred auth strategy
- OAuth state uses cryptographic randomness and callback state is validated strictly
- OAuth redirect URIs must be same-origin or explicitly allowlisted
- `window.csma` exposes a small public runtime surface by default
- EventBus contracts reject unknown keys, oversized values, unsafe URLs, prototype-pollution keys, and unmarked broad public schemas
- public and user-triggered intents use canonical rate limits: `{ requests, windowMs, scope }`
- form autosave is off; sensitive fields are redacted from events and drafts
- public-network forms require backend-delegated integrity through `integrityService.prepareSubmission(...)`
- service worker caching denies sensitive route prefixes including `/api/`, `/auth/`, `/forms/`, `/media/`, `/logs/`, `/optimistic/`, `/query/`, `/admin/`, and `/internal/`

Production verification:

```bash
npm run security-check
npm test -- --run
npm run build
npm run verify:frontend-routes
```

## SSMA Gateway

For backend gateway middleware — WebSocket transport, auth, optimistic intent
persistence, media, forms — use **SSMA**:

- Repository: https://github.com/yagaltd/SSMA
- Rust gateway with WebSocket + SSE endpoints
- Auth (JWT, OAuth, OIDC), RBAC, rate limiting
- Optimistic intent store with replay and fanout

CSMA = client template. SSMA = Rust gateway. Connect them via the
`optimistic-sync` module over WebSocket.

Production CSMA + SSMA deployments use HttpOnly Secure SameSite cookies,
allowed-origin enforcement, server-side rate limits, authenticated WS/SSE
connections, protected channels, backend anti-bot checks for form submission,
and no bearer tokens in browser storage. CSMA enforces client-side contracts and
backpressure; SSMA or the deployment layer remains responsible for authoritative
abuse prevention.

## Browser Support

Modern evergreen browsers. ES2020+. Uses standard Web APIs only — no polyfills
needed for Chrome, Firefox, Safari, Edge.

## Acknowledgements

- [Enrico Piovesan](https://medium.com/@enricopiovesan) — For the original
  articles on Client-Side Microservices Architecture
- Inspired by [JurisJS](https://github.com/jurisjs/juris) and
  [VanJS](https://github.com/vanjs-org/van)

## License

MIT
