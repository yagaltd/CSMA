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
npm run tokens    # generate CSS from design-tokens.json
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
| `src/style/design-tokens.json` | Single source of truth for every visual value (DTCG format) |
| `demo/` | Simple todo app explaining CSMA components, theme switching, and runtime events |
| `showcase/` | Standalone visual inspection pages for generated tokens |
| `docs/` | Agent skills — design, architecture, security, testing, patterns |

## Design-First Workflow

All visual work is driven by tokens. Your coding agent records design intent in
root `DESIGN.md`, updates focused branches of `src/style/design-tokens.json`,
and regenerates CSS.

```bash
# 1. Edit tokens
src/style/design-tokens.json

# 2. Regenerate CSS
npm run tokens

# 3. Use generated custom properties in your components
var(--primary)
var(--space-lg)
var(--radius-md)
```

Never edit generated CSS directly. Always change the JSON source.

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
5. Patch only the needed branches in `src/style/design-tokens.json`.
6. Run `npm run tokens`.
7. Inspect `/showcase/token-showcase.html` across light, dark, and contrast themes.
8. Compose screens from `src/ui/components/`, layout utilities, and app-specific
   CSS that uses generated variables.
9. Classify behavior as Type I (CSS-only) or Type II (EventBus + Contracts).
10. Run `npm run lint:styles` and relevant tests.

Product planning keeps concerns separate:

| Artifact | Owns |
|----------|------|
| `DESIGN.md` | Visual system, token intent, component recipes, anti-patterns |
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

In both cases, keep `src/style/design-tokens.json` as the visual source of truth
and keep generated CSS out of manual edits.

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
