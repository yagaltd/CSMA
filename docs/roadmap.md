# CSMA Roadmap

CSMA is a frontend application template. SSMA is a backend gateway starting
point that supports CSMA modules when a feature needs server-side transport,
secret handling, persistence, fanout, webhook processing, or backend
coordination.

This roadmap separates work into:

1. frontend-only capabilities that can live entirely inside CSMA;
2. capabilities that need an optional backend contract and can be supported by
   SSMA;
3. capabilities that are intentionally outside the CSMA template boundary.

The goal is to keep CSMA useful as a standalone client template while giving
teams a clear upgrade path when they need gateway-backed behavior.

## Product Boundary

| Layer | Responsibility |
|------|----------------|
| **CSMA** | Browser runtime, modules, UI primitives, design tokens, EventBus contracts, client state, progressive enhancement, SDK mounting, demos, and frontend integration guides. |
| **SSMA** | Gateway transport, WebSocket/SSE, auth/RBAC enforcement, optimistic intent persistence, webhook ingress, media ingress, backend forwarding, provider verification hooks, and protocol validation. |
| **Business backend** | Domain data, authoritative writes, pricing, inventory, fulfillment, billing decisions, durable business workflows, and product-specific persistence. |

CSMA should never require SSMA for basic frontend use. SSMA should be presented
as the recommended gateway starting point for features that need a server
boundary, not as a mandatory backend.

## Roadmap Principles

- **Frontend first**: build browser-safe features in CSMA when they can run with
  standard Web APIs and no secrets.
- **Backend explicit**: document a backend contract whenever a feature cannot be
  correct or secure in the browser alone.
- **SSMA optional but supported**: provide SSMA adapters, endpoint conventions,
  and examples for gateway-backed modules without coupling CSMA core to SSMA.
- **Provider neutral**: payment, webhook, media, and realtime modules should use
  provider adapters instead of provider-specific application code.
- **Template safe**: demos may simulate backend behavior, but production paths
  must identify which side owns authoritative state.
- **Contracts everywhere**: CSMA EventBus payloads and SSMA wire payloads should
  be validated and documented before expanding runtime behavior.

## Track A - CSMA Frontend-Only Roadmap

These features can be implemented in CSMA without requiring SSMA. They may call
host-provided APIs when an app chooses to wire them to a backend, but the core
module remains browser-safe and template-friendly.

### A1. Command Palette

**Goal:** Add keyboard-driven command discovery and execution for routes,
panels, theme actions, module actions, and app-defined commands.

**Why:** CSMA already has module registries and a small runtime. A command
palette makes those contributions discoverable without adding a framework or a
heavy app shell.

**CSMA scope:**

- command registry UI
- keyboard shortcuts
- fuzzy search over registered commands
- grouped command sections
- disabled/loading states
- EventBus contracts for command invocation
- accessible dialog behavior and focus management

**Backend involvement:** none required.

### A2. Onboarding And Empty States

**Goal:** Provide reusable onboarding flows, first-run guides, feature
highlights, and empty-state patterns.

**Why:** CSMA is a template. New apps need a clear way to introduce features
without every project inventing onboarding state, copy structure, and layout
patterns from scratch.

**CSMA scope:**

- tour step model
- first-run state in browser storage
- dismissible hints
- empty-state primitives
- feature highlight overlays
- route-aware onboarding triggers
- demo flows for app and dashboard layouts

**Backend involvement:** optional only if an app wants account-level onboarding
state synced across devices.

### A3. Feedback And Bug Report UI

**Goal:** Add a generic feedback prompt, NPS-style rating, and bug report form
that can submit through a host-provided handler.

**Why:** Feedback capture is a common app requirement, but the frontend portion
is mostly reusable: prompt timing, rating UI, validation, screenshots, consent,
and submit states.

**CSMA scope:**

- feedback form UI
- rating prompt
- screenshot capture adapter
- consent-aware metadata collection
- offline queue integration
- host-provided submit handler
- demo endpoint mock

**Backend involvement:** required only for production submission storage,
ticketing, or notification delivery. SSMA can support this through form ingress.

### A4. Voice And Speech

