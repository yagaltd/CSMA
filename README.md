# CSMA

> A robust, modules-first, framework-free application template built on the
> **Client-Side Microservices Architecture** pattern.

Zero frameworks. Zero virtual DOM. Vanilla JavaScript, token-driven CSS, and a
reactive runtime that stays small and stays fast.

## Features

✅ **Zero frameworks** — Pure vanilla JavaScript, no React, no Vue, no Svelte  
✅ **~5KB gzipped runtime** — EventBus, Contracts, ModuleManager, Router  
✅ **CSS-class reactivity** — State changes via `data-*` attributes, not inline styles  
✅ **Zero-trust security** — CSP, contract validation, sanitization, honeypot, rate limiting  
✅ **Type-safe EventBus** — Every payload validated by schema before it reaches a handler  
✅ **Lifecycle-safe runtime** — Explicit cleanup, unload-safe modules, leak-resistant services  
✅ **Modules-first extension model** — Commands, routes, navigation, panels, adapters  
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
npm run dev       # start dev server with the demo app
```

Open `http://localhost:5173/demo/` to see the todo app running on the real CSMA
runtime. Treat this as a smoke test and reference implementation, not the final
shape of your app.

Open `http://localhost:5173/showcase/token-showcase.html` after token edits to
inspect the current palette, typography, spacing, layout primitives, shape,
elevation, components, motion, and light/dark/contrast themes.

## What You Get

| Path | What it is |
|------|-----------|
| `src/runtime/` | EventBus, Contracts, ModuleManager, ServiceManager, Router, RateLimiter |
| `src/modules/` | 20 feature modules — auth, storage, sync, camera, form-management, search... |
| `src/ui/components/` | Token-driven CSS primitives — Badge, Button, Toast, Card, Input, Field |
| `src/style/design-tokens.json` | CSMA base token seed (DTCG format) |
| `src/style/token-overrides.json` | Project and brand token patches |
| `demo/` | Simple todo app explaining CSMA components, theme switching, and runtime events |
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

The todo app under `demo/` exists to show how CSMA works: primitive components,
generated tokens, theme switching, EventBus state flow, and DOM rendering without
a framework. Use it as a reference while building your actual application.

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
| Generated video, product promo, explainer, or website-to-video output | `docs/video/SKILL.md` after product planning |

Recommended flow:

1. Run the todo demo as a smoke test.
2. Choose design path: from scratch or import.
3. Choose product planning path: landing page, website, app, page, flow,
   animation, or video.
4. Create only the needed artifacts: `DESIGN.md`, `SITE.md`, `APP.md`,
   `pages/*.md`, `flows/*.md`, `animations/*.md`, `VIDEO.md`, or
   `storyboards/*.md`.
5. Create or update `project-manifest.json` with the product type, public web
   presence, route inventory, organization metadata, and canonical module ids.
6. Run `npm run generate-project-artifacts` to scaffold legal drafts and public
   discovery files when they are missing.
7. Patch only the needed branches in `src/style/token-overrides.json`.
8. Run `npm run tokens:patch`.
9. Inspect `/showcase/token-showcase.html` across light, dark, and contrast themes.
10. Compose screens from `src/ui/components/`, layout utilities, and app-specific
   CSS that uses generated variables.
11. Classify behavior as Type I (CSS-only) or Type II (EventBus + Contracts).
12. Run `npm run lint:styles` and relevant tests.

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
| `VIDEO.md` / `storyboards/*.md` | Optional production-media planning |

`demo/` is not a required scaffold for your production app. You can either:

- keep `demo/` as reference and create your own app entry, then update
  `vite.config.js` to point at it; or
- replace the todo files in `demo/` if you want the fastest single-entry
  starter path.

In both cases, keep `src/style/design-tokens.json` as the CSMA base seed, put
project changes in `src/style/token-overrides.json`, and keep generated CSS out
of manual edits.

## Manifest-Driven Legal And SEO Scaffolding

CSMA now includes a first-class scaffold generator driven by one root manifest:
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
- Existing files are never overwritten in v1
- `web.routes` is the only sitemap and `llms.txt` source in v1

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

Current modules: AI, Analytics, Camera, Checkout, Data-table, File-system,
Form-management, I18n, Image-optimizer, Location, Media-capture, Media-transform,
Meta-manager, Modal-system, Network-status, Optimistic-sync, Router, Search,
Storage, Sync-queue.

See `roadmap.md` for planned additions.

## SSMA Gateway

For backend gateway middleware — WebSocket transport, auth, optimistic intent
persistence, media, forms — use **SSMA**:

- Repository: https://github.com/yagaltd/SSMA
- Rust gateway with WebSocket + SSE endpoints
- Auth (JWT, OAuth, OIDC), RBAC, rate limiting
- Optimistic intent store with replay and fanout

CSMA = client template. SSMA = Rust gateway. Connect them via the
`optimistic-sync` module over WebSocket.

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
