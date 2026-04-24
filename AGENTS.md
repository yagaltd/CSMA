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
2. Chat with the user to understand desired changes.
3. Update `src/style/token-overrides.json` with dot-notation token patches.
4. Run `npm run tokens:patch` to merge into `src/style/design-tokens.json` and regenerate `src/generated/tokens.css`.
5. Inspect `/showcase/token-showcase.html` across light, dark, and contrast themes.
6. Compose layouts and pages using generated tokens. Never edit CSS output directly.

## Tokens

- **Base seed**: `src/style/design-tokens.json`
- **Project overrides**: `src/style/token-overrides.json`
- **Generated CSS**: `src/generated/tokens.css`
- **Generated reference**: `tooling/generated/token-reference.json`

Never edit generated artifacts directly. For app-specific token work, do not
edit `src/style/design-tokens.json` directly; patch via
`src/style/token-overrides.json`.

## Architecture Rules

- JavaScript manages state via events; CSS handles rendering.
- Use `data-*` attributes and CSS classes for visual state. No inline styles.
- Validate all EventBus payloads with Contracts.
- Use `textContent`, never `innerHTML`, for user data.
- Prefer existing primitives before inventing new ones.

## When To Read Which Skill

| Task | Skill |
|------|-------|
| Design tokens, visual rules, layout | `docs/design/SKILL.md` |
| Import or translate an external DESIGN.md | `docs/design-import/SKILL.md` |
| Website, app, page, route, flow, motion, or video planning | `docs/product-planning/SKILL.md` |
| Runtime animation implementation | `docs/animation/SKILL.md` |
| Video production or website-to-video workflow | `docs/video/SKILL.md` |
| EventBus, Contracts, component types | `docs/architecture/SKILL.md` |
| Security, CSP, sanitization | `docs/security/SKILL.md` |
| Testing strategy | `docs/testing/SKILL.md` |
| Layout recipes, spatial patterns | `docs/patterns/SKILL.md` |
| Rigor selection (tests, transitions) | `docs/rigor/SKILL.md` |

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
`APP.md`, `pages/*.md`, `flows/*.md`, `animations/*.md`, `VIDEO.md`, or
`storyboards/*.md`.

For implementation after planning, read `docs/animation/SKILL.md` for runtime
motion and `docs/video/SKILL.md` for production-media or website-to-video work.

## Source Inspection Guardrail

Do not read raw token files, foundation CSS, or component CSS by default for
routine page work. Prefer skill docs under `docs/`, generated references, and
root planning artifacts first. Escalate to raw source only when blocked,
extending a primitive, or debugging a documented/runtime mismatch.