**Goal:** Add speech-to-text input helpers, text-to-speech helpers, and optional
voice command routing.

**Why:** Web Speech APIs can improve accessibility and hands-free interaction
without requiring a backend for basic use.

**CSMA scope:**

- browser capability detection
- speech input service
- text-to-speech service
- voice command intent mapping
- accessibility-focused UI examples
- graceful fallback when speech APIs are unavailable

**Backend involvement:** none for browser Web Speech usage. A backend is needed
only for cloud transcription, custom models, or persistent transcripts.

### A5. Media Capture Frontend

**Goal:** Provide camera, microphone, photo, and screen-recording workflows
using standard browser APIs.

**Why:** Many web apps need capture flows. CSMA can own permission handling,
preview UI, recording state, and local file output without owning media
storage.

**CSMA scope:**

- `getUserMedia` and screen capture wrappers
- recording state machine
- permission and device errors
- preview components
- local blob/file output
- upload handoff to host-provided services

**Backend involvement:** optional for storing or processing captured media. SSMA
can support gateway media ingress when teams want a ready starting point.

### A6. Template Form Library

**Goal:** Add reference form templates for login, registration, contact,
newsletter, checkout details, feedback, and profile settings.

**Why:** CSMA has form-management capabilities, but templates reduce friction for
new projects and show the correct EventBus, Contracts, validation, honeypot, and
offline patterns.

**CSMA scope:**

- demo/reference form templates
- validation examples
- submit state recipes
- accessibility and error-message patterns
- offline queue examples

**Backend involvement:** optional for real submissions. Production auth, contact,
and account flows require a backend or gateway endpoint.

### A7. Search

**Goal:** Expand the existing FlexSearch-based search module into a local-first
search layer with provider adapters for local indexes, remote indexes, and
hybrid search.

**Why:** Search is valuable in almost every template-derived app: command
palettes, docs, dashboards, settings, catalogs, content sites, and app data
lists. FlexSearch is a strong CSMA default because it runs in the browser and in
Node.js, supports document search, suggestions, highlighting, workers, and
persistent index options. A provider adapter boundary keeps that default while
allowing teams to use backend search systems when datasets, ranking, or
operational requirements outgrow browser-only indexing.

**CSMA scope:**

- keep FlexSearch as the preferred local-first search adapter
- formalize a search provider adapter contract
- support local document indexing, query, suggestions, facets, pagination, and
  highlighting
- add index hydration and persistence recipes for small and medium datasets
- add worker-backed indexing/querying guidance for larger browser-side indexes
- provide command-palette, docs, table, and catalog search examples
- normalize result payloads so UI code does not depend on the active provider
- support host-provided remote search adapters without coupling CSMA to one
  backend service

**Backend involvement:** none required for local-first search. A backend is
needed when indexes are too large for the browser, search must include private
server-side data, ranking must be centrally controlled, or results must reflect
authoritative ACLs.

**Preferred backend option:** Typesense is the preferred backend search option
for CSMA examples that need server-backed search. It should be integrated
through an adapter, not hard-coded into UI or core search services.

## Track B - CSMA Modules With Backend Contracts

Status: the CSMA frontend halves for the high-priority vertical modules are now
implemented. CSMA defines their frontend services, manifests, contracts, events,
feature flags, docs, tests, and adapter boundaries. Production usage still needs
backend/edge companions for authoritative validation, secrets, durable writes,
private indexes, moderation, payment sessions, RBAC, audit sources, imports, and
workflow persistence. Those companions belong in `agent-frontend`, SSMA,
`agents-framework`, or project-specific backend templates — not in CSMA runtime
code.

Implemented frontend modules from `MODULE_IMPLEMENTATION_PLAN.md`:

- Wave 1: `feature-flags`, `content-prefetch`, `cms-content`, `catalog`
- Wave 2: `cart`, `payment-adapters`, `reviews`, `ab-testing`
- Wave 3: `permissions-ui`, `charts`, `admin-audit-log`, `import-export`
- Wave 4: `comments`, `content-workflow`, `edge-search`


### B1. Payments

**Goal:** Build a provider-pluggable checkout/payment integration that supports
hosted and embedded payment flows through adapters.

