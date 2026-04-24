---
name: csma-product-planning
description: Orchestrate CSMA product planning before implementation. Use when the user asks to build a website, landing page, app, page, route, navigation system, or critical flow such as checkout, contact, onboarding, auth, legal, consent, animation, or video.
---

<!-- version: 1.0.0 | tags: planning, website, app, pages, flows, IA, navigation -->

# CSMA Product Planning Skill

## Purpose

Use this skill before building a website, landing page, app, or critical user
flow in CSMA.

The goal is to choose the smallest useful planning artifacts before token edits
and implementation begin. Do not put the whole product into `DESIGN.md`.

`DESIGN.md` owns the reusable visual system. Product planning owns page, route,
navigation, content, flow, and production-media structure.

## Required Reading

Read these in order:

1. Root `DESIGN.md`.
2. `docs/design/SKILL.md`.
3. `docs/patterns/SKILL.md`.
4. `docs/architecture/SKILL.md` if a flow changes application state.
5. `docs/design-import/SKILL.md` if the user provides an external `DESIGN.md`.

## Artifact Model

| Artifact | Purpose | When needed |
|:--|:--|:--|
| `DESIGN.md` | Reusable visual system: tokens, brand feel, components, layout patterns, anti-patterns, Type I/II rules. | Always for visual work. |
| `project-manifest.json` | Machine-readable generator input for legal drafts and public discovery files. | Always when product planning affects distribution, legal, SEO, or public routes. |
| `SITE.md` | Website information architecture: nav, pages, footer, SEO, legal, consent, global shell. | Multi-page marketing/content sites. |
| `APP.md` | App structure: screens, navigation model, auth state, roles, modules, shell layout. | Web apps and dashboards. |
| `pages/<page>.md` | Page goal, sections, copy direction, layout, CTAs, assets, responsive behavior. | Any important page. |
| `pages/404.md` | Recovery content and escape paths for not-found routes. | Public multi-page sites and hybrid public surfaces. |
| `flows/<flow>.md` | Multi-step behavior, validation, async states, errors, EventBus/Contracts plan. | Checkout, onboarding, contact, auth, upload, payment, consent. |
| `animations/<animation>.md` | Runtime motion plan: splash, route transition, app-shell transition, reusable reveal, or state sequence. | Reusable, cross-page, or sequenced animation beyond a page-level motion note. |
| `VIDEO.md` | Production-media brief: format, duration, audience, source pages, message, CTA. | Promo, launch, explainer, product-demo, or social video. |
| `storyboards/<video>.md` | Beat-by-beat video direction: timing, assets, camera, transitions, captions, validation shots. | Any video needing more than a static export. |

Tiny one-page sites may use only `DESIGN.md` plus `pages/landing.md`. Larger
sites should not put every page and section into `DESIGN.md`.

## Workflow

1. Identify product type: `site`, `web-app`, `hybrid`, or `mobile-app`.
2. Decide surface scope before implementation: `single-page`, `multi-page site`,
   `app shell + screens`, or `hybrid`.
3. Decide delivery mode per surface: `static-mpa`, `spa`, or `hybrid`.
4. Lock public presence early: `web.enabled`, `web.indexable`, `web.baseUrl`, and public routes.
5. Create or update `project-manifest.json` with organization metadata, public routes, and canonical CSMA module ids.
6. Ensure the selected delivery mode matches the planned surface:
   `static-mpa` for public multi-page sites by default; optional `router` module only for `spa` and `hybrid`.
7. Decide required artifacts from the matrix below.
8. Fill or import `DESIGN.md`.
9. Create `SITE.md` or `APP.md` when needed.
10. For multi-page or hybrid work, define shared architecture before page-one implementation:
   shared shell, shared CSS/JS split, route inventory, page-specific vs shared assets, and build order.
11. Create page specs under `pages/`.
12. Create `pages/404.md` for public multi-page sites.
13. Create flow specs under `flows/`.
14. Decide motion level: `none`, `micro`, `section`, `runtime sequence`,
   `scroll`, or `video`.
