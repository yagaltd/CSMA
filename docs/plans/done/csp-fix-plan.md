# CSP Fix Plan — CSMA

**Status:** not a security hole. CSP is already enforced. This is a **maintainability + correctness** cleanup, plus one real gap (`frame-ancestors` inert in `<meta>`).

**Scope:** CSMA frontend only. SSMA (Rust gateway) serves no HTML and has no CSP role. The `meta-manager` module is SEO-only and is not touched.

**Acronym:** CSP = Content-Security-Policy. (File named `csp-fix-plan.md`.)

---

## 1. TL;DR

- CSP **is active** today: a hardcoded `<meta http-equiv="Content-Security-Policy">` sits in every entry HTML, and `npm run security-check` enforces the `demo/index.html` copy.
- The problem is **maintainability**: each entry HTML hand-pastes its own policy string, and the runtime's `SecurityPolicy.csp.template` is **dead config that has already drifted** from the real policies.
- The hand-pasted policies are **not identical** — two entries (`archetypes-demo`, `newsletter-dashboard`) legitimately need looser directives (a CDN script origin, `style-src 'unsafe-inline'`). A naive single-source-of-truth would silently break them.
- There is **one real gap**: `frame-ancestors 'none'` is in every `<meta>`, but that directive is **ignored in meta form** — so clickjacking protection is not actually enforced. Closing it needs an HTTP header layer (reverse proxy), not more HTML.
- **Fix:** make `SecurityPolicy.csp` the single source — as a **per-entry map** (`core` + `entries`) plus a `header` block — inject the `<meta>` from one place per entry, delete the hand-pasted copies, and update the CI check to validate the config.

---

## 2. Verified architecture (who serves what)

| Component | What it is | Serves HTML? | CSP role |
|---|---|---|---|
| **CSMA** | Static SPA (Vite build → static HTML/JS) | **Yes — the built HTML is the deployment** | `<meta>` CSP (correct channel for static hosting) |
| **SSMA** | Rust/axum **JSON** gateway (WS/SSE/REST). No `text/html`, no SSR, no hydration. Docs: *"gateway only"*, UI *"out of scope"* | **No** | None |
| **Reverse proxy** (nginx/Caddy/cloud) | Mandated by SSMA docs (*"run behind HTTPS reverse proxy"*). Not in repo. | Fronts everything | Natural place for CSP **header** + `frame-ancestors` |