**Why:** Checkout UI and client state are reusable, but payment authorization is
not frontend-only. Provider secrets, authoritative totals, payment session
creation, webhooks, and fulfillment must be handled server-side.

**CSMA scope:**

- checkout orchestration
- payment provider adapter contract
- Stripe frontend adapter
- Airwallex frontend adapter
- hosted checkout redirect support
- embedded payment element host UI
- payment return handling
- provider-ready, mounted, action-required, completed, and error events
- demo mode with mocked session creation

**Required backend scope:**

- create provider payment/session objects
- calculate authoritative amount, currency, tax, shipping, discounts, and order
  identity
- hold provider secret keys
- verify payment webhooks
- enforce idempotency
- fulfill orders from webhook-confirmed state

**SSMA opportunity:**

- generic payment gateway endpoints
- provider webhook ingress through `/webhooks/:provider`
- Stripe and Airwallex verification hooks
- backend forwarding for order fulfillment
- example payment adapter contract for business backends

### B2. Realtime Presence

**Goal:** Add online status, typing indicators, last-seen state, lightweight
presence channels, and reconnect behavior.

**Why:** Presence is valuable for collaboration, support, chat, dashboards, and
multi-user apps. The browser can display presence state, but reliable fanout and
replay require a server boundary.

**CSMA scope:**

- presence client service
- channel subscription UI patterns
- online/offline and typing events
- stale presence handling
- reconnect and backoff behavior
- fallback read-only mode for apps without realtime transport

**Required backend scope:**

- WebSocket or SSE transport
- channel authorization
- fanout to subscribed clients
- connection lifecycle tracking
- optional last-seen persistence

**SSMA opportunity:**

- presence channels over existing WebSocket/SSE transport
- RBAC-aware channel subscriptions
- fanout and replay using gateway infrastructure
- conformance examples for CSMA optimistic-sync integration

### B3. Webhook-Aware Frontend Events

**Goal:** Let CSMA apps react to backend-confirmed provider events such as
payment success, subscription update, fulfillment status, media processing, or
external workflow completion.

**Why:** Many important states are confirmed by webhooks, not by the browser.
CSMA needs a clean client pattern for displaying gateway-confirmed state without
trusting client-side success screens.

**CSMA scope:**

- event subscription contracts
- UI recipes for pending, confirmed, failed, and retry states
- client event reconciliation helpers
- examples for checkout and media processing

**Required backend scope:**

- webhook verification
- idempotency
- event normalization
- authorization before client fanout
- backend forwarding or persistence

**SSMA opportunity:**

- provider webhook ingress through `/webhooks/:provider`
- normalized gateway events
- SSE fanout to authorized clients
- backend adapter forwarding

### B4. Auth-Backed Account Flows

**Goal:** Expand reference account flows around login, registration, OAuth/OIDC,
password reset, email verification, session refresh, and role-aware UI.

**Why:** CSMA can own client session state and UI, but secure account lifecycle
operations need server-side token handling, cookie policy, provider secrets, and
rate limiting.

**CSMA scope:**

- account form templates
- session state UI
- role-aware navigation examples
- OAuth/OIDC start/callback client handling
- account error states
- auth contract tests

**Required backend scope:**

- credential verification
- secure cookies and refresh tokens
- OAuth/OIDC client secrets
- email verification and reset flows
- server-side rate limiting
- RBAC enforcement

**SSMA opportunity:**

- auth endpoints already aligned with CSMA expectations
- OIDC bridge examples
- session refresh and user envelope conformance tests
- role-aware gateway access for realtime and admin features

### B5. Media Upload And Processing

**Goal:** Connect CSMA file upload and media capture modules to a gateway-backed
media ingress path.

**Why:** CSMA can validate files, chunk uploads, show progress, and manage
retries. Production storage, virus scanning, transcoding, and signed access need
server-side handling.

**CSMA scope:**

- upload UI
- chunk/resume state
- progress and cancellation
- media capture handoff
- preview and metadata display
- host adapter for upload endpoints

**Required backend scope:**

- upload authorization
- durable storage
- content-type and size enforcement
- malware scanning or processing hooks when needed
- signed download/access URLs
- processing status events

