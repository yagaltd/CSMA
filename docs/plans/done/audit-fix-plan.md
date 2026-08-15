# CSMA Audit Remediation Plan

**Status:** complete · **Created:** 2026-02 · **Revision:** 3 (all phases landed; plan archived to `docs/plans/done/`)
**Owner:** template maintainers + agents
**Source:** full-repo audit (dead code, security, hardcoded values, performance, precision), verified by a 7-lane independent audit against the current tree.

**Final status (revision 3).** All phases 0–6 merged. Gates at merge time:
`npx vitest run` = 127 files / 1573 tests, 7 failures (the documented
pre-existing baseline in 4 files — zero growth), `npm run security-check`
all PASS with contract-drift **enforcement on** (191/191 registered),
`check:design` PASS. `npm run verify` does not exist — the real gate set is
`check:all` + `security-check` + vitest; `check:all` still reports
pre-existing backlog: legacy `--color-*` token usage (demo/visual-editor-
comments/demo-comments.css, src/modules/comments/ui/comments-drawer.css)
and the mind-node `manifest.json` rename from `2857670`. Those are recorded
below as post-plan backlog, not plan failures. All wave commits: 518f924…
f18f7dc.

**Revision 2 note — chat decision.** The chat implementation existed only on the
unmerged `feature/chat` stash (`351a0fd`, `48999cc`). Decision: **do not restore
it.** All chat-dependent phases and items from revision 1 are withdrawn. The
chat design stubs (`src/modules/chat/plan.md`, `src/ui/components/chat/plan.md`)
remain in the tree as future-work references and are not part of this plan.

**Baseline at audit time (verified on `main` @ `2857670`):** vitest
110 files / 1501 tests with **7 failures across 4 files**:

- `tests/mindmap/connector-geometry.test.js` (1)
- `tests/mindmap/layout-engine.test.js` (3)
- `tests/mindmap/search.test.js` (2)
- `tests/comments/phase-4.2-marker.test.js` (1)

`npm run security-check` green; no secrets found; no eval/document.write; CSP/DOM-sink gates operational.

> Archived to `docs/plans/done/` on merge: all phases landed and the
> enforcement gates (security-check + drift enforcement + vitest floor) have
> been green. See the "Final status" note in the header for the residual
> pre-existing backlog.

---

## 1. Purpose and scope

CSMA is a **template, not a framework**: client-side, local-first, users copy the
parts they want. Every file under `src/` is copyable reference material. This
raises the bar for correctness — a mock or a bug baked into a shared component
ships into every downstream project that copies it.

This plan organizes the audit findings into **seven phases**. Phases are ordered by
dependency, not just priority. **Within each phase, work items are grouped into
lanes with disjoint file ownership so multiple agents can work in parallel
without merge conflicts.**

### What the audit found (summary)

| Category | Finding | Scale |
|---|---|---|
| Contract drift | Events published but never registered — silently dropped by the contract-enforcing EventBus | 48 unregistered names / 64 publish sites |
| Dead code | Files with zero reachable references | 17 in `src/` + 2 root items |
| Duplication | Hand-rolled ID generators | ~20 files by mechanical grep, ~33 by broader scan |
| Debug leftovers | `console.log` in production source | 72 calls (48 in one file) |
| Performance | Whole-store persist writes on every mutation | 1 hot path (comments) |
| Runtime ambiguity | Largest runtime file (897 lines) is only imported by tests | 1 file |
| Oversized files | Multi-responsibility files >600 lines needing decomposition | see Phase 6 |
| Demo gaps | CSP meta missing on several pages, stale build artifact, docs drift | several |

The revision 1 rows for chat mocks and chat correctness bugs are withdrawn:
that code is not in the tree (see revision note).

---

## 2. Conventions and constraints for agents

Read `AGENTS.md` first. Non-negotiables while executing this plan:

1. **`textContent` only** — never `innerHTML`/`insertAdjacentHTML`/`outerHTML` for
   user data. The security checker allowlists exactly two files; do not add more.
2. **No inline styles** — visual state via `data-*` attributes and CSS classes.
   (Canvas/drag positioning is the accepted exception; do not introduce new ones.)
