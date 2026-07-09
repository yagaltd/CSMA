# Backend for CSMA Modules

> Purpose: explain the backend/edge companion status and implementation expectations for CSMA modules. This document is written for developers who did not participate in the original design discussion.

## Executive Summary

CSMA is a **client-side frontend template/runtime**. Its modules own browser-side state, EventBus contracts, adapters, optimistic behavior, local/cache behavior, and UI-facing integration. CSMA should not contain production backend authority.

The intended production flow is:

```txt
CSMA browser runtime
  -> SSMA gateway or project edge/API companion
  -> database, payment provider, search index, object store, queues, identity provider
```

For most modules, the backend companion is either:

1. **Already implied by existing SSMA/gateway integration** — older modules such as `auth`, `optimistic-sync`, `ai`, `analytics`, `file-upload`, and related modules already document or use gateway endpoints.
2. **Newly required for vertical frontend modules** — the modules added from `MODULE_IMPLEMENTATION_PLAN.md` are frontend halves only and need future backend/edge companion specs for production authority.
3. **Not required** — purely local/browser modules may remain frontend-only.

Recommended ownership:

- **CSMA**: frontend runtime, modules, contracts, feature flags, docs, local validation.
- **agent-frontend**: local project builder/staging tool that generates app-specific backend/edge companion templates and deployment config.
- **SSMA or project backend/edge workers**: production gateway, auth, durable writes, private data, payment sessions, indexing, moderation, audit sources, and realtime fanout.
- **agents-framework / templates**: reusable implementation recipes if companions become standardized.

## Core Boundary Rule

If code needs secrets, database writes, payment confirmation, private indexes, server-side authorization, durable moderation, audit immutability, or deployment credentials, it does **not** belong in CSMA frontend modules.

CSMA modules may:

- hold client UI state
- publish/consume EventBus events
- validate payloads with Contracts
- cache public or local data
- perform optimistic updates
- call configured endpoints through adapters
- expose safe browser APIs through `window.csma`

CSMA modules must not:

- store provider secrets
- confirm payments
- make authoritative RBAC/ABAC decisions
- write directly to production databases
- own private search indexes
- moderate content authoritatively
- generate immutable audit records
- own final tax/shipping/coupon totals
- store refresh tokens or sensitive auth secrets in browser storage

## Existing Backend/Gateway Pattern Before the New Modules

A repo scan shows CSMA already had backend/gateway seams before the new vertical modules. These are mostly expressed as runtime config endpoints, SSMA gateway providers, or README boundary notes — not as separate `backend_for_*` implementation documents.