**SSMA opportunity:**

- media asset endpoints
- backend forwarding
- processing status fanout
- example upload adapter for CSMA

### B6. Optimistic Collaboration

**Goal:** Expand optimistic-sync examples into practical collaboration recipes
such as shared lists, dashboards, forms, and lightweight document state.

**Why:** CSMA already has client-side optimistic intent patterns, and SSMA
already provides gateway transport and replay. The next step is reference
patterns that show how to safely combine them.

**CSMA scope:**

- optimistic reducer recipes
- conflict-state UI patterns
- offline queue integration
- retry and rollback examples
- demo collaboration flows

**Required backend scope:**

- intent persistence
- replay
- dedupe
- fanout
- domain validation before durable writes

**SSMA opportunity:**

- existing optimistic intent store
- WebSocket/SSE transport
- admin inspection endpoints
- conformance vectors shared with CSMA tests

### B7. Backend-Backed Search

**Goal:** Add backend-backed search contracts for Typesense and custom search
providers while preserving the same CSMA search API used by local FlexSearch.

**Why:** Browser-side search works well for local-first and static datasets, but
production apps often need server-side indexing, tenant-aware ACL filtering,
centralized ranking, typo tolerance over large collections, analytics, and
freshness guarantees. The adapter model lets CSMA keep FlexSearch as the
default while giving teams a clean path to Typesense or their own search
backend.

**CSMA scope:**

- remote search adapter interface
- Typesense client adapter example
- fallback strategy from remote search to local cached indexes when appropriate
- normalized facets, pagination, highlighting, and suggestions
- search loading, empty, partial, stale, and error states
- contract tests for local, remote, and hybrid result payloads

**Required backend scope:**

- index creation and updates
- ACL-aware query filtering
- tenant or workspace isolation
- private API key handling
- indexing pipeline from the business backend
- optional analytics and query logging

**SSMA opportunity:**

- search query proxy endpoints
- backend adapter forwarding to Typesense or a custom search service
- auth/RBAC enforcement before forwarding queries
- SSE updates for search index refresh or long-running indexing jobs
- conformance examples showing FlexSearch local mode, Typesense remote mode,
  and hybrid fallback mode

## Track C - SSMA Gateway Support Roadmap

These items belong primarily in SSMA because they are gateway concerns. CSMA may
add matching adapters, docs, or demos, but should not implement the server
behavior.

### C1. Payment Gateway Examples

**Goal:** Add reference gateway integrations for Stripe and Airwallex.

**Why:** Payment providers require secret keys, webhook verification, session
creation, and idempotent fulfillment. A gateway example gives CSMA users a real
starting point without putting secrets in the browser.

**SSMA scope:**

- provider configuration shape
- payment session creation endpoint examples
- webhook verification examples
- idempotency handling
- backend forwarding contract for order fulfillment
- local development docs using test credentials

### C2. Presence Gateway

**Goal:** Add a first-class presence feature on top of SSMA WebSocket/SSE
transport.

**Why:** Presence needs connection-aware server fanout and authorization. SSMA is
the correct layer because it already owns transport, auth, channels, and replay
boundaries.

**SSMA scope:**

- join/leave channel messages
- typing/status events
- stale connection cleanup
- role-aware channel authorization
- presence metrics and tests

### C3. Webhook Normalization

**Goal:** Normalize provider webhook events into gateway events that CSMA can
consume consistently.

**Why:** Providers differ in payload shape, retry behavior, signatures, and event
names. CSMA should not need provider-specific webhook code.

**SSMA scope:**

- verifier hook interface
- normalized event envelope
- dedupe keys
- replay/fanout policy
- backend adapter forwarding
- tests for Stripe, Airwallex, and generic providers

### C4. Backend Adapter Examples

**Goal:** Provide example business backends that consume SSMA forwarded events,
queries, forms, media, payments, and optimistic intents.

**Why:** SSMA is a gateway, not the business backend. Examples should make that
boundary concrete without bloating SSMA core.

**SSMA scope:**

- example SQLite backend
- example admin UI
- adapter contract docs
- local multi-process startup guide
- smoke tests across CSMA, SSMA, and the example backend