15. Create animation specs under `animations/` only when motion is reusable,
   cross-page, or sequence-based.
16. Define what becomes Type I vs Type II.
17. When legal/SEO scaffolding is in scope, run `npm run generate-project-artifacts` after the manifest, `SITE.md`, and `APP.md` decisions are stable.
18. Only then move to token edits and implementation.

## Scope Lock

Before code, explicitly classify the surface:

| Scope | Meaning | Default implementation bias |
|:--|:--|:--|
| `single-page` | Landing page or one public page. | One page may be implemented directly. |
| `multi-page site` | Multiple public routes share one site shell. | Decide shared architecture before the homepage. |
| `app shell + screens` | Logged-in product with reusable shell and screens. | Decide shell, screen inventory, and shared state before first screen code. |
| `hybrid` | Public site plus product/app surface. | Plan both surfaces and their shared/non-shared boundaries before code. |

If the scope is unclear, do not start coding. Ask the user for the route or
screen inventory, or create a lightweight planning brief first.

## Delivery Mode Contract

Pick exactly one implementation mode for each surface before writing code.

| Delivery mode | Use when | Required implementation shape | Forbidden by default |
|:--|:--|:--|:--|
| `static-mpa` | Public marketing/content sites and simple docs surfaces. | Public routes are real `frontend/**/*.html` files that build to matching root URLs. | `frontend/pages/*.js` HTML modules, shell-driven HTML injection, route content duplicated in JS strings. |
| `spa` | Client-routed app with one shell and internal screen transitions. | One shell entry plus the optional `router` module and route handlers/views. | Duplicate full static HTML file for every client route. |
| `hybrid` | Public site plus client-routed app surface. | Static public routes plus router-managed app surface with explicit boundary. | Ad hoc mixing where the same public route exists as both static HTML and injected HTML module. |

Public multi-page sites default to `static-mpa`.

If `spa` or `hybrid` is selected, use the optional `router` module. Do not
invent a local shell bootstrap that exports page HTML strings unless the plan
explicitly documents why that pattern is necessary.

## Runtime Routing

Choose the lightest routing model that matches the surface.

| Mode | Ownership | Recommended CSMA path |
|:--|:--|:--|
| Static MPA | Browser + HTML files | Real `frontend/**/*.html` pages, optional light `ClientNavigationService` only when a same-origin shell needs exact-path interception. |
| SPA | Router-driven client runtime | `router` module + `ClientNavigationService` + render handlers/views. |
| Hybrid | Static public routes + client-routed app | Public routes as HTML, app routes in the `router` module. |

Rules:

- `project-manifest.json.web.routes` is the public route inventory only.
- Planned public routes must match actual built public URLs.
- Do not use `web.routes` as a source of truth for internal/authenticated SPA screens.
- For `static-mpa`, route content belongs in HTML files, not JS `html` exports.

## Shared Architecture Decision

When the scope is `multi-page site`, `app shell + screens`, or `hybrid`, define
these before writing implementation files:

1. Shared shell elements
2. Shared CSS and JS entrypoints
3. Page-specific or screen-specific CSS and JS
4. Launch route or screen inventory
5. Build order
6. Content readiness: provided, missing, or placeholder-safe
7. Delivery mode per surface
8. Public route -> source artifact -> built URL mapping

Do not implement the homepage or first screen as a one-off prototype and
retrofit shared structure later.

## Manifest Contract

`project-manifest.json` is the only machine-readable input for v1 generation.
Do not crawl routes from source code.

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

Rules:

- `schemaVersion`, `productType`, `organization`, `web.enabled`, and `modules` are always required.
- `web.baseUrl`, `web.indexable`, `web.defaultLocale`, and `web.routes` are required when `web.enabled=true`.
- `web.routes` must be the full public route inventory for `sitemap.xml` and `llms.txt`.
- If `web.enabled=true` and `web.indexable=true`, `web.routes` must be non-empty.
- `modules` must use canonical ids from `src/modules/`.
- `web.routes` must match the actual built public URLs for static sites and public hybrid surfaces.