3. **Never edit generated artifacts** — `src/generated/tokens.css`,
   `tooling/generated/*`, `src/modules/ai-ui/catalog/componentCatalog.js`. Patch
   tokens via `src/style/token-overrides.json` + `npm run tokens:patch`.
4. **Contracts on every EventBus publish** — this plan *enforces* it (Phase 0/1).
   New events must be registered.
5. **No new `Math.random()` IDs** — Phase 3 introduces the shared generator; use it.
6. **Template philosophy** — modules may be unreferenced by demos and still be
   legitimate catalog inventory. "Zero references" alone is not dead code; the
   dead-file list in Phase 2 was derived from a full import-graph walk.
7. **Verification floor per phase**: `npx vitest run` must not grow beyond the
   7 pre-existing failures listed in the baseline (4 files named above), plus
   the phase's own acceptance commands. Before merge run the real gate set:
   `npm run check:all` + `npm run security-check` + `npx vitest run`
   (`npm run verify` does not exist in package.json).
   Fixing the 7 pre-existing failures is optional stretch, not part of any phase.

---

## 3. Phase overview

| Phase | Name | Goal | Parallel lanes | Depends on |
|---|---|---|---|---|
| 0 | Guardrails | Drift check in advisory mode; prove baseline | 1 | — |
| 1 | Contract registry completion | Register all unregistered events; flip drift check to enforcement | 2 | 0 |
| 2 | Dead code removal | Delete 17 dead files + root clutter with companion edits | 1 | — (best after 1) |
| 3 | Runtime consolidation | ID util, console.log sweep, rate-limit tests, features.js verdict, cache fallback | 2 | 1 (CACHE_PERSIST_FAILED), 2 (sweep touches deleted files) |
| 4 | Comments persistence + fanout | Dirty-write persist; optional delta payload | 1 | — |
| 5 | Demo, assets, docs | CSP audit, stale artifacts, catalog banners, data-grid rename | 2 | — |
| 6 | Modular decomposition | Split oversized multi-responsibility files along existing seams | 2 | 1, 3 (see per-item notes) |

Phases 0–5 are all small-to-medium and high value. Start 0, 1, 2, 4, 5 together
(no file overlap; 1 only needs 0's check to exist for acceptance testing, and it
already has `loadContractCollections()`). Phase 6 lands last — it reorganizes
files other phases touch.

---

## Phase 0 — Guardrails

**Goal:** make contract drift *visible* before we fix it, and lock in the baseline.

### 0.1 — Publish-vs-registry drift check (advisory)

- **Problem:** `EventBus.publish` silently drops any event not present in
  `this.contracts` and emits `SECURITY_VIOLATION`. 48 distinct names currently
  drift (64 publish sites). Nothing detects this class of bug.
- **Files:** `tooling/scripts/check-security.js` (extend only).
- **Fix:** add a check that (a) walks `src/` for
  `publish('NAME')` / `publishSync('NAME')` string-literal calls, (b) collects
  registered names from `src/runtime/Contracts.js` + every
  `src/modules/*/contracts/*-contracts.js` (loader already exists —
  `loadContractCollections()`), (c) reports the diff. Report **both distinct
  unregistered names and total occurrence count**. Ship in **advisory mode**: a
  `CSMA_ENFORCE_CONTRACTS=1` env var (or a constant at the top of the script)
  controls pass/fail; default warns. Phase 1 flips it.
- **Do not** try to regex dynamic publishes (`publish(name, ...)` with a
  variable) — out of scope; a comment in the script should say so.
- **Do not trust the 48 figure** — regenerate the list with the scanner and
  commit it via 0.2. The number is verified against `main` @ `2857670` but the
  list itself is the deliverable.
- **Acceptance:** `node tooling/scripts/check-security.js` prints the full drift
  list as a warning, exit 0. With `CSMA_ENFORCE_CONTRACTS=1`, exit 1 today.
- **Test:** a vitest case that runs the collector functions directly against a
  fixture pair (one registered, one not).

### 0.2 — Baseline pin

- Commit the current drift list (output of 0.1) to
  `tooling/generated/contract-drift-baseline.json` (generated artifact — produced
  by a `--write-baseline` flag on the check, never hand-edited). Phase 1 deletes it.

---

## Phase 1 — Contract registry completion

**Goal:** zero drift; Phase 0's check flips to enforcement.