### C5. Search Gateway Examples

**Goal:** Add SSMA examples for proxying authenticated search queries to
Typesense or a custom backend search service.

**Why:** Search often touches private data. A gateway can enforce auth/RBAC,
hide provider API keys, normalize provider responses, and keep CSMA clients from
depending directly on backend search infrastructure.

**SSMA scope:**

- search query forwarding contract
- Typesense proxy example
- custom backend search adapter example
- RBAC and tenant filtering before query forwarding
- normalized response envelope for CSMA
- indexing-status event examples

## Track D - Documentation And Conformance

These items improve adoption by making the CSMA/SSMA boundary testable and easy
to follow.

### D1. Integration Matrix

**Goal:** Document which CSMA modules work browser-only, which accept optional
backend handlers, and which require backend support in production.

**Why:** Template users need to know whether they can use a feature immediately
or need SSMA/business-backend work first.

### D2. Endpoint Contract Catalog

**Goal:** Define stable endpoint contracts for checkout, forms, media, auth,
presence, search, webhooks, and optimistic sync.

**Why:** CSMA should be backend-agnostic, but backend-agnostic does not mean
unspecified. Clear contracts let users implement their own backend instead of
SSMA when they prefer.

### D3. Shared Test Fixtures

**Goal:** Add fixtures and conformance tests that verify CSMA adapters and SSMA
gateway endpoints speak the same payload language.

**Why:** The integration should be reliable even when CSMA and SSMA evolve
independently.

### D4. Demo Modes

**Goal:** Provide clear demo modes for frontend-only mock behavior, SSMA-backed
local behavior, and custom backend behavior.

**Why:** Demos should be useful without hiding production requirements. Mocked
flows must be labeled as mocks, especially for payments and auth.

## Not In CSMA Core

The following are intentionally outside CSMA core:

- provider secret storage
- payment authorization or fulfillment
- webhook verification
- authoritative pricing, inventory, tax, or shipping
- durable business databases
- server-side RBAC enforcement
- native mobile APIs such as biometric unlock, native QR scanning, APNs/FCM
  direct delivery, native file system access, or native Apple Pay / Google Pay
  sheets
- opinionated product-specific admin applications

CSMA may provide adapters, UI, contracts, and documentation for these areas, but
the authoritative implementation belongs in SSMA, a custom backend, a native
adapter, or an application-specific service.

## Priority

1. **Documentation and boundary cleanup**: integration matrix, endpoint contract
   catalog, and explicit demo mode labels.
2. **Frontend-only polish**: command palette, onboarding, feedback UI, and form
   templates.
3. **Search foundation**: formal search provider adapter contract, FlexSearch
   local-first recipes, Typesense remote adapter example, and hybrid result
   normalization.
4. **Payments foundation**: checkout provider adapter contract, mock mode,
   Stripe/Airwallex frontend adapters, and SSMA payment gateway examples.
5. **Realtime foundation**: CSMA presence client and SSMA presence gateway.
6. **Webhook event flow**: normalized SSMA webhook events and CSMA
   webhook-aware UI recipes.
7. **Media and collaboration examples**: SSMA-backed media ingress and
   optimistic collaboration reference flows.

## aiui Unification Initiative

Consolidating CSMA on a single rendering pipeline (aiui at Layer 1). The
target architecture and `mountSurface` contract live in
`docs/architecture/SKILL.md` § *Layered Rendering Architecture*. This section
tracks phase status.

### Phase 1 — Module surfaces join the catalog (DONE, commit `cd43883`)

Catalog generator extended to scan `src/modules/*/aiui/*.json` in addition
to `src/ui/components/*/manifest.json`. `AIUIComposerService` gained
`canvas`/`svg`/`path`/`g`/`line`/`circle`/`rect`/`polyline`/`polygon` in
`SAFE_TAGS` and a new `render.kind: 'module'` path that resolves via
`serviceManager.get(moduleId).mountSurface(...)`. Four surfaces registered:
`comments-thread`, `chart-display`, `mindmap-canvas` (live); `video-player`
(forward-declared, module body pending). `ServiceManager.register` now
injects itself into services exposing `setServiceManager`. 12 new tests in
`tests/ai-ui/module-surfaces.test.js`. 1188/1188 green.

