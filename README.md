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

Open `http://localhost:5173` to see the todo app running on the real CSMA
runtime.

## What You Get

| Path | What it is |
|------|-----------|
| `src/runtime/` | EventBus, Contracts, ModuleManager, ServiceManager, Router, RateLimiter |
| `src/modules/` | 20 feature modules — auth, storage, sync, camera, form-management, search... |
| `src/ui/components/` | Token-driven CSS primitives — Badge, Button, Toast, Card, Input, Field |
| `src/style/design-tokens.json` | Single source of truth for every visual value (DTCG format) |
| `demo/` | Working todo app using real EventBus and token-driven CSS |
| `docs/` | Agent skills — design, architecture, security, testing, patterns |

## Design-First Workflow

All visual work is driven by tokens. Your coding agent reads
`docs/design/SKILL.md`, chats with you about the look and feel, updates
`src/style/design-tokens.json`, and regenerates CSS.

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