CSMA delivery channel for CSP = `<meta>` only (no server in CSMA, SSMA doesn't serve these pages). That is the correct choice for this architecture.

---

## 3. The three components named "meta/security" (disambiguation)

These are easy to conflate. They are **different files with different jobs**:

| Component | Path | Role | Touched by this plan? |
|---|---|---|---|
| **Runtime `MetaManager` class** | `src/runtime/MetaManager.js` | Isomorphic `<head>` applier. Supports `http-equiv` (dedup key + selector + `normalizeMetaTag`). Browser: mutates DOM. SSR: returns `snapshot()` data. | Used (as applier) — **no code change needed** for the client fix |
| **`meta-manager` module** | `src/modules/meta-manager/` | SEO layer (schema.org / Open Graph / hreflang). Consumes the runtime MetaManager. | **No** — CSP is not SEO |
| **`SecurityPolicy`** | `src/runtime/SecurityPolicy.js` | Owns the security policy config incl. `csp`. | **Yes** — becomes the single source |

---

## 4. Current state (the drift + divergence + dead code)

### 4.1 Hardcoded `<meta>` — the actually-enforced policies, **not identical**

Every entry HTML hand-pastes its own `<meta http-equiv="Content-Security-Policy">`. They **differ**, and the differences are **legitimate needs, not drift**:

| Entry HTML | `script-src` | `style-src` | Why it differs |
|---|---|---|---|
| `demo/index.html` | `'self'` | `'self'` | Strict baseline (the app shell) |
| `showcase/token-showcase.html` | `'self'` | `'self'` | Strict baseline (token inspector) |
| `demo/newsletter-dashboard.html` | `'self'` | `'self' 'unsafe-inline'` | 13 inline `style="…"` attributes in the file |
| `demo/archetypes-demo.html` | `'self' https://cdn.jsdelivr.net` | `'self' 'unsafe-inline'` | Loads `chart.js@4.4.0` from jsDelivr (`<script src="https://cdn.jsdelivr.net/npm/chart.js@…">`, line 13); inline styles |

Shared core (present in all four): `default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; connect-src 'self'`.

**Implication:** a single-source-of-truth must be a **per-entry map**, not one string. Collapsing to the strict `index.html` policy would block Chart.js in `archetypes-demo` (script throw) and break `newsletter-dashboard` styling — silently, because `checkCsp()` only tests `demo/index.html`.

### 4.2 Dead runtime config

`src/runtime/SecurityPolicy.js` (~line 33):

```js
csp: {
    required: true,
    template: "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; connect-src 'self'"
}
```

Zero consumers in `src/` (verified by grep — no `.csp` / `csp.template` reads anywhere in `src/` or `tooling/`). And it has **drifted** — missing `style-src` and `img-src` that every real (HTML) policy has, and it has no concept of the per-entry CDN/inline exceptions.

### 4.3 CI check

`tooling/scripts/check-security.js` → `checkCsp()`: reads `demo/index.html` **source**, asserts required directives present + no `'unsafe-inline'` in `script-src`. It does not inspect the other three entries, so it cannot detect divergence between them.

### 4.4 Bootstrap

`src/runtime/bootstrap.js`: instantiates `new MetaManager(eventBus)` (~L42) **and** resolves the policy via `resolveSecurityPolicy()` (~L128), but **never connects them** for CSP.

---

## 5. Design principle — separate SOURCE from APPLIER

The CSP **string(s)** and the CSP **injection mechanism** are different concerns and must live in different places:

- **Source of truth** → `SecurityPolicy.csp` (the security policy file owns policy text — now as `core` + per-entry `entries` + `header`).
- **Applier** → runtime `MetaManager` (a generic head manager; it injects, it does **not** define). Hardcoding a CSP string inside MetaManager would be a smell.
- **`meta-manager` module** → unchanged (SEO only).

MetaManager and the module are the **applier/consumer**, never the **source**.

---

## 6. "What goes where" — the target state (crystal clear)

```
                         SOURCE (one, per-entry)
   SecurityPolicy.csp.core      ── shared meta-effective core
   SecurityPolicy.csp.entries   ── per-entry meta deltas (script-src/style-src …)
   SecurityPolicy.csp.header    ── header-only directives (inert in <meta>)
                 │
                 │  resolveCspMeta(entryId) → core + " " + entries[entryId]
                 ▼
   read by ──────────────────────────────────────────────────┐
                                                              │
   APPLIER A (runtime/client)          APPLIER B (build/static)   HOST LAYER (deploy)
   bootstrap.js                        tooling/scripts/             reverse proxy (nginx/Caddy)
   metaManager.push({meta:[…]})        csp-html-plugin.js           sets CSP HTTP header +
   with the entry id for the           Vite transformIndexHtml:     frame-ancestors / frame-src
   current route → <head>              bakes the per-entry <meta>   (closes the gap)
                                      into each entry HTML at
                                      serve + build
```

- Both appliers read the **same** `resolveCspMeta(entryId)` — never diverge.
- Entry id = derived from the HTML path (`demo/index` → `demo/index`, `showcase/token-showcase` → `showcase/token-showcase`, …). Unknown id → `entries.default`.
- Applier A (runtime MetaManager `push`) is idempotent; if A and B both run, the `http-equiv` dedup key collapses them to one tag.
- The `meta-manager` module is **not in this diagram** — it continues SEO work on the same runtime MetaManager, independently.

---

## 7. The changes — now-fix (per file)

### 7.1 `src/runtime/SecurityPolicy.js` — restructure `csp` (SOURCE)

Replace the single `template` string with a **per-entry map**. Separate meta-effective directives from header-only ones (`frame-ancestors`/`frame-src`/`sandbox`/`report-to` are **ignored in `<meta>`** — stop pretending otherwise). Add a small resolver.

```js
csp: {
    required: true,
    // Meta-effective core, prepended to every entry's policy.
    core: "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; connect-src 'self'",
    // Per-entry meta deltas. key = entry id (html path without extension, relative to repo root).
    // 'default' is the fallback AND the real app-shell policy. Keep it strict.
    entries: {
        default:                     "script-src 'self'; style-src 'self'",
        'demo/index':                "script-src 'self'; style-src 'self'",
        'showcase/token-showcase':   "script-src 'self'; style-src 'self'",
        // Intentional, documented exceptions (see §4.1):
        'demo/newsletter-dashboard': "script-src 'self'; style-src 'self' 'unsafe-inline'",
        'demo/archetypes-demo':      "script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'"
    },
    // Header-only directives — need a host/edge layer (reverse proxy). Inert in <meta>.
    header: "frame-ancestors 'none'; frame-src 'none'",
    // Back-compat combined string for any existing reader of .template (strict default only).
    template: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; connect-src 'self'"
}
```

Add a resolver (exported, used by both appliers and CI):

```js
export function resolveCspMeta(entryId = 'default') {
    const { core = '', entries = {}, header = '' } = resolveSecurityPolicy().csp || {};
    const delta = entries[entryId] ?? entries.default ?? '';
    return {
        meta: `${core}${delta ? ' ' + delta : ''}`.trim(),
        header
    };
}
```

**Impact:** revives dead config; becomes the single source; encodes the per-entry reality instead of hiding it.
**Why:** one source of truth that still admits legitimate per-page exceptions; makes the `frame-ancestors` gap visible instead of hidden.

### 7.2 `src/runtime/bootstrap.js` — wire the applier (APPLIER A)

After `metaManager` is created and `policy` is resolved, inject the CSP meta. **Use the low-level `push()` API with a `meta` array** — not `updateMeta()`. `updateMeta()` → `setPageMeta({title, description, …})` destructures SEO fields and **silently ignores** a `tags` property; a `tags:[{tag,props}]` argument would do nothing.

```js
import { resolveCspMeta } from './SecurityPolicy.js';
// …after metaManager exists and the active route/entry id is known:
metaManager.push(
    {
        meta: [
            {
                'http-equiv': 'Content-Security-Policy',
                content: resolveCspMeta(currentEntryId).meta
            }
        ]
    },
    { owner: 'csp', key: 'csp', safe: true, priority: 100 }
);
```

`normalizeMetaTag` reads `'http-equiv'` as a target attr (it's in `META_TARGET_ATTRS`), and the dedup key + selector (`meta[http-equiv="Content-Security-Policy"]`) are already implemented — **no change to MetaManager itself**. The `key: 'csp'` / `owner: 'csp'` make it removable/replaceable on route change.

**Determining `currentEntryId`:** the entry id is the active HTML path. For the SPA app shell this is `demo/index` (the served entry). If CSMA later adds routing that swaps shells, re-call `push` with the new entry id (MetaManager dedup handles replacement).

**Impact:** the dormant policy becomes live at runtime; route-specific overrides become real instead of bake-time copies.
**Why:** uses the existing isomorphic head manager; zero new infra; correct API.

### 7.3 (Optional) `tooling/scripts/csp-html-plugin.js` + `vite.config.js` — bake into static HTML (APPLIER B)

A Vite plugin using `transformIndexHtml` to inject/replace the `<meta>` in **each** entry HTML from `resolveCspMeta(entryId)`, where `entryId` is derived from the HTML's path. For each transformed file it must: (a) strip any existing `meta[http-equiv="Content-Security-Policy"]`, then (b) prepend the canonical one for that entry. Register in `vite.config.js`:

```js
plugins: [copyTokenShowcaseScript(), cspHtmlPlugin()]
```

**Critical:** the plugin must select the entry by **file path** so `archetypes-demo` keeps its jsDelivr script origin and `newsletter-dashboard` keeps `'unsafe-inline'` styles. A blanket strict policy here breaks those pages at build.

**Impact:** CSP present even if JS fails to run; survives hard refreshes / blocked JS.
**Why:** defense-in-depth for static hosting. Optional — Applier A alone already works for the app shell.

### 7.4 Delete hardcoded `<meta>` from the 4 HTML files

Remove the hand-pasted `<meta http-equiv="Content-Security-Policy" …>` from:

- `demo/index.html`
- `demo/archetypes-demo.html`
- `demo/newsletter-dashboard.html`
- `showcase/token-showcase.html`

**Ordering matters:** do this only **after** 7.1 + (7.2 *or* 7.3) land, so every entry still receives its policy from the source. If 7.3 is adopted, the plugin re-adds the canonical per-entry meta at build; if only 7.2 is adopted, runtime MetaManager injects it on load. Either way the looser `archetypes-demo` / `newsletter-dashboard` policies are preserved because they now live in `entries`.

**Impact:** removes the drift + divergence source.
**Why:** end the four-way duplication without flattening legitimate exceptions.

### 7.5 `tooling/scripts/check-security.js` — validate the config, not one HTML copy

`checkCsp()` currently reads `demo/index.html` source — that breaks once 7.4 removes the meta, and it never covered the other three entries anyway. Switch to testing the source of truth directly, across **all** entries:

```js
import { resolveSecurityPolicy, resolveCspMeta } from '../src/runtime/SecurityPolicy.js';

function checkCsp() {
    const { csp = {} } = resolveSecurityPolicy();
    const core = csp.core || '';
    const entries = csp.entries || {};
    const header = csp.header || '';

    const required = ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "connect-src 'self'"];
    const missing = required.filter((d) => !core.includes(d));

    // No entry may allow 'unsafe-inline'/'unsafe-eval' in script-src.
    const badScripts = Object.entries(entries)
        .filter(([, delta]) => /script-src[^;]*('unsafe-inline'|'unsafe-eval')/.test(delta))
        .map(([id]) => id);

    // Header-only directives must stay complete for the eventual proxy.
    const headerOk = /frame-ancestors\s+'none'/.test(header);

    // Every entry must resolve to a non-empty meta.
    const empty = Object.keys(entries).filter((id) => !resolveCspMeta(id).meta);

    const pass = Boolean(core) && missing.length === 0 && badScripts.length === 0 && headerOk && empty.length === 0;

    return {
        name: 'strict CSP policy (source, all entries)',
        pass,
        message: pass
            ? `CSP core + ${Object.keys(entries).length} entries defined; frame-ancestors in header`
            : [
                missing.length && `core missing ${missing.join(', ')}`,
                badScripts.length && `unsafe script-src in ${badScripts.join(', ')}`,
                !headerOk && 'header missing frame-ancestors',
                empty.length && `empty meta for ${empty.join(', ')}`
              ].filter(Boolean).join('; ') || 'CSP misconfigured'
    };
}
```

Notes:
- `style-src 'unsafe-inline'` in `newsletter-dashboard`/`archetypes-demo` is **allowed** by design (documented exceptions); the check only forbids unsafe `script-src`. If you want to harden later, refactor those pages to drop inline styles and remove the exceptions — but do not silently forbid them in CI, or CI goes red on intentional config.
- Optionally also assert every entry HTML path has a matching `entries` key, so an added HTML page is never orphaned without a policy.

**Impact:** CI now guards the policy definition itself (fast, no build needed) across all entries instead of one pasted string.
**Why:** test the source of truth, not a copy — and cover the three entries CI previously ignored.

---

## 8. Later — SSR (only if an SSR layer is ever added)

Today there is **no SSR** in CSMA or SSMA (verified). If one is added, the runtime MetaManager already has the seam: instantiate with `document: null`, call `push({meta:[…]})`, then `render()` returns `snapshot()` — a serializable `{ title, tags[], htmlAttrs, bodyAttrs }`.

The only net-new code is a **serializer** turning `snapshot.tags` into an HTML string:

- `snapshotToHeadHtml(snapshot)` — ~15 lines, lives in/near runtime `MetaManager.js` (or an SSR adapter).
- The tag-building / dedup / `http-equiv` logic is reused unchanged.

**Caveat:** if a real server exists (SSR), prefer CSP as an **HTTP header** (full directives, report-only, nonces). MetaManager injecting CSP meta in SSR is a fallback; its primary SSR job stays SEO tags.

---

## 9. Out of scope (with rationale)

| Item | Why out of scope |
|---|---|
| **SSMA** | Rust JSON gateway; serves no HTML, does no SSR. No CSP role. |
| **`meta-manager` module** | SEO/schema/OG/hreflang. CSP is not SEO. Unchanged. |
| **Reverse-proxy header config** | Real enforcement of `frame-ancestors`/HSTS belongs in nginx/Caddy/cloud in front of the deployment. Separate deploy-config task; not code. Tracked below as the one open gap. |
| **Removing the inline-style / CDN exceptions** | Legitimate current needs. Hardening (local Chart.js bundle, no inline styles) is a separate refactor, not part of the CSP consolidation. |

---

## 10. The one open gap — `frame-ancestors`

`frame-ancestors 'none'` in `<meta>` is **ignored by browsers** (CSP spec). So clickjacking protection is currently **not enforced**, despite appearances in all four entry HTMLs.

Closing it requires an HTTP response header, set by the **reverse proxy** (the layer SSMA docs already require). Example (nginx):

```nginx
add_header Content-Security-Policy "default-src 'self'; ...; frame-ancestors 'none'" always;
add_header X-Frame-Options "DENY" always;
```

This is a **deployment-config** task, separate from the code changes above. The code changes (7.1) move `frame-ancestors` (+ `frame-src`) into `csp.header` and document it as header-only so no one relies on the meta copy.

---

## 11. Decisions to confirm before implementing

1. **Applier choice:** A only (runtime MetaManager), B only (Vite transform), or both? Recommendation: **both** — A for runtime/route flexibility, B for static-HTML robustness. Both read `resolveCspMeta(entryId)` from the same source; the `http-equiv` dedup makes them idempotent if both run.
2. **Entry-id scheme:** confirm `entries` keys are the HTML path without extension relative to repo root (`demo/index`, `showcase/token-showcase`, …). Pick whatever the Vite plugin can derive trivially and the router can match — just keep applier A and B using the **same** derivation.
3. **Dev-mode strictness:** the strict policy (`script-src 'self'; style-src 'self'`) already runs for the app shell in CSMA dev without breaking. `archetypes-demo`/`newsletter-dashboard` are intentionally looser (Chart.js CDN, inline styles) and must stay so in dev. Watch for any *new* dev-only inline-style violations from third-party libs; if hit, add a per-entry `dev` delta rather than globally loosening `default`.
4. **Back-compat:** keep `csp.template` (strict default combined) so any reader keeps working. It must no longer be treated as the authority — `core` + `entries` are.

---

## 12. Forward-looking — integration of `floating-chat-bar-ui`

CSMA's CI (`check-security.js` → `checkDomSinks`) **bans `innerHTML`/`outerHTML`/`insertAdjacentHTML`** in `src/` except an allowlist (`src/utils/sanitize.js`, `src/ui/components/toast/toast.js`).

`floating-chat-bar-ui` (the demo meant to replace CSMA's chat UI) currently has **~62 `innerHTML` uses**. They are safe at runtime (data is `escapeHtml`'d), but the linter is a static string-match — it does not know that.

**When the chat UI is ported into CSMA, `checkDomSinks` will fail** unless each site either:
- routes through `src/utils/sanitize.js`,
- is refactored to `createElement` / `textContent`, or
- is added to the allowlist.

Plan this migration before integration; it is unrelated to CSP but will block the same CI gate.

---

## 13. Summary matrix

| Concern | Owner (source) | Applier | Files changed (now) |
|---|---|---|---|
| CSP policy text (core + per-entry + header) | `SecurityPolicy.csp` (`core`, `entries`, `header`) | — | `src/runtime/SecurityPolicy.js` (+ `resolveCspMeta` export) |
| Client `<meta>` injection (per entry) | `resolveCspMeta(entryId)` | `metaManager.push({meta:[…]})` | `src/runtime/bootstrap.js` |
| Static `<meta>` injection (optional) | `resolveCspMeta(entryId)` by HTML path | Vite `transformIndexHtml` plugin | `tooling/scripts/csp-html-plugin.js`, `vite.config.js` |
| Remove duplication | — | delete (after 7.1 + 7.2/7.3) | 4 HTML files in `demo/` + `showcase/` |
| CI validation (all entries) | `SecurityPolicy.csp` | config check | `tooling/scripts/check-security.js` |
| `frame-ancestors` (real gap) | `csp.header` | reverse proxy | (deploy config, not code) |
| SSR (later, if ever) | `SecurityPolicy.csp` | runtime MetaManager `snapshot()` + serializer | `src/runtime/MetaManager.js` (+ adapter) |
