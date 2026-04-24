# CSMA Agent Map

This file is the default high-signal map for agents working in CSMA design
tasks. Read this before inspecting raw files under `src/style/`,
`src/ui/components/`, or `demo/`.

## Purpose

Use this map to understand:

- which files are the intended planning and implementation entrypoints
- where design decisions should be recorded
- which generated artifacts must not be edited
- which preview URL should be used during development
- when raw source inspection is allowed

## Default Read Order

1. `AGENTS.md`
2. `docs/design/SKILL.md`
3. Root planning artifacts already created for the project:
   `DESIGN.md`, `project-manifest.json`, `SITE.md`, `APP.md`, `pages/*.md`,
   `flows/*.md`, `animations/*.md`
4. This file
5. Only then read raw source files if blocked

## Do Not Inspect Raw Source By Default

Do not read these by default for normal design and page work:

- `src/style/design-tokens.json`
- `src/style/foundation/*.css`
- `src/style/base.css`
- `src/style/main.css`
- `src/ui/components/**/*.css`
- `src/ui/components/**/*.js`

Read them only when one of these is true:

- you are extending or fixing a primitive/component
- the reference files do not answer a concrete question
- you are debugging a mismatch between the documented system and runtime output

If you escalate to raw source, state why.

## Canonical Planning Files

| File | Owns |
|------|------|
| `DESIGN.md` | Visual system, token intent, component recipes, anti-patterns |
| `project-manifest.json` | Machine-readable product metadata for public/legal generation |
| `SITE.md` | Website IA, nav, SEO, legal, consent, public route plan |
| `APP.md` | App screens, shell, navigation, modules, roles, state model |
| `pages/*.md` | Page sections, content, CTAs, assets, responsive notes |
| `flows/*.md` | Validation, async states, Events, Contracts, failures |

Before implementation, make sure these questions are answered:

1. Is this `single-page`, `multi-page site`, `app shell + screens`, or `hybrid`?
2. What is in launch scope?
3. What is shared across all pages or screens?
4. What content is provided, missing, or placeholder-safe?

## Canonical Token Workflow

For app-specific token work:

1. Record design intent in `DESIGN.md`
2. Patch `src/style/token-overrides.json`
3. Run `npm run tokens:patch`
4. Run `npm run lint:styles`
5. Inspect `showcase/token-showcase.html` in light, dark, and contrast themes
6. Compose app/page CSS using generated token variables

Never edit these directly for app-specific work:

- `src/style/design-tokens.json`
- `src/generated/tokens.css`
- `tooling/generated/token-reference.json`

## Reference Files To Prefer

| Need | Prefer this file |
|------|------------------|
| Token workflow and interview flow | `docs/design/SKILL.md` |
| Product planning artifacts | `docs/product-planning/SKILL.md` |
| Layout and page recipes | `docs/patterns/SKILL.md` |
| Type I / Type II rules | `docs/architecture/SKILL.md` |
| Token inventory snapshot | `tooling/generated/token-reference.json` |
| Showcase preview | `showcase/token-showcase.html` |

## Entrypoints

| Surface | Path | Purpose |
|---------|------|---------|
| `frontend/` | `frontend/index.html` | Preferred production/work-in-progress app or website entry when present |
| `demo/` | `demo/index.html` | CSMA reference demo and smoke-test surface |
| `showcase/` | `showcase/token-showcase.html` | Token inspection surface |

## Dev Server Defaults

Use these scripts:

- `npm run dev`:
  opens `/frontend/` when `frontend/index.html` exists, otherwise `/demo/`
- `npm run dev:demo`:
  always opens `/demo/`
- `npm run dev:showcase`:
  always opens `/showcase/token-showcase.html`

Do not patch `vite.config.js` just to switch the default preview target unless
you are intentionally changing the repo defaults.

## Implementation Bias

- Keep final website/app pages outside `src/`
- Prefer `frontend/` for the user-facing entry when the demo remains as a
  reference
- Keep `src/` for reusable runtime, modules, primitives, and base styles
- Prefer existing primitives before inventing new ones
- For multi-page sites and hybrid products, decide shared CSS/JS and shell
  structure before implementing the homepage
- Do not build page one as a dead-end prototype that must later be restructured

## Verification Expectations

Minimum verification for design/page work:

1. `npm run tokens:patch` when tokens changed
2. `npm run lint:styles`
3. inspect `showcase/token-showcase.html`
4. run the correct dev entrypoint and inspect the page

For multi-page work, also verify:

5. shared CSS/JS entrypoints are used by the planned surfaces
6. the first implemented page matches the agreed shell structure
7. `npm run verify:frontend-routes` passes when public routes are in scope

Delivery contract:

- `static-mpa`: public pages are real HTML files under `frontend/`
- `spa`: route rendering is owned by the optional `router` module
- `hybrid`: static public routes plus router-managed app surface
- do not mix real public HTML pages with `frontend/pages/*.js` HTML-string modules

For token work, the showcase inspection is required. CSS output alone is not a
substitute.
