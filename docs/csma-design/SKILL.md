---
name: csma-design
description: Routing skill for CSMA UI work. Directs AI to the right contract file for visual rules, structure rules, and UX definition before implementation.
---

<!-- version: 2.0.0 | tags: design, ui, tokens, primitives, archetypes, ux -->

# CSMA Design Skill

Use this skill when:

- restyling CSMA UI
- defining or revising product UX and sitemap
- creating or extending primitives
- creating or extending layout/content archetypes
- compiling AI-driven UI safely through CSMA seams

## Read Order

### Product or Page Design

1. `docs/csma-design/UX.md`
2. `docs/csma-design/DESIGN.md`
3. `docs/csma-design/STRUCTURE.md`

### Token or Visual Restyling

1. `docs/csma-design/DESIGN.md`
2. `design-tokens.json`

### Primitive or Archetype Authoring

1. `docs/csma-design/STRUCTURE.md`
2. `docs/csma-design/DESIGN.md`
3. relevant manifests or archetype files

## Task Routing

| Task | Read First | Edit | Run | Validate |
|------|------------|------|-----|----------|
| token restyling | `docs/csma-design/DESIGN.md` | `design-tokens.json` | `npm run generate-tokens` | visual preview + token consumers |
| new primitive | `docs/csma-design/STRUCTURE.md` | `src/ui/components/*`, component manifest, `src/ui/components/index.css`, `src/ui/init.js` for Type II, and `src/runtime/Contracts.js` when events are involved | scaffold or author component files | `npm run lint:styles` + targeted tests |
| new archetype | `docs/csma-design/UX.md`, then `docs/csma-design/STRUCTURE.md` | `src/ui/archetypes/*` | preview-data generation if needed | preview + compiler tests |
| sitemap or flow definition | `docs/csma-design/UX.md` | `docs/csma-design/UX.md` | no generator required by default | human review before archetype work |

Generated artifacts should not be hand-edited when an upstream source exists.

## Workflow

1. Confirm the task type:
   - UX definition
   - visual restyle
   - primitive authoring
   - archetype authoring
   - compiler/runtime integration
2. Read the minimum required contract files.
3. Reuse existing tokens, primitives, and archetypes before creating new ones.
4. Update the source-of-truth document first, then implementation files.
5. Run validation and preview.
6. If the requested result exceeds the current system grammar, use the manual escape hatch explicitly.

## Decision Rules

- If the question is "what should users do?" read `UX.md`.
- If the question is "how should it look?" read `DESIGN.md`.
- If the question is "how should it be built consistently?" read `STRUCTURE.md`.

Path assumptions:

- visual contract: `docs/csma-design/DESIGN.md`
- structure contract: `docs/csma-design/STRUCTURE.md`
- UX contract: `docs/csma-design/UX.md`
- primitives: `src/ui/components/`
- archetypes: `src/ui/archetypes/`

## Escape Hatch Rule

Stop deterministic generation and hand-author the UI when:

- behavior is novel
- the art direction is intentionally system-breaking
- the composition is unlikely to repeat
- the constraints are not expressible by current primitives or archetypes

When that happens, say so directly and name the boundary.

## Validation Loop

```text
read contract
-> author/change source of truth
-> run validation
-> preview
-> review
-> refine
```

## Non-Negotiables

- no hardcoded visual values
- no user-data `innerHTML`
- no bypassing manifest or contracts
- no hidden lifecycle work without cleanup
- no unfinished component without demo and registration

If AI is about to solve a product-structure question from `DESIGN.md`, or a visual-style question from `STRUCTURE.md`, it is reading the wrong file.
