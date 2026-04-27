---
name: csma-design
description: How to create and use DESIGN.md for a CSMA project. Guides the agent through collaborative design discovery with the user.
---

<!-- version: 2.0.0 | tags: design, DESIGN.md, tokens, workflow -->

# CSMA Design Skill

## Purpose

This skill guides collaborative design discovery between you (the agent) and the
user. The output is a filled `DESIGN.md` at the project root plus concrete token
patches in `src/style/token-overrides.json`.

`DESIGN.md` is the app brief and composition guide. The CSMA base visual
seed/reference for runtime tokens is `src/style/design-tokens.json`. App and
brand changes should be written to `src/style/token-overrides.json`, then merged
into the base file and regenerated into `src/generated/tokens.css` with
`npm run tokens:patch`.

Before reading raw source files under `src/style/` or `src/ui/components/`,
read `docs/design/agent-map.md`. For normal design work, use the map, the
generated token reference, and the showcase before escalating to raw source
inspection.

## Starting Point

The repo includes `DESIGN.md` as a **template** with placeholder sections and
decision tables. Your job is to fill it through conversation with the user, then
apply the chosen visual direction through `src/style/token-overrides.json`. Do
not write the entire file at once. Iterate section by section.

## Workflow

### Step 1: Read the Template

Read `docs/design/agent-map.md`, then open `DESIGN.md` at repo root. It has:
- YAML front matter for identity and simple visual direction
- Markdown sections with compact tables and `<!-- Agent: ... -->` comments
- A "CSMA Requirements" section at the bottom (hardcoded, do not change)

### Step 2: Interview the User

Go through sections in order. Ask one section at a time. Do not overwhelm.

#### Section: Overview (Brand & Style)

**Goal:** Understand the emotional direction.

**Questions to ask:**
- What kind of app is this? (SaaS dashboard, e-commerce, social, tool)
- Who is the primary user?
- How should it feel? (Playful, professional, premium, minimal, dense)
- Any brand colors or fonts already decided?
- Any reference apps or designs the user likes?

**Write into DESIGN.md:**
```markdown
## Overview

A professional project management tool for engineering teams. The UI should feel
calm, focused, and efficient — like a well-organized workshop. Dense data
surfaces with clear hierarchy. No decorative chrome.
```

#### Section: Colors

**Goal:** Define the palette and semantic usage.

**Questions to ask:**
- Do you have brand colors?
- Light mode, dark mode, or both?
- Any accent color for CTAs?

**Write into DESIGN.md token usage table:**

| Area | CSMA tokens | App decision | Notes |
|:-----|:------------|:-------------|:------|
| Brand/action | `--primary`, `--primary-foreground`, `--accent` | Blue primary for actions and focus. Amber accent for warnings. | Apply values in `src/style/token-overrides.json`. |
| Backgrounds | `--background`, `--surface`, `--background-muted` | Warm gray backgrounds to reduce eye strain. | Preserve contrast in dark and contrast themes. |

#### Section: Typography

**Goal:** Choose fonts and scale.

**Questions to ask:**
- Preferred font? (Inter, Geist, System default)
- Any brand font requirement?
- Headlines bold or light?

#### Section: Layout & Spacing

**Goal:** Define layout philosophy.

**Questions to ask:**
- Sidebar or top nav?
- Dense or airy?
- Mobile-first or desktop-first?

#### Section: Visual Distinctiveness

**Goal:** Encode app-specific taste constraints before component work starts.

Ask these after the overview and before writing CSS:
- What is the one primary visual moment on a typical screen?
- What are the three hierarchy layers: primary, secondary, tertiary?
- Is the app compact, balanced, or spacious?
- What visual motif should repeat across screens, if any?
- Which visual moves should the app never use?

**Write into DESIGN.md:**

| Decision | Rule |
|:---------|:-----|
| Primary moment | Workflow board with active lane first. |
| Hierarchy layers | Primary: active work; secondary: supporting metrics; tertiary: timestamps and metadata. |
| Signature motif | Thin status strip on high-priority records. |
| Density rule | Compact rows, balanced page sections. |
| Container rule | Use spacing first, borders second, cards only for repeated records. |
| Interaction feel | Fast utility with restrained transitions. |

#### Section: Visual Refinement

**Goal:** Prevent generic AI-shaped UI before implementation starts.

Ask these once the core direction is clear:
- Which visual cliches would make this product feel generic or untrustworthy?
- Should the UI feel more editorial, product-like, operational, or tool-like?
- Where should visual emphasis come from: type, layout, color, motion, or imagery?
- Which surfaces should stay plain even if the rest of the app is expressive?
- Are placeholders acceptable, and if so, where must they stay explicit?