| Existing module | Existing companion status | Notes |
|---|---|---|
| `optimistic-sync` | SSMA-backed companion expected | Uses local-first action log plus WebSocket/HTTP transport endpoints. Runtime resolves SSMA `/optimistic/ws` and `/optimistic/events` style endpoints. |
| `auth` | Backend companion required and documented | Browser owns session state and EventBus contracts. OAuth, OIDC, cookies, refresh tokens, and provider secrets are backend-mediated. SSMA preferred for HttpOnly Secure SameSite sessions. |
| `auth-ui` | Uses `auth` backend indirectly | UI module only. Depends on `auth`, `form-management`, and optional `captcha`. No independent backend authority. |
| `ai` | Optional SSMA/query backend already supported | Can call configured providers or SSMA query endpoints. Browser keeps chat/session state; gateway should protect provider keys and tool execution. |
| `analytics` | Log/analytics endpoint companion expected | Posts batches to configured endpoint such as `/logs/batch`. Frontend batches/classifies; backend stores, filters, and enforces retention. |
| `consent` | Usually frontend-only, optional server sync | Stores local consent state. If legal/product requires cross-device consent, companion endpoint is needed. |
| `checkout` | Backend/payment companion required | Frontend checkout orchestration only. Production needs payment provider sessions, final totals, tax, refunds, webhooks, fraud controls. |
| `captcha` | Backend verification required for real protection | Frontend adapter can request/collect challenge token. Backend must verify token with CAPTCHA provider. |
| `form-management` | Backend integrity companion needed for public forms | Frontend validation/orchestration only. Public-network submissions require backend-delegated integrity and abuse checks. |
| `file-upload` | Upload grant/storage companion required | Frontend upload state/chunking only. Production needs grant endpoint, object storage, malware/content policy, quota enforcement. |
| `notifications` | Push backend companion required for push delivery | Frontend notification state/permission UI. Backend stores subscriptions and sends push messages. |
| `search` | Optional backend/edge companion | Public static indexes can be frontend/CDN. Private or large search needs edge/API query service. |
| `sync-queue` | Optional backend depending on queued work | Frontend queue only. Queued actions need module-specific backend endpoint to become durable. |
| `network-status` | Frontend-only | Detects connectivity. No backend companion required. |
| `storage` | Frontend-only | IndexedDB/local storage abstraction. No backend authority. |
| `file-system` | Frontend/local filesystem only | Browser filesystem abstraction. Backend only needed when syncing/uploading files. |
| `media` | Optional backend for heavy processing | Frontend capture/transform where possible. Server/edge needed for heavy processing, durable storage, transcription, moderation, etc. |
| `location` | Usually frontend-only | Browser geolocation state. Backend needed only if persisting or using location server-side. |
| `i18n` | Usually frontend/CDN only | Loads locale JSON. Backend optional for dynamic translations. |
| `meta-manager` | Frontend/static output only | Owns head/meta updates. Backend not required. |
| `router` | Frontend-only, deploy config companion optional | SPA/hybrid routing may need CDN/edge rewrite config, but no business backend. |
| `modal-system` | Frontend-only | UI state only. |
| `data-table` | Backend optional | Static/local data can be frontend-only. Private data, pagination, and writes need API companion. |
| `share` | Frontend-only unless tracking/referral persistence is needed | Uses browser share/copy patterns. |
| `ai-ui` | UI-only | Uses `ai` service/backend indirectly. |
| `example-module` | Demo-only | No production backend. |

Conclusion: previous CSMA modules already followed the rule that CSMA talks to configured endpoints/SSMA but does not implement backend authority itself. There was no single detailed backend-companion document before this one.

## New Modules Added From `MODULE_IMPLEMENTATION_PLAN.md`

The following modules are frontend halves. They now include the standard CSMA gateway seam: explicit `runtimeConfig.<module>` endpoints are honored, and default routes resolve through `runtimeConfig.ssma.baseUrl` when configured. If no SSMA base URL or explicit endpoint exists, modules remain in local client mode. They still need backend/edge companions before they can provide production authority.

### Wave 1 — Generic Site/App Foundation

| Module | CSMA frontend owns | Backend/edge companion owns | Suggested companion home |
|---|---|---|---|
| `feature-flags` | Local flag cache, fallback defaults, UI state toggles, EventBus contracts | Production rollout rules, targeting, user/tenant segmentation, signed overrides, audit of flag changes | agent-frontend generates Worker/SSMA flag config or static signed JSON template |
| `content-prefetch` | Route/data manifest prefetch, cache hints, static-feeling navigation state | CDN manifest generation, cache headers, invalidation, private route authorization if manifests are protected | agent-frontend/CDN deploy templates |
| `cms-content` | Structured page/post/block load model, content cache, route content state | CMS storage, drafts, publishing, author roles, scheduled publication, content API | agent-frontend plus SSMA/edge CMS companion |
| `catalog` | Item list state, filters, facets, item detail cache, public CDN/API adapter | Product source of truth, inventory, protected availability, private pricing, merchandising writes | ecommerce companion in agent-frontend or SSMA |

### Wave 2 — Ecommerce and Conversion

| Module | CSMA frontend owns | Backend/edge companion owns | Suggested companion home |
|---|---|---|---|
| `cart` | Cart state, quantities, local persistence, optimistic subtotal preview, cart events | Final price, tax, shipping, discounts, coupon validation, stock reservation, cart merge across sessions | ecommerce companion in agent-frontend/SSMA |
| `payment-adapters` | Browser SDK adapter registry, payment flow UI state, safe redirect/return handling | Payment intents/sessions, provider secrets, webhook verification, refunds, chargebacks, payment status authority | SSMA/payment Worker template generated by agent-frontend |
| `reviews` | Rating summary UI, review form state, optimistic review submission | Durable review writes, purchase verification, moderation, fraud/spam controls, rating aggregation authority | reviews companion in agent-frontend/SSMA |
| `ab-testing` | Variant state, data attributes, analytics labels, deterministic fallback | Production assignment, targeting, experiment registry, exposure dedupe, metrics joins, privacy policy controls | edge assignment Worker or analytics companion |

