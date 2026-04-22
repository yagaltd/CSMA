---
name: csma-design
description: How to create and use DESIGN.md for a CSMA project. Guides the agent through collaborative design discovery with the user.
---

<!-- version: 2.0.0 | tags: design, DESIGN.md, tokens, workflow -->

# CSMA Design Skill

## Purpose

This skill guides collaborative design discovery between you (the agent) and the
user. The output is a filled `DESIGN.md` at the project root — the single source
of truth for the app's visual identity.

## Starting Point

The repo includes `DESIGN.md` as a **template** with placeholder sections. Your
job is to fill it through conversation with the user. Do not write the entire
file at once. Iterate section by section.

## Workflow

### Step 1: Read the Template

Open `DESIGN.md` at repo root. It has:
- YAML front matter with placeholder tokens
- Markdown sections with `<!-- Agent: ... -->` comments telling you what to do
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

**Write into DESIGN.md front matter:**
```yaml
colors:
  primary: "#2563EB"
  secondary: "#64748B"
  accent: "#F59E0B"
```

**Write into prose:**
```markdown
## Colors

Blue primary for actions and focus. Slate secondary for borders and metadata.
Amber accent for warnings and highlights. All backgrounds are warm gray to
reduce eye strain during long sessions.
```

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

**Bad:**
```yaml
components:
  button: ...
  card: ...
```

**Good:**
```yaml
components:
  task-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  task-card-hover:
    backgroundColor: "{colors.backgroundMuted}"
  project-header:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primaryForeground}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  status-badge-done:
    backgroundColor: "{colors.success}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
    padding: "{spacing.xs} {spacing.sm}"
```

For each component, ask:
- What does this component do?
- What states does it have? (default, hover, active, disabled, loading)
- Is it Type I (pure CSS) or Type II (needs EventBus)?

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

Once DESIGN.md front matter is filled, update `src/style/design-tokens.json`
with the token values. Then run:

```bash
npm run tokens
```

This generates `src/generated/tokens.css` with CSS custom properties.

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
- **Update tokens in JSON, not CSS.** `design-tokens.json` → `npm run tokens` → generated CSS.

## Example Conversation Flow

```
User: I want a dark-themed dashboard for monitoring servers.

Agent: [Reads DESIGN.md template]

Agent: Let's start with Overview. Who uses this dashboard and how should it feel?

User: DevOps engineers. It should feel like a mission control center — dense
      data, alert when things break, calm when everything's green.

Agent: [Writes Overview section in DESIGN.md]

Agent: For Colors — mission control makes me think of dark backgrounds with
      red/green status indicators. Do you have brand colors, or should I
      propose a palette?

User: No brand colors. Dark blue background, green for healthy, amber for
      warning, red for critical.

Agent: [Updates front matter colors + writes Colors prose section]

[... continues section by section ...]
```
