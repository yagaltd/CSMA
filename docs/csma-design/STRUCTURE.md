# CSMA Structure Contract

Design-system and composition grammar for CSMA UI.

This file defines how UI is built consistently inside CSMA using primitives, manifests, and archetypes.

## Purpose

`STRUCTURE.md` answers:

- what primitives exist
- what states and slots they must support
- how primitives compose
- when to add a new primitive
- when to add a new archetype
- how layout and content archetypes should be shaped

It does not answer:

- brand mood or visual atmosphere
- sitemap and user journey decisions
- token values

## Source Of Truth For

- primitive roles
- primitive composition rules
- state requirements
- accessibility expectations for component families
- layout archetype rules
- content archetype rules
- do/don't rules for generation

## Primitive Philosophy

Primitives should be:

- narrow
- reusable
- role-based
- stable
- not brand-specific

Examples:

- `button`
- `input`
- `field`
- `card`
- `badge`
- `theme-toggle`
- `toast`

Non-example:

- `fancy-pricing-card-with-gradient-and-stats`

That is archetype or page content, not a primitive.

Current primitives in this repo should be treated as the canonical implemented set unless a planned primitive is explicitly marked elsewhere.

## Type I Vs Type II

Use Type I when:

- UI is presentational
- states can be expressed in CSS only
- no EventBus lifecycle is required

Use Type II when:

- component needs EventBus subscriptions
- keyboard interaction or orchestration logic is required
- timers, observers, or cleanup are required

## Primitive Rules

Each primitive should define:

- purpose
- allowed props
- slots
- required states
- accessibility notes
- Type I or Type II boundary

Every interactive primitive should define at minimum:

- default
- hover
- focus-visible
- active
- disabled
- error if applicable
- success if applicable
- loading if applicable

## Required Files

Type I:

```text
src/ui/components/<name>/
├── <name>.css
├── <name>.demo.html
└── manifest.json
```

Type II:

```text
src/ui/components/<name>/
├── <name>.css
├── <name>.js
├── <name>.demo.html
└── manifest.json
```

## Required Behavior

Every new primitive must:

- use semantic/scale/recipe tokens only
- define all interactive states in CSS
- include `:focus-visible` if interactive
- include disabled styling if interactive
- avoid `innerHTML` for user content
- use `data-*` for complex state when needed
- return cleanup functions for any Type II initialization
- document AI-facing behavior in `manifest.json`

## Required Registration

- Add CSS import to `src/ui/components/index.css`
- For Type II, add init import and cleanup registration to `src/ui/init.js`
- If the component publishes or consumes EventBus payloads, add contracts in `src/runtime/Contracts.js`

## Manifest Rules

`manifest.json` is required for all components.

It is the source of truth for:

- component metadata
- lifecycle type
- AI-facing alias, title, summary, and prop surface
- rendering hints
- behavior hints
- slot model

AI must not invent undocumented component props in composition unless the manifest is updated too.

## Archetype Rules

### Layout Archetype

Owns:

- regions
- grouping
- width and alignment intent
- density hints

Must not own:

- low-level token values
- arbitrary component internals
- business logic

### Content Archetype

Owns:

- content structure inside a layout region
- allowed primitive composition
- overrideable content fields

Must not own:

- arbitrary HTML
- unsupported props
- hidden runtime logic

## New Primitive Vs New Archetype

Create a new primitive when:

- a UI part repeats across multiple screens
- it needs stable props, states, or accessibility behavior
- it should become part of the reusable base

Create a new archetype when:

- structure repeats, but underlying primitives already exist
- the need is compositional rather than foundational

Use manual authoring when:

- behavior is highly custom
- composition intentionally breaks the system
- the design is exceptional and unlikely to repeat

## Decision Table

| Need | Default Decision | Escalate When |
|------|------------------|---------------|
| `contact-form` built from `field`, `input`, `button`, `card` | content archetype | new primitive only if a reusable missing unit appears |
| `pricing-card` with stable repeated anatomy across pages | primitive or primitive family | archetype if it is mostly composition of existing parts |
| one-off animated launch hero | manual authoring | only systematize later if it repeats |
| new grouped input pattern used across many forms | primitive | manual only for unusual behavior |

For forms:

- validation messaging should prefer stable primitives or stable field patterns
- helper text and validation text should normally remain part of the `field` pattern; `textarea` should be treated like another stable form control primitive when present, not hand-authored ad hoc inside a content archetype
- submit/loading/error orchestration can live in runtime glue or Type II boundaries
- layout repetition should become archetype material
- move to manual authoring when the form requires multi-step branching, unconventional interaction patterns, or orchestration that no longer fits stable reusable field behavior

## Page Composition Rules

When composing with existing components:

- use manifests as source of truth
- use view/module contributions, not raw DOM selectors scattered across files
- compose from layout primitives + component building blocks
- do not write new CSS when existing components and tokens already solve the problem

When existing components are insufficient:

- create a new primitive instead of mutating unrelated components into a new role
- prefer Type I first
- move to Type II only if lifecycle, keyboard interaction, timers, observers, or EventBus behavior are required

## Authoring Workflow

Before creating a new primitive:

1. Check if an existing component already covers the job.
2. Decide Type I or Type II.
3. List required states, props, accessibility semantics, and tokens.
4. Scaffold with `npm run create-component -- --name <kebab-name> --type <I|II> --description "<summary>"`.
5. Fill CSS/JS/demo/manifest.
6. Register CSS and Type II init hook.
7. Add contracts if events are involved.
8. Run validation and tests.

## Quality Bar

A CSMA primitive or archetype-backed component is complete only when:

- structure matches the expected file layout
- manifest validates
- CSS import exists
- Type II init is registered
- states are defined
- tokens are used consistently
- demo exists
- tests or validation checks cover the new contract where appropriate

If any of those are missing, the work is still draft.