Write into `DESIGN.md`:

| Audit area | Rule |
|:-----------|:-----|
| Typography | Use one clear display/body relationship; avoid mixed random weights and over-decorated headings. |
| Layout | Do not default to interchangeable three-card rows when hierarchy needs a stronger composition. |
| Surfaces | Use boxes only when they clarify grouping; avoid wrapping every section in a card. |
| Content realism | Use explicit placeholders; do not invent fake testimonials, fake metrics, or fake product proof. |
| Motion | Keep motion purposeful and subordinate to hierarchy, not decorative noise. |
| Anti-generic rule | Name the two or three visual moves this product must avoid. |

#### Section: Elevation & Depth + Shapes

**Goal:** Define visual texture.

**Questions to ask:**
- Shadows or flat?
- Rounded corners or sharp?
- Cards with borders or shadows?

#### Section: Components

**Goal:** Define the app's UI vocabulary.

**This is the most important section.** Name components specific to the user's
app, not generic primitives.

Start with existing primitives before adding new UI: badge, button, card, field,
input, theme-toggle, and toast. Do not add video, chart, map, or carousel as
global primitives by default; heavy or domain-specific UI belongs under
`src/modules/<module>/ui/` unless it is genuinely cross-app infrastructure.
True reusable primitives live under `src/ui/components/<component>/`.

`frontend/` pages and screens are authored surfaces, not automatically reusable
components. Register only reusable units. Any reusable UI intended for AI answer
composition must include explicit `aiUi` metadata in its component manifest, or
in `manifest.aiUi.components` for module-scoped UI. Registered ids must be
globally unique; module ids should be namespaced, such as `consent.banner` or
`media.video-player`.

Build-time skills author components and manifests. The `ai-ui` module is the
runtime prefab renderer for AI answers, and registered manifests are the bridge
between those layers.

Write component decisions into the `Component Recipes` table in root
`DESIGN.md`. Use domain names and compose from CSMA primitives where possible:

| Component recipe | Compose from | Visual tokens | States | Type | Event/contract notes |
|:-----------------|:-------------|:--------------|:-------|:-----|:---------------------|
| `task-card` | `.card`, `.badge`, actions | surface, card padding, status color | hover, selected, loading | Type I or II | Publish `INTENT_TASK_SELECT` only if it changes app state. |
| `project-header` | semantic header, `.cluster`, `.button` | background, foreground, spacing | sticky, collapsed | Type I | No EventBus unless controls change state. |

For each component, ask:
- What does this component do?
- What states does it have? (default, hover, active, disabled, loading)
- Is it Type I (pure CSS) or Type II (needs EventBus)?

#### Section: App Anti-Patterns

**Goal:** Prevent visual drift by naming the moves this app must avoid.

Ask:
- Which common UI treatments would feel wrong for this product?
- Should cards, shadows, gradients, illustrations, icons, or animations be limited?
- Are there domain-specific mistakes that would harm trust or usability?

Write the answer into the `App Anti-Patterns` table in `DESIGN.md`.

#### Section: Layout Patterns

**Goal:** Define recurring page structures.

Ask the user to describe their main screens. For each, write a spatial recipe:

```markdown
### Project Board

Kanban-style columns. Fixed header with project name and filters. Three columns
(Todo, In Progress, Done) with draggable cards. Cards show task title, assignee
avatar, and priority badge.

- Layout: CSS grid, `grid-template-columns: repeat(3, 1fr)`
- Gap: `var(--space-md)`
- Card: `task-card` component with `data-priority` attribute
```

### Step 3: Generate Tokens

Once `DESIGN.md` records the decisions, update `src/style/token-overrides.json`
with the token values. `DESIGN.md` front matter is not a token source. Then run:

```bash
npm run tokens:patch
```

This generates `src/generated/tokens.css` with CSS custom properties.

### How To Edit The Large Token File

`src/style/design-tokens.json` is intentionally broad. Do not rewrite it or edit
it directly for app-specific work. Patch only the focused branches needed by the
design decision through `src/style/token-overrides.json`.

| Design decision | Edit this branch |
|:----------------|:-----------------|
| Brand palette, backgrounds, text, status colors | `themes.light`, `themes.dark`, `themes.contrast` |
| Font family, size scale, weights, line heights | `primitives.typography` |
| Compact, balanced, or spacious density | `primitives.spacing`; component padding only when needed |
| Round, sharp, or mixed shape language | `primitives.radius`; `components.button`, `components.card`, `components.input` |
| Flat, bordered, or elevated surfaces | `primitives.shadow`; `components.card`; `components.dialog` |
| Button height, input height, card padding | `components.button`, `components.input`, `components.card` |
| Page width, sidebar width, grid minimums | `primitives.layout` |
| Breakpoint changes | `primitives.breakpoint` |
| Motion timing or easing | `primitives.motion`; `semantic.transition` |