### Lane R1 — runtime + services/core events (Contracts.js / core services)

Register (into `src/runtime/Contracts.js` unless a module contract file exists):

- **ChannelManager:** `CHANNEL_SUBSCRIBED`, `CHANNEL_UNSUBSCRIBED`,
  `CHANNEL_COMMAND_REQUEST`, `CHANNEL_ACCESS_REVOKED`, `CHANNEL_SERVER_CLOSE`.
  Note: `CHANNEL_COMMAND_RESULT` is **not** ChannelManager's — it is emitted by
  `SyncTransportService.js:228`; register it under the optimistic-sync module
  (Lane R2).
- **APIWrapper:** `API_REQUEST_START/SUCCESS/ERROR/RETRY`.
- **FormValidator:** `FORM_VALIDATION_PASSED/FAILED`,
  `FIELD_VALIDATION_STARTED/PASSED/FAILED`.
- **DataAggregator:** `DATA_AGGREGATION_STARTED/COMPLETED/FAILED`.
- **CrossTabLeader:** `LEADER_STATE_CHANGED`.
- **CacheManager:** `CACHE_PERSIST_FAILED` (emitted by Phase 3.5).

Schema discipline: these are observability events — minimal schemas
(`{ requestId?, duration?, error?, timestamp }` style), each with canonical
`rateLimits` (the checker requires `{ requests, windowMs, scope }` on intents;
observability events may use generous limits, e.g. 600/60s/session).

### Lane R2 — module events

- **storage module (no contracts dir — create one):** `STORAGE_READY/ADDED/
  UPDATED/DELETED/CLEARED` → `src/modules/storage/contracts/storage-contracts.js`,
  wire into module index (ModuleManager merges on load).
- **i18n (no contracts dir):** `LANGUAGE_CHANGED`, `LOCALE_LOADED`.
- **optimistic-sync transport:** regenerate the exact list with the Phase 0
  scanner — do not trust the count in this table. Known at audit time: 13 names
  from `SyncTransportService` (incl. `CHANNEL_COMMAND_RESULT`,
  `CHANNEL_SERVER_*`, `CHANNEL_ACCESS_DENIED`, `ISLAND_INVALIDATED`), 4 from
  `OptimisticSyncService`, 2 from `SyncStateTracker`, 1 from `CrdtReducerRegistry`
  (`OPTIMISTIC_CRDT_STATE_CHANGED`). Revision 1 undercounted this group ("12").
- **Single stragglers** into their module's existing contracts file:
  `SEARCH_INDEX_BATCH_UPDATED` (search), `SELECT_ANNOTATION` (visual-editor),
  `MINDMAP_VIEWPORT_CHANGED`, `MINDMAP_KEYBOARD_SHORTCUT` (mindmap).
- **Do NOT re-register** `SHARE_COMPLETED` / `SHARE_FAILED` — already registered
  (`share/contracts/share-contracts.js:29,47`) and wired via `share/index.js:23`.
  Revision 1 listed them as drift; that was wrong.
- **Demo-only events** (`INTENT_TODO_*`, `TODO_STATE_CHANGED`, `ITEM_SAVED`):
  register in a `demo/`-scoped contracts file loaded by the demo pages **or**
  keep demos on a raw no-contracts EventBus and scope the drift check to `src/`
  only. Recommendation: scope the check to `src/` — demos are teaching material,
  not production surface. (Decision D2.)

### Phase 1 acceptance

- `CSMA_ENFORCE_CONTRACTS=1 node tooling/scripts/check-security.js` → exit 0.
- Flip the default to enforcement; delete the Phase 0 baseline JSON.
- `npm run security-check` green in enforcement mode.

---

## Phase 2 — Dead code removal

**Goal:** delete files proven unreachable by the import-graph walk (entries:
all demo/showcase/public HTML + JS, tests, tooling, every module `index.js` +
contracts file — the ModuleManager dynamic-import surface).

**Verdicts are pre-made against `main` @ `2857670`; do not re-litigate without
new evidence.**