## Generated Artifact Policy

`npm run generate-project-artifacts` creates draft artifacts only when missing:

- Always: `pages/privacy.md`, `pages/terms.md`
- Web-enabled: `pages/cookies.md`, `public/robots.txt`
- Web-enabled and indexable: `public/sitemap.xml`, `public/llms.txt`

V1 rules:

- Existing files are never overwritten.
- Generated legal content is scaffold text, not legal advice.
- `SITE.md` stays the human IA/legal map.
- `APP.md` stays the human app structure doc.
- `project-manifest.json` stays the single machine-readable source.

## Decision Matrix

| User request | Planning artifacts |
|:--|:--|
| Build a landing page | `DESIGN.md`, `pages/landing.md` |
| Build a company website | `project-manifest.json`, `DESIGN.md`, `SITE.md`, `pages/home.md`, plus required page specs |
| Build a SaaS app | `project-manifest.json`, `DESIGN.md`, `APP.md`, screen specs, flow specs |
| Use this uploaded `DESIGN.md` | `docs/design-import/SKILL.md`, then product planning artifacts |
| Add checkout/payment | `project-manifest.json`, `flows/checkout.md`, Contracts/EventBus plan, payment integration notes |
| Add contact form | `project-manifest.json`, `pages/contact.md`, `flows/contact-submit.md`, validation/submission contract |
| Add cookie consent | `project-manifest.json`, `SITE.md` consent section, `flows/consent.md`, Consent module configuration notes |
| Add legal pages | `project-manifest.json`, `SITE.md` legal map, generated `pages/privacy.md`, `pages/terms.md`, `pages/cookies.md` as applicable |
| Add or revise not-found handling | `pages/404.md`, route recovery notes in `SITE.md` or `APP.md`, and the implementation target matching the chosen delivery mode |
| Animate a page | Page motion section; add `animations/<animation>.md` only for reusable or sequenced runtime motion, then use `docs/animation/SKILL.md` for implementation |
| Add splash screen or route transition | `animations/splash.md` or `animations/route-transition.md`, plus related page/app/flow notes, then use `docs/animation/SKILL.md` |
| Make a product video | `VIDEO.md`, `storyboards/product-video.md`, then use `docs/video/SKILL.md` for production |
| Turn a website into a video | `docs/design-import/SKILL.md`, `VIDEO.md`, `storyboards/<video>.md`, then use `docs/video/SKILL.md` |

## Motion And Video

Ask one concise planning question:

> Is motion or video part of the user goal?

| Decision | Use when | Artifact | Implementation bias |
|:--|:--|:--|:--|
| `none` | Static content or utility UI. | None. | No animation beyond browser defaults. |
| `micro` | Button, field, menu, hover, focus, toast, panel feedback. | Page/flow state notes. | CSS transitions with CSMA tokens. |
| `section` | Hero reveal, feature rows, metrics, page entrance. | `pages/<page>.md` motion section. | CSS first; optional GSAP only for sequencing. |
| `runtime sequence` | Splash screen, route transition, onboarding step transition, reusable reveal system. | `animations/<animation>.md`. | CSS first; optional GSAP only when timeline control is justified. |
| `scroll` | Scroll narrative, pinned panels, scrubbed reveal. | `pages/<page>.md` motion section or `animations/<animation>.md` when reusable. | Optional GSAP ScrollTrigger; reduced-motion fallback required. |
| `video` | Promo, launch, product demo, social ad, explainer. | `VIDEO.md` and `storyboards/<video>.md`. | External video workflow; not CSMA runtime. |

Motion rules:

