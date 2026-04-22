---
name: csma-design
description: CSMA design conventions. For the canonical design document, see DESIGN.md at repo root.
---

<!-- version: 2.0.0 | tags: design, tokens, css, layout, components -->

# CSMA Design Skill

**DEPRECATED — See [DESIGN.md](../../DESIGN.md) at repo root for the canonical design document.**

This file documents workflow conventions that complement DESIGN.md.

## Token System

All visual values live in `src/style/design-tokens.json` (DTCG format).

```bash
npm run tokens   # regenerates src/generated/tokens.css
```

**Never edit generated CSS directly.** Always change the JSON source and regenerate.

## Design Workflow

1. Read DESIGN.md for visual rules, component definitions, and layout patterns.
2. Chat with the user about desired changes.
3. Update `src/style/design-tokens.json` (DTCG format).
4. Run `npm run tokens` to regenerate `src/generated/tokens.css`.
5. Compose layouts and pages using generated tokens. Never edit CSS output directly.

## Product Structure (UX Planning)

Before composing a new screen, clarify:

- **Domain** — what problem does this solve?
- **Primary user roles** — who uses this?
- **Top-level screens** — what are the main views?
- **Navigation groups** — how do users move between views?
- **Top flows** — what are the critical user journeys?
- **State expectations** — what do empty, loading, error, and success states look like?

Write these findings into DESIGN.md (or chat them with your agent) before building.