| File | Disposition |
|---|---|
| `_vthree.mjs` (root) | Delete — Playwright scratch script |
| `rebuild_minmap.md` (root) | Move to `docs/archive/` or delete — stale one-off plan |
| `src/runtime/deliveryPresets.js` | Delete — SSMA port, zero refs; if delivery presets return, git history + SSMA repo hold it |
| `src/runtime/storageClassification.js` | Delete — zero refs; flag in commit message that security-relevant logic is being removed unreferenced (reviewer sanity check) |
| `src/style/theme/theme-entry.js` | Delete — zero refs |
| `src/utils/classNameSanitizer.js` | Delete — zero refs; dynamic import string-builds verified absent |
| `src/modules/visual-editor/commands/*` (**10 files**: BreakNodeCommand, Command, CommandRegistry, DeleteSelectionCommand, InsertNodeCommand, JoinNodeCommand, RedoCommand, SelectParentCommand, ToggleMarkCommand, UndoCommand) | Delete — unwired command-pattern scaffolding; visual-editor uses its own history stack. **Companion edit:** remove `export { CommandRegistry } from './commands/CommandRegistry.js';` at `visual-editor/index.js:57`. Verified no runtime consumers (only a JSDoc mention in `input/KeyMapper.js:16` and a README file tree — the live registry is `src/runtime/CommandRegistry.js`, imported by `bootstrap.js:9`). Revision 1 said "9 files"; it is 10. |
| `src/modules/video/services/VideoCompositionService.js` | Delete — zero imports. **Companion edits:** stale text refs in `video/aiui/manifest.json:2,33` and `ai-ui/catalog/componentCatalog.js:2011` must be removed via the catalog generator (never hand-edit generated files). |
| `src/services/FileUploadService.js` (1-line re-export shim) | Delete — **companion edit:** `tests/file-upload-service.test.js:5` imports the shim as a legacy alias; re-point it at the module path (its `:4` sibling import shows the pattern). |
| `src/services/core/AuthService.js` (1-line re-export shim) | Delete — **companion edit:** `tests/auth-service.test.js:2` imports the shim; re-point at `src/modules/auth/...`. |

**Explicitly NOT in this phase:**

- `src/modules/media/workers/transform-worker.js` — **live code.** Spawned by
  `MediaService.js:339-340` (`new Worker` on every transform in modern browsers).
  Revision 1 claimed it was never spawned; that was wrong.
- `src/runtime/WorkerBroker.js` — imported only by tests today; needs a verdict
  (Decision D3), not deletion.
- `features.js`, `ssma.js`, `tile-manifest-parser.js`, `DocumentCapabilities.js`,
  zero-ref *modules* (`data-table`, `layout`, `network-status`, `sync-queue`) —
  those need verdicts (Phase 3 / Decision D3), not deletion. Note: `layout`
  shows no wiring anywhere (no `loadModule('layout')`, no imports, only
  comment mentions) — strongest dead-module candidate.
- `csp-fix-plan.md` — **does not exist.** Revision 1 listed a phantom path; the
  row is removed.

**Acceptance:** `npx vitest run` green with migrated tests (no growth beyond the
7 baseline failures), `npm run verify` green, `rg -n "deliveryPresets|storageClassification|classNameSanitizer|theme-entry|commands/UndoCommand|_vthree" src/ demo/ tests/ tooling/` → empty, and no remaining imports of the two shim paths.

---

## Phase 3 — Runtime consolidation

### Lane U1 — identity + noise

**3.1 Shared ID generator.**
Create `src/utils/id.js`:

