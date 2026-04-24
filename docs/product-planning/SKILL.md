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
| `SITE.md` | Website information architecture: nav, pages, footer, SEO, legal, consent, global shell. | Multi-page marketing/content sites. |
| `APP.md` | App structure: screens, navigation model, auth state, roles, modules, shell layout. | Web apps and dashboards. |
| `pages/<page>.md` | Page goal, sections, copy direction, layout, CTAs, assets, responsive behavior. | Any important page. |
| `flows/<flow>.md` | Multi-step behavior, validation, async states, errors, EventBus/Contracts plan. | Checkout, onboarding, contact, auth, upload, payment, consent. |
| `animations/<animation>.md` | Runtime motion plan: splash, route transition, app-shell transition, reusable reveal, or state sequence. | Reusable, cross-page, or sequenced animation beyond a page-level motion note. |
| `VIDEO.md` | Production-media brief: format, duration, audience, source pages, message, CTA. | Promo, launch, explainer, product-demo, or social video. |
| `storyboards/<video>.md` | Beat-by-beat video direction: timing, assets, camera, transitions, captions, validation shots. | Any video needing more than a static export. |

Tiny one-page sites may use only `DESIGN.md` plus `pages/landing.md`. Larger
sites should not put every page and section into `DESIGN.md`.

## Workflow

1. Identify product type: one-page site, multi-page site, app, or hybrid.
2. Decide required artifacts from the matrix below.
3. Fill or import `DESIGN.md`.
4. Create `SITE.md` or `APP.md` when needed.
5. Create page specs under `pages/`.
6. Create flow specs under `flows/`.
7. Decide motion level: `none`, `micro`, `section`, `runtime sequence`,
   `scroll`, or `video`.
8. Create animation specs under `animations/` only when motion is reusable,
   cross-page, or sequence-based.
9. Define what becomes Type I vs Type II.
10. Only then move to token edits and implementation.

## Decision Matrix

| User request | Planning artifacts |
|:--|:--|
| Build a landing page | `DESIGN.md`, `pages/landing.md` |
| Build a company website | `DESIGN.md`, `SITE.md`, `pages/home.md`, plus required page specs |
| Build a SaaS app | `DESIGN.md`, `APP.md`, screen specs, flow specs |
| Use this uploaded `DESIGN.md` | `docs/design-import/SKILL.md`, then product planning artifacts |
| Add checkout/payment | `flows/checkout.md`, Contracts/EventBus plan, payment integration notes |
| Add contact form | `pages/contact.md`, `flows/contact-submit.md`, validation/submission contract |
| Add cookie consent | `SITE.md` consent section, `flows/consent.md`, Consent module configuration notes |
| Add legal pages | `SITE.md` legal map, `pages/privacy.md`, `pages/terms.md`, `pages/cookies.md` |
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
| `flows/<flow>.md` | `docs/product-planning/templates/flow.md` |
| `animations/<animation>.md` | `docs/product-planning/templates/animation.md` |
| `VIDEO.md` | `docs/product-planning/templates/VIDEO.md` |
| `storyboards/<video>.md` | `docs/product-planning/templates/storyboard.md` |

Copy the relevant template and fill only the sections needed for the user's
request.

## Implementation Handoff

Before writing code, summarize:

1. Product type.
2. Artifacts created or updated.
3. Pages/routes/screens in scope.
4. Critical flows and Type II behavior.
5. Motion/video decision, including any `animations/<animation>.md` artifact.
6. Token branches likely to change.
7. Verification plan.

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
- Prefer `frontend/` for the user's final website/app entry when the todo demo
  stays as reference.
- Preserve unrelated user worktree changes.
