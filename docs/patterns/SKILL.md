---
name: csma-patterns
description: Layout recipes and spatial patterns for CSMA. Use when composing pages, sections, or reusable layouts from primitives and tokens.
---

<!-- version: 2.0.0 | tags: patterns, layout, composition, css, tokens -->

# CSMA Patterns Skill

## Pattern Philosophy

```text
Component = Atomic UI element (button, badge, toast)
Pattern   = Reusable composition of components (hero, settings, checkout)
Module    = Feature/service layer with contracts, registries, and behavior
```

Build with existing components first. Compose pages freely using layout tokens
and CSS utilities. There is no rigid page scaffold.

## Layout Tokens

Reference these from `src/generated/tokens.css`:

- **Breakpoints**: `--breakpoint-sm` (480px), `--breakpoint-md` (768px), `--breakpoint-lg` (1024px), `--breakpoint-xl` (1280px)
- **Container max-widths**: use `--space-3xl` / `--space-4xl` / `--space-5xl` for section padding
- **Grid**: compose with `.grid` utility and `@media` queries at breakpoints

## CSS Utilities

From `src/style/foundation/layout.css`:

- `.stack` — vertical flex column with gap controlled by `data-gap` token
- `.grid` — responsive CSS grid with `data-responsive-columns`
- `.cluster` — horizontal flex row that wraps
- `.center` — centered single column with max-width

## Spatial Recipes

### Auth Split-Screen

```
+----------------------------------+
|  Brand / Illustration  |  Form   |
|        (50%)           |  (50%)  |
+----------------------------------+
```

- Use `.grid` with `data-responsive-columns="2"`.
- Below `--breakpoint-md`, stack to single column.
- Left side: brand color background, large headline.
- Right side: `.stack` with `data-gap="lg"` containing `field` + `input` + `button`.

### Dashboard Grid

```
+----------------------------------+
|  Sidebar  |  Header               |
|           +-----------------------+
|  (fixed)  |  Cards / Tables       |
|           |  .grid 3-col on lg    |
+----------------------------------+
```

- Sidebar: fixed width, `.stack` navigation links.
- Main: `.stack` with header + `.grid` content area.
- Cards use `--shadow-sm` and `--radius-lg`.

### Settings Form

```
+----------------------------------+
|  Section Title                    |
|  .stack gap=lg                    |
|    field > input                  |
|    field > input                  |
|    cluster (buttons)              |
+----------------------------------+
```

- Group related fields in `.stack` containers.
- Action buttons in `.cluster` with `justify-content: flex-end`.
- Use `--space-xl` between sections.

### Hero Section

```
+----------------------------------+
|  badge (eyebrow)                  |
|  h1 (headline)                    |
|  p (supporting text)              |
|  .cluster (CTA buttons)           |
+----------------------------------+
```

- Centered `.stack` on large screens, left-aligned on mobile.
- Background: `--surface` or subtle gradient using token colors.
- CTA buttons: primary + secondary variant pair.

## Composing Patterns

Patterns are plain HTML + CSS. No JSON archetypes. No engine compilation.

Example:

```html
<section class="stack" data-gap="xl">
  <header class="stack" data-gap="sm">
    <span class="badge" data-variant="soft-primary">New</span>
    <h1>Welcome back</h1>
    <p>Pick up where you left off.</p>
  </header>
  <div class="grid" data-responsive-columns="3">
    <article class="card">…</article>
    <article class="card">…</article>
    <article class="card">…</article>
  </div>
</section>
```

## Rules

- Use semantic HTML first.
- Keep visual state in classes or `data-*`.
- Do not mutate inline styles for UI state.
- Use existing component class names instead of re-creating primitives.
- All spacing, color, and radius must use tokens.