Patch rules:

- Inspect `tooling/generated/token-reference.json` and
  `docs/design/agent-map.md`
  before reading raw token source.
- Preserve DTCG shape: `$value`, `$type`, `$description`, and `$extensions`
  where they already exist.
- Keep semantic theme names stable unless the user explicitly asks for new
  themes.
- Keep component tokens as references to primitives when possible.
- Use full dot-notation paths in `src/style/token-overrides.json`.
- Do not edit `src/style/design-tokens.json` or `src/generated/tokens.css`
  directly; run `npm run tokens:patch`.
- Do not bulk-format or reorder the full JSON file.
- After token edits, run `npm run tokens:patch` and `npm run lint:styles`.
- Then inspect `/showcase/token-showcase.html` in light, dark, and contrast
  themes. Use the showcase to catch palette, typography, spacing, layout,
  radius, shadow, component, field, badge, status, and motion-token issues
  before composing app screens.

Raw-source guardrail:

- Do not read `src/style/design-tokens.json`, `src/style/foundation/*.css`, or
  `src/ui/components/**/*.css` by default during design discovery.
- Escalate only when extending a primitive/component or debugging a mismatch the
  showcase and token reference cannot explain.

### Craft Rules Before CSS

Before writing component or page CSS:

1. Choose one primary visual moment for the screen.
2. Define three hierarchy layers: primary, secondary, tertiary.
3. Choose density: compact, balanced, or spacious.
4. Use spacing before adding dividers, borders, cards, or shadows.
5. Use cards only for repeated items, framed tools, and modals.
6. Record forbidden visual moves in `DESIGN.md` before composing.

### Redesign Priority Order

When refining an existing UI, improve it in this order unless the user gives a
different priority:

1. Typography and hierarchy
2. Layout composition and spacing rhythm
3. Color, surfaces, and contrast structure
4. Component states and interaction clarity
5. Motion and polish

Do not start by adding decorative gradients, more cards, or stronger shadows if
the hierarchy and composition are still weak.

### Visual Audit Before Build

Run this mental checklist before implementing page CSS or new component skins:

- Is the layout doing enough work before boxes and dividers are added?
- Is there one clear primary focal region, or did everything become equally loud?
- Are repeated sections visually distinct enough to scan without becoming a card farm?
- Does typography create hierarchy without relying on color alone?
- Are placeholders clearly marked instead of pretending to be final proof or content?
- Is the design expressing the product's actual character instead of falling back to generic SaaS tropes?

### Pre-Flight Review Before Shipping

Before considering a design pass complete, review the result for:

- visual hierarchy drift between screens
- repeated generic patterns such as centered hero plus feature-card grid by default
- unnecessary card nesting, overboxing, or shadow noise
- weak empty, loading, hover, focus, and error states
- content realism, placeholder clarity, and trust signals
- responsive integrity, logical-property/RTL safety, and theme consistency
 

### Step 4: Build Components

Using DESIGN.md as the spec:

1. Create component folders under `src/ui/components/`
2. Write `.css` files for Type I components
3. Write `.css` + `.js` files for Type II components
4. Export `init[Name]System(eventBus)` for Type II
5. Add `@import` to `src/ui/components/index.css`

## Rules

- **Never skip the interview.** DESIGN.md without user input produces generic UI.
- **One section at a time.** Do not dump the entire file on the user.
- **Use the user's vocabulary.** If they call it a "project," don't call it a "workspace."
- **Reference tokens everywhere.** `var(--primary)`, not `#2563EB`.
- **Enforce CSMA Requirements.** The bottom section of DESIGN.md is non-negotiable.
- **Update token overrides, not generated CSS.** `token-overrides.json` → `npm run tokens:patch` → generated CSS.

## Example Conversation Flow

```
User: I want a dark-themed dashboard for monitoring servers.

Agent: [Reads DESIGN.md template]

Agent: Let's start with Overview. Who uses this dashboard and how should it feel?

User: DevOps engineers. It should feel like a mission control center — dense
      data, alert when things break, calm when everything's green.

Agent: [Writes Overview section in DESIGN.md]

Agent: For Colors - mission control makes me think of dark backgrounds with
      red/green status indicators. Do you have brand colors, or should I
      propose a palette?

User: No brand colors. Dark blue background, green for healthy, amber for
      warning, red for critical.

Agent: [Updates DESIGN.md token usage table, then edits src/style/token-overrides.json]

[... continues section by section ...]
```
