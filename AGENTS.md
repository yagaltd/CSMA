# AGENTS.md - CSMA Template Guide

CSMA is a design-token-first vanilla JS template.

Treat this repo as the source of truth for runtime, modules, primitives, and
canonical design tokens. Agents update tokens and compose UI freely, but respect
the architectural boundaries below.

## Key Directories

| Path | Purpose |
|------|---------|
| `src/runtime/` | Runtime helpers and reusable services |
| `src/modules/` | Reusable feature modules |
| `src/ui/components/` | Primitive UI building blocks — copy and extend |
| `src/style/` | Canonical token input and base styles |
| `demo/` | Reference demos and committed snapshots |
| `showcase/` | Standalone token and design inspection pages |
| `tooling/` | Token generator and JSON schemas |
| `docs/` | Agent skills — design, architecture, security, testing, patterns |

## Design Workflow

1. Read `docs/design/SKILL.md`.
2. Read the brief, declare a one-line Design Read.
3. Set register (brand | product), Three Dials, and color strategy.
4. Update `DESIGN.md` front matter with the 5-field schema.
5. Update `src/style/token-overrides.json` with dot-notation token patches.
6. Run `npm run tokens:patch` to merge and regenerate `src/generated/tokens.css`.
7. Inspect `/showcase/token-showcase.html` across light, dark, and contrast themes.
8. Compose layouts and pages using generated tokens. Never edit CSS output directly.
9. Run `npm run check:design` and `npm run check:responsive` before shipping.

## Tokens

- **Base seed**: `src/style/design-tokens.json`
- **Project overrides**: `src/style/token-overrides.json`
- **Generated CSS**: `src/generated/tokens.css`
- **Generated reference**: `tooling/generated/token-reference.json`

Never edit generated artifacts directly. For app-specific token work, do not
edit `src/style/design-tokens.json` directly; patch via
`src/style/token-overrides.json`.

## Component Placement

CSMA has three UI folders. Pick the right one:

| Folder | Purpose | Litmus test |
|--------|---------|-------------|
| `src/ui/components/` | Cross-app primitives (button, card, badge, count-up, tilt-card). Each folder has `manifest.json` for aiui catalog. | "Would another module reuse this?" → yes = here |
| `src/modules/<module>/ui/` | Domain UI scoped to one module. Use when the component is unique to that module, or when a module needs to **modify** an existing primitive. | "Would another module reuse this?" → no = here |
| `src/modules/<module>/aiui/` | Embeddable module surfaces. Used ONLY when a module wants to be mounted INSIDE other surfaces (e.g. comments-thread inside a slide). Requires `manifest.json` + `mountSurface()` on the service. | "Should this module be embeddable inside slides/dashboards/mindmaps?" → yes = here |

**Vendoring rule**: If a module needs to change a shared component's behavior, copy it into `src/modules/<module>/ui/`, modify it, and document the delta in the module's README. Never modify `src/ui/components/` for one module's needs.

**Component placement errors to avoid**:
- Putting a generic component (count-up, tilt-card) inside `modules/<module>/ui/` → belongs in `src/ui/components/`
- Putting a module surface manifest in `ui/` instead of `aiui/` → `aiui/` is for `mountSurface`, `ui/` is for scoped Type I/II components
- Adding `aiui/` to a module that is an app shell (slides, dashboards) → app shells consume surfaces, they don't offer them

## Architecture Rules

- JavaScript manages state via events; CSS handles rendering.
- Use `data-*` attributes and CSS classes for visual state. No inline styles.
- Validate all EventBus payloads with Contracts.
- Use `textContent`, never `innerHTML`, for user data.
- Prefer existing primitives before inventing new ones.

## When To Read Which Skill

| Task | Skill |
|------|-------|
| Design tokens, visual rules, layout, register system, Three Dials, anti-patterns | `docs/design/SKILL.md` |
| Import or translate an external DESIGN.md | `docs/design-import/SKILL.md` |
| Website, app, page, route, flow, or motion planning | `docs/product-planning/SKILL.md` |
| Runtime animation implementation | `docs/animation/SKILL.md` |
| Existing video asset integration | `docs/video/SKILL.md` |
| Component placement, `ui/` vs `aiui/`, `mountSurface`, vendoring, layer cake | `docs/architecture/SKILL.md` (Component Placement section) |
| EventBus, Contracts, runtime patterns | `docs/architecture/SKILL.md` |
| Security, CSP, sanitization | `docs/security/SKILL.md` |
| Testing strategy | `docs/testing/SKILL.md` |
| Layout recipes, spatial patterns | `docs/patterns/SKILL.md` |
| Modern CSS features, browser compat, JS→CSS migration | `docs/css/SKILL.md` |
| Rigor selection (tests, transitions) | `docs/rigor/SKILL.md` |
| Presentation / slide deck authoring (deck.json) | `docs/slides/SKILL.md` |
| Prose typography for markdown / LLM output / rich text | `docs/typeset/SKILL.md` |

## Layouts and Pages

There is no rigid page scaffold. Agents compose pages freely using:

- Layout tokens (breakpoints, container widths, grid columns)
- documented layout and component guidance from `docs/design/SKILL.md`
- Reference examples in `demo/examples/`

Consult `docs/patterns/SKILL.md` for common spatial recipes.

Use `showcase/token-showcase.html` after token edits to inspect the generated
token seed before building app-specific pages.

For new websites, apps, landing pages, navigation, or critical flows, read
`docs/product-planning/SKILL.md` before deciding whether to create `SITE.md`,
`APP.md`, `pages/*.md`, `flows/*.md`, or `animations/*.md`.

For implementation after planning, read `docs/animation/SKILL.md` for runtime
motion. Use `docs/video/SKILL.md` only when integrating an existing video asset
or when the user explicitly wants video work handled inside this repo.

When choosing between CSS-native behavior and JS-driven visual behavior, read
`docs/css/SKILL.md` before inventing new JS styling logic.

For multi-page sites, app shells, or hybrid products, decide shared shell and
file structure before implementing the first page or screen.

Pick one delivery mode per surface before implementation:

- `static-mpa`: public routes are real `frontend/**/*.html` files
- `spa`: route rendering goes through the optional `router` module
- `hybrid`: static public site plus router-managed app surface

Do not mix public HTML routes with injected `frontend/pages/*.js` HTML modules.
For public multi-page work, run `npm run verify:frontend-routes`.

## Source Inspection Guardrail

Do not read raw token files, foundation CSS, or component CSS by default for
routine page work. Prefer skill docs under `docs/`, generated references, and
root planning artifacts first. Escalate to raw source only when blocked,
extending a primitive, or debugging a documented/runtime mismatch.

## Scope Guardrail

Do not invent full page inventory, messaging hierarchy, or conversion strategy
from minimal input by default. If the planning inputs are missing, ask for them
or create a lightweight planning brief before implementation.