### Phase 2 — Slides layouts become aiui compositions (DONE, commits 873d4be + 5ee1e29 + recover)

Each of the 24 slide layout factories in `src/modules/slides/layouts/`
re-expressed as an aiui composition spec. `SlideDeckService` unchanged
(keeps `next`/`prev`/`build`/cross-tab sync/presenter). Public `deck.json`
schema unchanged. The `el()` helper in `_shared.js` is deprecated for new
layouts. Result: any aiui surface (comments, video, charts, mindmap) can
embed inside any slide. Scope estimate: ~3–5 days, run as a modular wave.

### Phase 3 — Archetypes migrate, `el()` removed (planned)

`src/modules/archetypes/*` (data-grid, stats-dashboard, config-panel,
editor-builder, media-browser, nav-tabs, overlay-manager, viewer)
re-expressed as aiui compositions. Slides chrome (dock, rail, grid,
presenter) becomes aiui components. The `el()` helper is removed. New
convention documented: all Layer-2 patterns compose via aiui; raw DOM
factories forbidden in `src/modules/*/layouts/` and `src/modules/archetypes/`.
Scope estimate: ~1 week, long-tail across multiple waves.

### Open questions (resolve in their respective phase)

1. **Layout composition DSL** (Phase 2): agents author raw aiui op arrays,
   or do we add a higher-level `compose()` sugar? Lean: sugar.
2. **Streaming partial slides** (Phase 2): pre-render all build states or
   stream via aiui as the user clicks? Lean: pre-render for v1.
3. **Default chart adapter** (Phase 2): ship a default chart.js adapter in
   `src/modules/charts/adapters/`, or leave adapter registration to the app?
   Lean: leave to app, document in a new `docs/charts/SKILL.md`.

### Phase 4 — Anchorable comments module (planned, after Phase 3)

**Status: planning. Scope locked, contracts sketched, no code yet.**

CSMA today has TWO half-built comment systems and the gap showed up
inside slides:

- `src/modules/comments/` is a thin flat thread store (`CommentsService`,
  ~50 LOC). One aiui surface (`comments-thread`) that renders a thread by
  `threadId`. No anchoring, no drawer, no UI components beyond the inline
  surface. Used by Phase 2.2 to embed a live thread in a slide media slot —
  wrong UX (inline, not deck-wide).
- `src/modules/visual-editor/` has a rich annotation system
  (`AnnotationSchema`, `AnnotationOps`, `AnnotationCommentService`,
  `CommentSidebar`, CRDT + sync) — but it is **hard-coupled** to visual
  editor sessions and text selections (`[data-path]` ranges, `getSelection()`).
  Slides cannot reuse it without becoming visual-editor instances.

Phase 4 builds ONE generic, anchorable comments module that any app can
use, then migrates slides (and later visual-editor) onto it.

**Target UX (per spec)**

1. Click any commentable element → popup modal opens at click position to
   author a comment. Confirm creates the comment.
2. Commented element is highlighted (corner color) and gets a badge/label.
   The label is a generic slot today; @mention integration (via the existing
   `mentions` module) replaces it later.
3. Desktop: hover a commented element → popup preview shows the comment.
   Mobile: tap to show the same preview. Both have a Reply button (replies
   go in the preview modal or the drawer).
4. Drawer (separate from the inline popup) lists ALL comments for the
   current scope (a slide, a mindmap, a document). Filter, search, jump.
5. App dock/toolbar gets ONE comments button. Icon shows a total-count
   badge. Click opens the drawer.

**Refactor / keep / build new**

