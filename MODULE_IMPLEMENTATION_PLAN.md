# CSMA Module Implementation Plan

> Scope: frontend CSMA modules only. Backend/edge companions are documented as later implementation contracts for `agent-frontend`, `agents-framework`, or archived deployment templates.

## Decision

CSMA owns the client-side half of each capability:

- UI state and DOM integration
- EventBus contracts
- frontend adapters
- optimistic behavior
- consent/security gating
- offline/local cache behavior
- integration tests against runtime services

CSMA does **not** own authoritative secrets, database writes, payment confirmation, private search indexes, durable CMS storage, or production deployment orchestration.

Backend/edge companions should be specified separately and implemented later by `agent-frontend` or backend-oriented agents.

## Frontend Module Pattern

Each new CSMA module should follow the existing module structure:

```txt
src/modules/<module>/
  index.js
  README.md
  contracts/<module>-contracts.js
  services/<Module>Service.js
  adapters/          # optional
  ui/                # optional UI helpers, no framework dependency
```

Required behavior:

1. expose a `manifest`
2. expose `services`
3. expose `contracts`
4. validate all EventBus payloads
5. use `data-*` / classes for visual state
6. avoid secrets and authoritative writes
7. integrate with consent/auth/storage/sync modules where relevant
8. include focused tests

## Proposed CSMA Frontend Modules

| Module | Frontend responsibility | Depends on | Backend/edge companion needed? |
|---|---|---|---|
| `catalog` | Product/content listing state, filters, facets, item detail cache, public CDN/API adapters | `search`, `storage`, optional `analytics` | Yes: catalog source, inventory, private pricing |
| `cart` | Cart state, quantity changes, local persistence, optimistic totals preview, cart events | `storage`, `analytics`, optional `auth` | Yes: price/tax/shipping validation, coupon authority |
| `cms-content` | Structured page/post/block loading, local render model, route content prefetch | `router`, `meta-manager`, `i18n`, `search` | Optional: CMS API, publish workflow, draft storage |
| `permissions-ui` | Role/capability-aware UI visibility and route affordances | `auth`, `router` | Yes: authoritative RBAC/ABAC decisions |
| `charts` | KPI cards, chart adapter registry, formatting, loading/error states | `data-table`, optional `analytics` | Yes: metrics aggregation/query API |
| `comments` | Comment list UI, optimistic submit/edit/delete states, moderation labels | `auth`, `form-management`, `sync-queue` | Yes: DB writes, moderation, abuse controls |
| `reviews` | Rating summary UI, review form state, optimistic review submission | `auth`, `form-management`, `analytics` | Yes: DB writes, fraud/moderation, purchase verification |
| `payment-adapters` | Client payment SDK adapters, payment intent UI state, safe redirect/return handling | `checkout`, `auth`, `captcha` | Yes: payment intents, secrets, webhooks |
| `edge-search` | Search client, facets, suggestions, result state, public/static index adapter | `search`, `analytics` | Optional/Yes: private index queries, ranking, ACLs |
| `content-prefetch` | Route/data manifest prefetch, stale-while-revalidate hints, static-feeling transitions | `router`, `storage`, `network-status` | Optional: CDN manifests, cache headers |
| `ab-testing` | Variant state, data attributes, analytics labels, explicitly configured local assignment | `analytics`, `consent` | Yes for production assignment/targeting |
| `feature-flags` | Client flag cache, fallback defaults, UI state toggles | `storage`, optional `auth` | Yes for dynamic rollout/targeting |
| `admin-audit-log` | Audit table UI, filters, export affordances | `data-table`, `auth`, `search` | Yes: immutable audit source |
| `import-export` | CSV/JSON import preview, client validation, export downloads | `file-upload`, `form-management`, `data-table` | Optional/Yes: large imports, DB writes |
| `content-workflow` | Draft/review/publish UI states for local or connected content workflows | `cms-content`, `auth`, `notifications` | Yes for multi-user workflow/persistence |

## Implementation Status

- Wave 1 — Generic site/app foundation: implemented and verified with `tests/wave1-modules.test.js`.
- Wave 2 — Ecommerce and conversion: implemented and verified with `tests/wave2-modules.test.js`.
- Wave 3 — Admin/CRM/dashboard: implemented and verified with `tests/wave3-modules.test.js`.
- Wave 4 — Community/content operations: implemented and verified with `tests/wave4-modules.test.js`.
- Final validation: `npm test -- --run --reporter=dot`, `npm run check:all`, `npm run security-check`, `npm run build`, and `npm run verify:frontend-routes` passed.

## Implementation Waves

### Wave 1 — Generic site/app foundation

1. `feature-flags`
2. `content-prefetch`
3. `cms-content`
4. `catalog`

Why: these help blog, docs, marketing, ecommerce, and hybrid apps.

### Wave 2 — Ecommerce and conversion

5. `cart`
6. `payment-adapters`
7. `reviews`
8. `ab-testing`

Why: covers storefront and paid products while keeping authority outside CSMA.

### Wave 3 — Admin/CRM/dashboard

9. `permissions-ui`
10. `charts`
11. `admin-audit-log`
12. `import-export`

Why: gives admin/dashboard projects reusable client primitives.

### Wave 4 — Community/content operations

13. `comments`
14. `content-workflow`
15. `edge-search`

Why: more backend-dependent; frontend value is high but companion contracts matter.

## Per-Module Acceptance Criteria

For every frontend module:

- module loads only behind explicit feature flag
- contracts reject unknown keys and unsafe payloads
- service can initialize/destroy cleanly
- no inline styles for visual state
- no secrets in config or storage
- docs include frontend/backend boundary
- tests cover happy path, invalid payload, teardown, and integration with dependent modules

## Backend Companion Status

Status: **not implemented in CSMA**. The frontend modules are complete, but their
backend/edge companions remain future work. Required companion areas include:

- `catalog`: catalog source, inventory, private pricing, protected availability
- `cart`: authoritative price/tax/shipping/coupon validation
- `payment-adapters`: payment intents/sessions, secrets, webhooks, refunds
- `reviews` and `comments`: durable writes, moderation, abuse/fraud controls
- `permissions-ui`: authoritative RBAC/ABAC decisions
- `charts`: private metrics aggregation/query endpoints
- `admin-audit-log`: immutable authoritative audit source
- `import-export`: durable imports, large-file processing, persistence
- `content-workflow`: publish/schedule/review persistence and multi-user state
- `edge-search`: private indexes, ACL-aware queries, ranking, query logs
- `ab-testing` and `feature-flags`: production assignment, rollout targeting, server-side overrides

Backend/edge work should be captured in separate companion specs, not implemented inside CSMA modules.

Recommended location options:

1. `agent-frontend` — best for generating project-specific Cloudflare/AWS/SSMA companions.
2. `agents-framework` — best if companions become reusable agent-executed implementation recipes.
3. CSMA `templates/backend-companions/` archive — only for static reference contracts, not active runtime code.

Recommended default: **agent-frontend owns companion generation; CSMA may keep reference contracts only if needed.**