```js
export function uid(prefix = '') {
  if (globalThis.crypto?.randomUUID) return prefix ? `${prefix}-${crypto.randomUUID()}` : crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

Sweep the duplicating files (analytics, checkout, media, modal, history, slides,
sync-queue, location, file-system, file-upload, optimistic-sync, mindmap,
comments-picker, inline-text-editor, CrossTabLeader, LogAccumulator — the
mechanical grep finds ~20; broaden to `crypto.randomUUID` hand-rolls in
AuthService, NotificationsService, WorkerBroker, visual-editor/engine/* for a
total of ~33 candidates — **enumerate precisely at execution time**). Mechanical;
keep behavior (return shape) identical where prefixes differ. Run after Phase 2
merges — the sweep must not touch deleted files.

**3.2 console.log sweep.**
72 call sites, all verified. `features.js` owns 48 — **land 3.4's verdict
first**, then sweep the remainder: ServiceManager 8, ThreadManager 4,
ModuleManager 2, toast 3, services/core 4, misc. (Note: these live in
`src/runtime/`, not `src/services/` — revision 1 had the paths wrong.) Convert
to `console.debug` behind a debug flag or delete. Add a security-check rule:
`console.log(` banned in `src/` outside an allowlist of zero files.

### Lane U2 — runtime behavior

**3.3 Rate limiting — REVISED, not a bug fix.**
Revision 1 claimed EventBus rate-limits on a global `'anonymous'` bucket. False:
`RateLimiter.js:38` already keys by `storageKey = sessionId-key` (session id
generated via `crypto.randomUUID()`), and no module contract uses
`scope: 'user'`. Remaining work: (a) add unit tests proving per-session
isolation — **none exist today** (no test imports RateLimiter); (b) optionally
rename the literal `'session'` scope string if it reads as user-facing. No
behavior change required.

**3.4 `features.js` verdict — DECISION REQUIRED (D1).**
897 lines, imported only by 8 test files; contains its own localStorage
adapters, a `/locales` fetch, and the repo's largest console.log cluster.
Options:
(a) **Quarantine** — move to `docs/legacy/features.js` with a README note (it
documents the SSMA-era full-runtime feature matrix), update the wave tests to
import from the new location or delete those specific assertions; or
(b) **Wire** — declare it the canonical full-runtime bootstrap, strip the debug
logs, give it a smoke test.
Recommendation: (a). Related: demos do not import `runtime/bootstrap.js` — they
hand-roll EventBus/service wiring. Whatever the verdict, document which
bootstrap path is canonical so the ambiguity closes with this item.

**3.5 CacheManager quota guard — REVISED, partially landed.**
The localStorage backend **already** wraps `setItem` in try/catch with a
"Quota exceeded" `console.warn` (`CacheManager.js:492-500`). Remaining delta:
on failure, drop that key to memory-only for the session + emit
`CACHE_PERSIST_FAILED` (register it — Phase 1 Lane R1).

**Acceptance:** vitest green; `rg -n "Math.random\(\).toString\((16|36)\)" src/`
only hits `src/utils/id.js`; `rg -c "console\.log\(" src/` → 0; RateLimiter
isolation tests added and green.

---

## Phase 4 — Comments persistence + fanout

(Revision 1's chat render-pipeline items are withdrawn with the chat code.)

**4.1 Dirty-write persistence.**
`AnchorableCommentsService._flushPersist` rewrites **every** comment every
~50ms-debounced flush. Fix: track a dirty Set (`_dirty.add(id)` on every
mutation, cleared per flush); flush only dirty records; full rewrite only in
`_loadFromStore` recovery paths.

**4.2 `COMMENTS_UPDATED` delta fanout (optional, additive).**
`CommentsService.publish()` ships the full items array. Fix: keep the event
name; payload becomes `{ items, delta: { added, updated, removedIds }, data }`
where `items` remains for one minor cycle. **Consumer reality check:** the
primary consumer today is `CommentsService`'s own `mountSurface`; the slides
integration does not subscribe to `COMMENTS_UPDATED`. Update
`tests/comments/*` expectations accordingly. If no real consumer needs the
delta, skip this item — do not build speculative plumbing.

**Acceptance:** vitest green; a test asserting a mutation flush writes only the
dirty records (spy on the backend) and not the full store.

---

## Phase 5 — Demo, assets, docs

### Lane D1 — auth (no work — already landed)

Revision 1 claimed every auth flow 404s at runtime. That was stale:
`demo/app.js` already serves `/demo-auth/*` via `installDemoAuthBackend()`
(client-side fetch interceptor, `demo/app.js:267,642`) — no server stub needed.
Keep the `demo-only` guard in mind if anything auth-related changes; nothing to
do here.

### Lane D2 — assets + CSP

**5.2 CSP meta pattern — REVISED.** Four pages already ship a CSP meta tag:
`demo/index.html`, `demo/newsletter-dashboard.html`, `demo/archetypes-demo.html`,
`showcase/token-showcase.html`. `resolveCspMeta` does **not** exist anywhere —
do not invent it. Work item: audit the remaining demo/showcase pages, add the
canonical meta matching the security-check template output to pages that lack
one (nonce-free, `script-src 'self'`, externalized inline module scripts where
feasible).

**5.3 Stale artifact.** `dist/chat-assets/interactive-analytics.html` is a
stale local build artifact (untracked; the source page is gone). Delete the
stale `dist/` directory contents — build output, safe to remove locally.

### Lane D3 — documentation truth

**5.4** `docs/chat-port.md` does not exist and `demo/chat*.html` does not exist
— the revision 1 items about them are withdrawn. No action.

**5.5 Catalog-only labels.** `data-table`, `network-status`, `sync-queue`
READMEs exist; `layout` has **no README**. Add to the three existing READMEs a
banner: *"Catalog-only module: not wired into any demo; not yet certified. Run
`npm run certify:module` before relying on it."* For `layout`, either create
the README with the banner or resolve its fate via Decision D3 (it appears
genuinely unwired).

**5.6 Tests.** `tile-manifest-parser.test.js` already exists with a happy-path
fixture — no work. `DocumentCapabilities` has no dedicated test and no
catalog-only banner: add one happy-path test (or the banner).

**5.7 `data-grid` option `fetch` shadows global `fetch`.** Real bug at
`src/modules/archetypes/data-grid/data-grid.js:198` (revision 1 wrote the path
without `modules/`). Rename to `fetchData` with a deprecation shim reading the
old `fetch` option; check archetype consumers (`stats-dashboard` passes
`cardDef.fetch` — verify call sites).

### Phase 5 acceptance

- `rg -ln "Content-Security-Policy" demo/ showcase/` covers every page.
- `rg -n "cardDef\.fetch|fetch:" src/modules/archetypes/` → only the deprecation shim reads `fetch`.
- `ls dist/chat-assets` → gone (or whole stale `dist/` removed).
- vitest green.

---

## Phase 6 — Modular decomposition

**Goal:** make oversized files maintainable and debuggable by splitting **only
where distinct responsibilities are mixed**. This phase is deliberately last:
it reorganizes files other phases touch, so it lands after their behavioral
changes merge.

### Split rules (apply to every item below)

1. **Single-file services are a template feature, not a smell.** CSMA users
   copy files. A cohesive 600-line service that does one thing is more
   copyable than five 120-line fragments with import webs. Split only when
   the file mixes unrelated concerns (clear section seams, divergent change
   cadence, or orthogonal test needs).
2. **Public API stays frozen.** Every split keeps the module's `index.js`
   re-exporting the same names; `import { X } from '../module/index.js'`
   never changes. Consumers and the aiui catalog must not notice.
3. **Target ≤ ~400 lines per piece**, one responsibility each, no circular
   imports (child utilities never import the parent service).
4. **Move code, don't rewrite it.** No behavior changes, no renames beyond
   what extraction forces. Diff review must read as cut/paste.
5. **Tests split with the code** — the extracted piece gets its own test file
   where the parent's tests referenced the section directly.

### Verdict table — every hand-written `src/` JS file > 600 lines

(All line counts verified exact at audit. Non-JS files — `design-tokens.json`
1911 lines, `slides/layouts.css` 924 — are out of scope for splitting.)

| File | Lines | Verdict | Rationale |
|---|---|---|---|
| `ai-ui/catalog/componentCatalog.js` | 2071 | **Never split** | Generated artifact ("Do not edit manually" header; `generate-ai-ui-catalog` writes it). Size follows catalog growth. |
| `mindmap/services/MindmapService.js` | 1857 | **Split now** (M1) | God object with 13 labeled sections: Maps, Node CRUD, Structure, Undo/Redo, Search, Arrows, Serialization, Layout direction, Text measurement, aiui mount, Focus/isolation, Helpers, plus "Layout convenience (renderers call this)" at :1485. Divergent change cadence — undo/redo and serialization evolve independently of CRUD. |
| `runtime/Contracts.js` | 1594 | **Split registry, keep facade** (M2) | Central registry duplicates the pattern module contracts already follow. Runtime's own events (CHANNEL_*, LEADER_*, API_*, VALIDATION_*) move to `src/runtime/contracts/*.js` files merged by the same `loadContractCollections()` walk Phase 0 added (extend its walk to `src/runtime/contracts/`). `Contracts.js` stays as the re-export facade so `eventBus.contracts = Contracts` keeps working. |
| `ai-ui/services/AIUIComposerService.js` | 1254 | **Split ops by section** (M1, second) | Composer mixes op application, op validation, history/batching. Extract after MindmapService proves the pattern. |
| `file-upload/services/FileUploadService.js` | 1179 | **Split adapters from core** (M2) | Upload flow (progress, retry, cancel) tangled with storage backend adapters. Extract `adapters/`; core flow stays one file. |
| `auth/services/AuthService.js` | 986 | **Split with care** (M2, gated) | Token lifecycle + flows + OAuth + session — security-critical. Split along existing seams (`tokenStorage`, `oauth`, `session`) only after Phase 1 contracts land; every existing auth test must stay green with zero edits. If extraction forces touching test expectations, defer. |
| `runtime/features.js` | 897 | **N/A** | Phase 3.4 verdict (recommended: quarantine) resolves it — no split either way. |
| `analytics/services/AnalyticsService.js` | 879 | **Split transport from batching** (opportunistic, M2) | Event batching + queue + transport are separable. Low risk; do with M2 if capacity allows, else backlog. |
| `visual-editor/services/EditorSessionService.js` | 784 | **Leave** | Session orchestration is one responsibility; engine siblings (Transaction 711, NodeValidator 617) are already separate cohesive units. |
| `notifications/services/NotificationsService.js` | 759 | **Leave** | Platform dispatch + scheduling are cohesive; no section seams demand extraction. |
| `runtime/MetaManager.js` | 740 | **Leave** | One job (document meta), linear structure. |
| `file-explorer/services/FileExplorerService.js` | 719 | **Leave** | Tree + selection + providers for one surface. |
| `modules/archetypes/data-grid/data-grid.js` | 683 | **Leave** | Archetypes are copyable units by charter; splitting hurts the copy story. (Note the `modules/` path — revision 1 omitted it.) |
| `mindmap/services/NodeDragHandler.js` | 663 | **Leave** | One interaction, one file. |
| `file-system/services/LocalFileAccess.js` | 649 | **Leave** | Adapter surface for one capability. |
| `services/core/CacheManager.js` | 646 | **Split backends out** (with M2) | Three backends (memory/localStorage/IndexedDB) are inline classes. Extract `backends/` — trivial, pure move; also the natural home for 3.5's memory fallback. |
| `comments/ui/CommentsDrawer.js` | 636 | **Leave** | One drawer, one file. |

Tooling scripts (`generate-project-artifacts.js` 749, `check-styles.js` 522,
`generate-tokens.js` 489, `create-component.js` 484): **leave.** Node-side,
not copied by template users, each is one CLI concern. Revisit only if a
script grows past ~1000 lines.

### Lane M1 — mindmap + aiui splits

**6.1 MindmapService → service + engine pieces.** Split along the file's own
section banners into `src/modules/mindmap/services/` siblings (suggested:
`MindmapUndo.js`, `MindmapSearch.js`, `MindmapArrows.js`,
`MindmapSerialization.js`, `MindmapLayout.js`, `MindmapTextMeasure.js`), with
`MindmapService.js` keeping CRUD + orchestration and importing the pieces. All
existing mindmap tests must pass unmodified (including the 6 pre-existing
failures — do not fix or mask them here).
**6.2 AIUIComposerService → same pattern** after 6.1 merges: op-apply /
op-validate / history extracted; facade service keeps the public surface.

### Lane M2 — runtime + core splits

**6.3 Contracts.js → `src/runtime/contracts/`** as described in the verdict
table. Extend `loadContractCollections()`'s walk to `src/runtime/contracts/`.
Zero behavior change; drift check stays green throughout.
**6.4 CacheManager backends → `services/core/cache/backends/`** — pure move;
implement 3.5's memory fallback in the new localStorage backend file.
**6.5 FileUploadService adapters → `file-upload/services/adapters/`.**
**6.6 AuthService split (gated)** — see verdict table; defer freely.
**6.7 AnalyticsService transport (opportunistic).**

### Phase 6 acceptance

- Every `index.js` public surface unchanged (`rg` the old import paths — zero
  consumer edits).
- `npx vitest run` green with no growth beyond the 7 baseline failures; split
  pieces have their own test files where the parent tests referenced the section.
- `npm run security-check` green (6.3 must not regress the drift check).
- `wc -l` — no remaining hand-written `src/` JS file > 1000 lines
  (generated `componentCatalog.js` exempt).

---

## 7. Decisions required (blocking for marked items)

| # | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| D1 | `features.js` fate | quarantine to `docs/legacy/` vs wire as canonical | Quarantine — demos hand-roll their wiring; 8 test files are the only importers | 3.2, 3.4 |
| D2 | Drift-check scope | `src/` only vs `src/` + `demo/` | `src/` only; demos are teaching material | Phase 1 Lane R2 tail |
| D3 | Zero-ref modules (`data-table`, `layout`, `network-status`, `sync-queue`) + zero-ref runtime files (`WorkerBroker`) | certify vs label catalog-only vs delete | Label now, certify opportunistically; `layout` shows no wiring at all — strongest delete candidate of the four | 5.5, 3.3(a) note |
| D4 | AuthService split (6.6) | split along seams vs defer | Defer unless tests stay green unmodified | 6.6 |

---

## 8. Out of scope (recorded, not scheduled)

- **Chat restoration.** The chat implementation lives only in the `feature/chat`
  stash (`351a0fd`, `48999cc`) and is deliberately **not restored**. All chat
  audit items (revision 1 Phase 1, Phase 5 chat items, 1.14–1.18) are withdrawn.
  `src/modules/chat/plan.md` and `src/ui/components/chat/plan.md` remain as
  future-work design notes.
- The **7 pre-existing test failures** (mindmap connector-geometry, layout-engine,
  search, comments phase-4.2-marker). Phases must not grow them; fixing them is
  a separate, tracked effort outside this plan.
- True SSE token streaming in `GeminiProvider` (current: single completion-time
  `onStream({done:true})` — pseudo-streaming). Documented behavior; changing it
  is a provider-protocol task, not remediation.
- Server-side anything — template is client-side/local-first by charter.
- Replacing per-module `Date.now` clocks with an injectable clock for
  testability (nice-to-have; would touch many Phase 3 files again).
- Splitting cohesive 400–650-line services that the verdict table marks
  "Leave" — single-file copyability is a template feature; revisit only when
  a file actually accumulates a second responsibility.

---

## 9. Parallelization matrix

| Lane | Owns (exclusive) | Phase | Conflicts to watch |
|---|---|---|---|
| G | `tooling/scripts/check-security.js` | 0, 1 | R1/R2 register events — flip order documented |
| R1 | `src/runtime/Contracts.js`, `src/services/core/*` contracts touch | 1 | 6.3 reorganizes Contracts.js — run M2 after R1 |
| R2 | `src/modules/{storage,i18n,optimistic-sync,search,share,mindmap,visual-editor}` contracts | 1 | none |
| X | deletions only (list in Phase 2) + companion test/manifest edits | 2 | verify nothing in other lanes imports these (they don't — graph-proven; shim imports migrate in this lane) |
| U1 | `src/utils/id.js` + sweep files | 3 | touches files X deletes → run after Phase 2 merge |
| U2 | `RateLimiter.js`, `CacheManager.js`, `features.js` | 3 | 3.4 before 3.2 |
| P | `AnchorableCommentsService.js`, `CommentsService.js`, `tests/comments/*` | 4 | none |
| D1 | (no work — auth already landed) | 5 | — |
| D2 | demo/showcase HTML heads, stale `dist/` | 5 | none |
| D3 | `docs/*`, module READMEs, `src/modules/archetypes/data-grid/data-grid.js` | 5 | none |
| M1 | `src/modules/mindmap/services/*`, `src/modules/ai-ui/services/*` | 6 | after Phase 4 (comments render paths); see 6.1 note |
| M2 | `src/runtime/Contracts.js` + new `src/runtime/contracts/`, `src/services/core/CacheManager.js`, `file-upload`, `auth` (gated), `analytics` | 6 | 6.3 after Phase 1; 6.4 after 3.5 |

**Suggested first wave (max parallelism):** G(0) + R1 + R2 + X(2) + P(4) + D2 +
D3(5) — seven lanes, zero file overlap. Wave 2: U1 + U2 + flip enforcement.
Wave 3: M1 + M2.