| Today | Phase 4 decision |
|-------|------------------|
| `CommentsService` flat thread store | **Keep + extend** — becomes the storage layer for the new module; add anchor fields to the comment payload |
| `comments-thread` aiui surface | **Keep** — still useful for live Q&A embeds (Phase 2.2 use case). Orthogonal to the new drawer. |
| Phase 2.2 `INTENT_SLIDE_TOGGLE_COMMENTS` (toggles media slot) | **Deprecate** — wrong UX. Replace with `INTENT_COMMENTS_OPEN_DRAWER`. The media-slot embedding can stay as a documented capability but is not the primary flow. |
| `SlideDeckService.toggleComments()` | **Remove** — replaced by the generic service. Slides module only owns its dock button + element anchoring hooks. |
| `AnnotationSchema` rich payload (author, status, resolved_at, assigned_to, thread_reply_to, anchor_type, anchor_path) | **Adopt the shape** — port into the generic module's schema. Visual-editor keeps its session-coupled impl until Phase 5. |
| `CommentSidebar` (494 LOC, text-selection-coupled) | **Port + generalize** — new `CommentsDrawer` archetype. Strip text-selection coupling; accept any anchor shape. |
| `AnnotationOps` add/remove | **Generalize** — new ops accept `{anchor_type, anchor}` payloads, not text-path-specific ranges. |
| `mentions` module | **Integrate (optional)** — Phase 4 stubs the badge as a generic label; a Phase 4.1 sub-phase swaps in @mention resolution. |

**New module shape (`src/modules/comments/` after Phase 4)**

```
src/modules/comments/
├── services/
│   ├── CommentsService.js        ← existing, extended with anchor fields
│   ├── AnchorableCommentsService.js  ← NEW: inherits CommentsService,
│   │                                 adds anchor CRUD + queries by target
│   └── AnchorResolver.js         ← NEW: resolves an anchor (CSS selector,
│                                   stable id, text path) to a live DOM element
├── ui/
│   ├── CommentsDrawer.js         ← NEW: drawer component (replaces ve CommentSidebar)
│   ├── CommentPopup.js           ← NEW: click-to-add modal, hover/tap preview
│   └── CommentMarker.js          ← NEW: corner highlight + badge overlay
├── aiui/
│   ├── manifest.json             ← existing (comments-thread)
│   └── comments-drawer.json      ← NEW aiui surface for the drawer (embeddable)
├── contracts/comments-contracts.js  ← extended with anchor intents/events
└── README.md
```

**Anchor model** (the key abstraction)

An anchor identifies WHERE a comment attaches. Three primitive shapes:

```javascript
// Element anchor (most common — any clickable DOM element)
{ anchor_type: 'element', anchor: { selector: '.slide[data-index="3"] .headline' } }
// or stable id (preferred when the host app assigns one)
{ anchor_type: 'element', anchor: { id: 'slide-3-headline' } }

// Text anchor (port from visual-editor for editor apps)
{ anchor_type: 'text', anchor: { path: [...], start: 12, end: 27 } }

// Point anchor (canvas / SVG — for mindmap nodes, chart cells)
{ anchor_type: 'point', anchor: { x: 240, y: 180, scope: 'map-abc' } }
```

`AnchorResolver` turns an anchor into a live DOM element so the marker,
popup, and drawer can highlight/jump to it. Apps that want fine control
register a custom resolver; the default uses `selector` or `id`.

**Layered architecture (rides on Phase 3)**

```
LAYER 4  SLIDES APP / MINDMAP APP / VISUAL-EDITOR APP  ← integrate
LAYER 3  APP-SPECIFIC ANCHOR HOOKS  ← slide element clicks, mindmap node clicks
LAYER 2  COMMENTS-DRAWER + COMMENTS-POPUP + COMMENTS-MARKER archetypes
LAYER 1  aiui composer (mounts the drawer/popup/marker surfaces)
LAYER 0  AnchorableCommentsService (CRUD + persistence + events)
```

Phase 3 must land first because the drawer, popup, and marker are
archetypes that compose via aiui. Phase 4 builds the Layer 0 service +
Layer 2 archetypes + one Layer 3 integration (slides). Mindmap and
visual-editor integrations are follow-on sub-phases.

**Contracts sketch**