### Wave 3 — Admin/CRM/Dashboard

| Module | CSMA frontend owns | Backend/edge companion owns | Suggested companion home |
|---|---|---|---|
| `permissions-ui` | Visual role/capability state, client route affordances, UI hiding/showing | Authoritative RBAC/ABAC, policy evaluation, token claims, server route enforcement | auth/permissions companion in SSMA |
| `charts` | KPI/chart dataset state, adapter registry, formatting, loading/error states | Metrics aggregation, private data queries, tenant scoping, retention, query rate limits | analytics/metrics API companion |
| `admin-audit-log` | Audit table UI, filters, export affordances | Immutable audit source, append-only writes, actor identity, tamper resistance, retention/legal holds | SSMA/admin companion |
| `import-export` | CSV/JSON preview, client validation, export payload preparation | Large file processing, durable import jobs, schema migrations, DB writes, object storage, permissions | import/export worker or SSMA job companion |

### Wave 4 — Community/Content Operations

| Module | CSMA frontend owns | Backend/edge companion owns | Suggested companion home |
|---|---|---|---|
| `comments` | Comment list UI, optimistic submit/edit/delete states, moderation labels | Durable comment writes, moderation, spam/abuse controls, notifications, edit history, deletion policy | comments companion in agent-frontend/SSMA |
| `content-workflow` | Draft/review/publish/schedule UI state transitions | Multi-user workflow persistence, locks, approvals, scheduled publish jobs, author/editor roles | CMS workflow companion |
| `edge-search` | Search client, facets, suggestions, public/static index adapter | Private index queries, ACL filtering, ranking, typo tolerance at scale, query logs, indexing pipeline | edge search Worker or SSMA search companion |

## Backend Companion API Principles

Every backend/edge companion should follow these principles:

1. **CSMA remains the client** — the browser calls one configured gateway/edge/API surface, not provider APIs with secrets.
2. **SSMA-first when possible** — if the project uses SSMA, prefer gateway routes under the configured SSMA base URL.
3. **Edge worker acceptable for static/public products** — Cloudflare Workers or similar are appropriate for public catalog, flags, search, A/B assignment, and static CMS APIs.
4. **No browser secrets** — API keys, payment secrets, private index keys, OAuth secrets, CAPTCHA secrets, and DB credentials stay server-side.
5. **HttpOnly cookies for authenticated flows** — prefer Secure SameSite cookies for sessions.
6. **Contracts on both sides** — CSMA validates browser events; backend validates HTTP/WS payloads independently.
7. **Idempotency for writes** — cart validation, comments, reviews, imports, workflow transitions, and payments need idempotency keys.
8. **Rate limits at backend** — frontend EventBus rate limits are safety rails, not authoritative abuse prevention.
9. **Audit security-relevant writes** — payments, auth, permissions, imports, workflow transitions, moderation, and admin actions should emit audit records.
10. **Privacy and retention documented** — generated legal docs must be reviewed for each companion that stores personal data.

## Suggested Endpoint Families

These are reference shapes, not required routes. agent-frontend can generate variants per deployment target.

### Flags / Experiments

```txt
GET  /flags/client-config
POST /experiments/assign
POST /experiments/exposure
```

Backend authority:
- targeting rules
- signed client config
- exposure dedupe
- experiment metrics join keys

### Catalog / Cart / Payment

```txt
GET  /catalog/items
GET  /catalog/items/:id
POST /cart/validate
POST /checkout/session
POST /payments/webhook        # provider -> backend only
GET  /checkout/status/:id
```

Backend authority:
- inventory
- final totals
- coupon/tax/shipping
- payment provider secrets
- webhook verification

### Reviews / Comments

```txt
GET  /reviews?targetId=...
POST /reviews
GET  /comments?threadId=...
POST /comments
PATCH /comments/:id/moderation
```

Backend authority:
- write persistence
- moderation
- purchase/user verification
- abuse controls

### Auth / Permissions / Admin

```txt
GET  /auth/session
POST /auth/login
POST /auth/logout
GET  /permissions/effective
GET  /admin/audit-log
POST /admin/audit-log/export
```