| Rule | Reason |
|:--|:--|
| Build static layout first. | Animation should move to/from a known composition. |
| Keep durable state in CSMA. | Events, Contracts, `data-*`, and classes remain the state model. |
| Use CSS for simple motion. | Avoids dependency weight and inline-style side effects. |
| Escalate to GSAP only for sequencing, scroll, SVG, or runtime control. | Keeps advanced animation optional and justified. |
| Respect `prefers-reduced-motion`. | Page-level motion needs an accessible alternative. |
| Keep video outside runtime. | Video tooling has different dependencies and output. |

## Type I / Type II

| Behavior | CSMA type | Rule |
|:--|:--|:--|
| Static layout, visual variant, hover/focus, disabled | Type I | CSS classes, ARIA, and `data-*` only. |
| Toggle with persisted or shared state | Type II | Publish `INTENT_*`; validate payload with Contracts. |
| Async submit/load/delete/payment | Type II | Define loading, success, error, retry, cancellation. |
| User-provided content | Type I or II | Render with `textContent`, never `innerHTML`. |
| Theme switching | Type II | Use `data-theme`; persist outside CSS. |

## Template Sources

Use these templates when creating artifacts:

| Artifact | Template |
|:--|:--|
| `SITE.md` | `docs/product-planning/templates/SITE.md` |
| `APP.md` | `docs/product-planning/templates/APP.md` |
| `pages/<page>.md` | `docs/product-planning/templates/page.md` |
| `pages/404.md` | `docs/product-planning/templates/404.md` |
| `pages/privacy.md` | `docs/product-planning/templates/privacy.md` |
| `pages/terms.md` | `docs/product-planning/templates/terms.md` |
| `pages/cookies.md` | `docs/product-planning/templates/cookies.md` |
| `flows/<flow>.md` | `docs/product-planning/templates/flow.md` |
| `animations/<animation>.md` | `docs/product-planning/templates/animation.md` |
| `VIDEO.md` | `docs/product-planning/templates/VIDEO.md` |
| `storyboards/<video>.md` | `docs/product-planning/templates/storyboard.md` |

Copy the relevant template and fill only the sections needed for the user's
request.

## Implementation Handoff

Before writing code, summarize:

1. Product type.
2. Surface scope: `single-page`, `multi-page site`, `app shell + screens`, or `hybrid`.
3. `project-manifest.json` decisions: web enabled, indexable, base URL, public routes, modules.
4. Artifacts created or updated.
5. Shared architecture decisions: shell, shared CSS/JS, page or screen split, build order.
6. Delivery mode decisions and route ownership.
7. Content readiness: provided, missing, placeholder-safe.
8. Critical flows and Type II behavior.
9. Motion/video decision, including any `animations/<animation>.md` artifact.
10. Token branches likely to change.
11. Verification plan, including `npm run verify:frontend-routes` for public multi-page work.

Then continue with token edits and implementation unless the user asked only for
planning.

For runtime motion implementation, continue with `docs/animation/SKILL.md`. For
video production or website-to-video work, continue with `docs/video/SKILL.md`.

## Guardrails

- Do not create `structure-tokens.json`.
- Do not put token values in page front matter.
- Do not put every page section into `DESIGN.md`.
- Do not create a wireframe system by default. Use `showcase/layouts.html` later
  only when the user needs layout/block approval.
- Do not create `animations/<animation>.md` for every hover or page reveal. Use
  it when motion has a reusable sequence, cross-page ownership, or Type II state.
- Do not put final website/app pages into `src/`; keep `src/` for reusable CSMA
  runtime, modules, components, and style.
- Prefer `frontend/` for the user's final website/app entry when the demo app
  stays as reference.
- Do not invent full page inventory, messaging hierarchy, or conversion strategy
  from minimal input by default. Ask for missing planning inputs or create a
  lightweight planning brief first.
- Do not start multi-page implementation until shared architecture is decided.
- Do not mix delivery models for the same public surface.
- Do not allow implementation to outrun planning silently; if many public pages
  are in scope, create matching page briefs or an explicit grouped-brief plan.
- Preserve unrelated user worktree changes.