```javascript
// Intents (user/agent → service)
INTENT_COMMENT_ADD        { anchor, body, author? } → creates comment
INTENT_COMMENT_REPLY      { parentId, body, author? } → appends to thread
INTENT_COMMENT_RESOLVE    { id } → marks resolved
INTENT_COMMENT_EDIT       { id, body } → edits body
INTENT_COMMENT_DELETE     { id } → soft-deletes
INTENT_COMMENTS_OPEN_DRAWER  { scope? } → opens drawer filtered to scope
INTENT_COMMENTS_CLOSE_DRAWER { }
INTENT_COMMENTS_FOCUS      { id } → scroll + highlight a comment in drawer

// Events (service → UI)
COMMENT_ADDED             { comment }
COMMENT_RESOLVED          { id, resolvedBy, resolvedAt }
COMMENT_UPDATED           { id, changes }
COMMENT_REMOVED           { id }
COMMENTS_DRAWER_OPENED    { scope }
COMMENTS_DRAWER_CLOSED    { }
COMMENT_COUNT_CHANGED     { scope, openCount, totalCount }  ← drives dock badge
```

**Dock badge contract (cross-module)**

Apps with a dock/toolbar subscribe to `COMMENT_COUNT_CHANGED` and render
a badge on their comments button. The slides module's dock button
(`💬`) drops its Phase 2.2 `INTENT_SLIDE_TOGGLE_COMMENTS` and instead:

- on click → publishes `INTENT_COMMENTS_OPEN_DRAWER { scope: 'deck' }`
- on `COMMENT_COUNT_CHANGED` for `scope: 'deck'` → updates `data-count`
- CSS renders the badge via `::after` content from `data-count`

**Phases within Phase 4 (sub-waves)**

- **4.0 — Service + anchor model** (~half day): AnchorableCommentsService,
  AnchorResolver, schema (adopts AnnotationSchema shape), IDB persistence,
  contracts, unit tests. No UI yet.
- **4.1 — Drawer archetype + count badge** (~half day): CommentsDrawer
  archetype (port + generalize from CommentSidebar), dock badge wiring,
  remove `INTENT_SLIDE_TOGGLE_COMMENTS` from slides.
- **4.2 — Popup composer + marker overlay** (~1 day): click-to-add popup,
  hover/tap preview, corner highlight + badge marker. Desktop + mobile
  interaction modes.
- **4.3 — Slides integration** (~quarter day): wire slide element clicks
  to `INTENT_COMMENT_ADD` with `{anchor_type: 'element', anchor: {selector}}`,
  update demo, deprecate Phase 2.2 media-slot flow.
- **4.4 — @mention swap-in** (optional, ~half day): replace generic badge
  label with mention resolution via the existing `mentions` module.
- **4.5 — Visual-editor migration** (deferred): port visual-editor's
  annotation system onto AnchorableCommentsService. Not in Phase 4
  proper — Phase 5+.

**Estimated total**: ~2.5–3 days for 4.0–4.3. Sub-phases 4.4–4.5 are
follow-ons.

**What Phase 4 does NOT do**

- Real-time multi-user sync (CRDT merge) — local-first single-user for
  v1. The visual-editor `AnnotationCommentSync` model is documented as
  a future port when sync arrives.
- Per-user identity / auth integration — author is a free-form object
  for v1; auth wiring is app-specific.
- Backend persistence — local IDB only. SSMA gateway comes later.
- Migrate visual-editor annotations — that's Phase 5+ (visual-editor is
  not blocked by Phase 4 and vice versa).

**Open questions (resolve in their respective sub-phase)**

1. **Anchor stability under re-render** (4.0): when a slide re-renders,
   the same headline gets a new DOM node. CSS selector or stable id
   must survive. Lean: require host apps to stamp `data-comment-id` on
   anchorable elements; selector becomes `[data-comment-id="X"]`.
2. **Drawer vs popup as separate surfaces** (4.1/4.2): is the drawer a
   full aiui surface (registered in catalog) or a slides-owned chrome
   element? Lean: aiui surface — embeddable in any app, not just slides.
3. **Reply threading depth** (4.0): flat replies (one level) or nested?
   Lean: flat with `parentId` for v1; nested rendering if needed later.
4. **Resolved comment visibility** (4.1): show resolved in drawer with
   filter, or hide by default? Lean: show with filter toggle.
5. **Mobile popup positioning** (4.2): popover at tap point or modal
   sheet? Lean: bottom-sheet on viewport < 600px, popover at tap above.