Backend authority:
- session cookies
- RBAC/ABAC
- immutable audit source
- export permissions

### CMS / Content Workflow / Search

```txt
GET  /content/:id
POST /content/:id/transition
GET  /workflow/items
POST /workflow/items/:id/transition
GET  /search?q=...
GET  /search/suggest?q=...
```

Backend authority:
- drafts and publish state
- locks and approvals
- scheduled jobs
- private/ACL-aware search
- indexing pipeline

### Import / Export / Charts

```txt
POST /imports/preview
POST /imports/jobs
GET  /imports/jobs/:id
POST /exports/jobs
GET  /metrics/query
```

Backend authority:
- large file processing
- durable jobs
- schema writes
- private metric queries
- tenant scoping

## Runtime Configuration Convention

CSMA modules already read from `runtimeConfig.<moduleName>` and expose `window.csma.<serviceName>` when enabled. Companions should keep that pattern.

Example:

```js
window.APP_RUNTIME_CONFIG = {
  ssma: {
    baseUrl: 'https://api.example.com'
  },
  catalog: {
    endpoint: '/catalog/items'
  },
  cart: {
    validateEndpoint: '/cart/validate'
  },
  paymentAdapters: {
    sessionEndpoint: '/checkout/session'
  },
  edgeSearch: {
    endpoint: '/search'
  }
};
```

The frontend module may adapt these endpoints, but final authority remains with the companion.

## Deployment Target Guidance

| Companion type | Cloudflare Worker/Edge | SSMA Gateway | Static CDN only | AWS Lambda/API Gateway |
|---|---:|---:|---:|---:|
| Public content/catalog reads | Good | Good | Good for static snapshots | Good |
| Feature flags/A-B assignment | Good | Good | Only for static defaults | Good |
| Cart validation | Possible | Good | No | Good |
| Payment sessions/webhooks | Possible but careful | Good | No | Good |
| Auth/session/RBAC | Possible | Best | No | Good |
| Comments/reviews writes | Possible | Good | No | Good |
| Private search | Good | Good | No | Good |
| Imports/exports/jobs | Limited for heavy jobs | Good | No | Best for large jobs |
| Audit log authority | Possible | Good | No | Good |
| Workflow/scheduled publish | Possible | Good | No | Good |

## What agent-frontend Should Generate Later

For each selected product type, `agent-frontend` should generate:

1. CSMA feature flags and `runtimeConfig` for selected modules.
2. Backend companion spec files for required authority.
3. Deployment target config for Cloudflare/AWS/SSMA.
4. Environment variable templates.
5. Local mock mode for preview/staging.
6. Production endpoint wiring.
7. Legal artifact prompts for data categories.
8. Smoke tests that prove CSMA can talk to the companion.

Example outputs:

```txt
backend/
  ssma/
    catalog.spec.md
    cart.spec.md
    payment.spec.md
  cloudflare/
    edge-search.worker.md
    feature-flags.worker.md
.env.example
frontend/runtime-config.js
```

Do not copy backend code into CSMA unless it is an inert example/template. Active backend implementation belongs to the generated project, SSMA, or the deployment target.

## Current Status Checklist

| Area | Status |
|---|---|
| Existing SSMA/gateway seams checked | Done |
| Single prior backend companion document found | No |
| New frontend modules implemented in CSMA | Done |
| New module SSMA/gateway seams implemented | Yes — frontend adapter boundaries and default SSMA route resolution |
| New module backend companions implemented | No — server/edge authority is still future work |
| Backend companion responsibilities documented here | Done |
| agent-frontend generation work | Future |
| SSMA/backend endpoint implementation | Future |

## Developer Handoff

When implementing a backend/edge companion later:

1. Start from this document and the module README.
2. Identify which CSMA module events need network authority.
3. Define backend request/response schemas separately from EventBus schemas.
4. Add authentication/authorization/rate-limit rules.
5. Add idempotency for every write.
6. Add audit records for security-relevant writes.
7. Wire the endpoint through `runtimeConfig` only.
8. Add local mock mode for `agent-frontend` preview.
9. Run CSMA tests plus companion integration/smoke tests.
10. Update privacy/terms/cookies generated artifacts for stored data.
