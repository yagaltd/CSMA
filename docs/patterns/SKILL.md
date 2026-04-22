---
name: csma-patterns
description: Layout recipes and spatial patterns for CSMA. Use when composing pages, sections, or reusable layouts from primitives and tokens.
---

<!-- version: 2.1.0 | tags: patterns, layout, composition, css, tokens -->

# CSMA Patterns Skill

## Pattern Philosophy

```text
Component = Atomic UI element (button, badge, card, field, input)
Pattern   = Reusable composition of components (hero, settings, shell)
Module    = Feature/service layer with contracts, registries, and behavior
```

Build with existing primitives first. Compose pages freely using layout tokens
and CSS utilities. There is no rigid page scaffold and no pattern compiler.

## Token And Utility Reference

| Need | Use | Notes |
|:-----|:----|:------|
| Color | `--background`, `--surface`, `--foreground`, `--border`, semantic status tokens | Theme-aware tokens from `src/generated/tokens.css`. |
| Spacing | `--space-xs` through `--space-5xl` | Use relationship tables below before inventing local gaps. |
| Layout | `--layout-container-narrow`, `--layout-container`, `--layout-container-wide`, `--layout-sidebar` | Containers are max widths, not mandatory wrappers. |
| Grid minimums | `--layout-grid-min-sm`, `--layout-grid-min-md`, `--layout-grid-min-lg` | Use with `minmax()` for responsive cards. |
| Radius | `--radius-sm` through `--radius-xl`, `--radius-full` | Prefer primitive/component tokens over one-off values. |
| Depth | `--shadow-xs` through `--shadow-xl`, `--card-shadow` | Use depth for interaction or hierarchy, not decoration. |
| Composition | `.stack`, `.grid`, `.cluster`, `.surface` | From `src/style/foundation/layout.css`. |

## Component Recipes

| Recipe | Compose | Layout | Gap | States | Type | Notes |
|:-------|:--------|:-------|:----|:-------|:-----|:------|
| Action row | `.cluster` + `.button` variants | Wrap, align end or space-between | `--space-sm` | `aria-pressed`, `disabled`, `data-loading` | Type I unless publishing intents | Primary action last on desktop when aligned right. |
| Metric card | `.card` + label + value + `.badge` | Vertical stack | `--space-sm` inside, `--space-md` grid | `data-trend`, `data-state` | Type I | Keep value tabular if numbers compare across cards. |
| Form field | `.field` + `.field__label` + `.input` + helper/error | Vertical stack | `--space-sm` | `data-state="error"` or `"success"` | Type I | Use real `<label for>` when possible. |
| Filter toolbar | `.cluster` + ghost/outline buttons + badges | Wrap across rows | `--space-xs` controls, `--space-sm` groups | `aria-pressed` for selected filters | Type II if filters drive EventBus | Store visual state in attributes, not inline styles. |
| Status badge set | `.cluster` + `.badge` variants | Inline wrap | `--space-xs` | `data-variant`, `data-leading-dot` | Type I | Use solid for active state, soft for metadata. |
| Content card | `.card`, `.card__header`, `.card__body`, `.card__footer` | Vertical stack | Component default | `data-tone`, `data-state` | Type I | Do not nest cards inside cards; split into sibling sections. |
| Toast/notification | Existing toast component | Fixed stack via component CSS | Component default | `data-state`, `data-variant` | Type II | Validate EventBus payloads with Contracts. |
| Theme control | `.button` or theme-toggle component | Inline control | `--space-xs` | `data-theme`, `aria-pressed` | Type II if persisted | Keep label text updated with `textContent`. |

## Craft Rules

Use these before selecting a layout recipe or writing CSS.

| Rule | Implementation check |
|:-----|:---------------------|
| Choose one primary visual moment per screen | One element or region gets the strongest scale, contrast, or position. |
| Define three hierarchy layers | Primary gets first read; secondary explains; tertiary holds metadata and controls. |
| Set density first | Compact, balanced, or spacious determines row height, gaps, and section rhythm. |
| Use spacing before containers | Try proximity and whitespace before adding dividers, borders, cards, or shadows. |
| Reserve cards for real containers | Use cards for repeated items, framed tools, modals, and not for every page section. |
| Keep one signature motif | Repeat one app-specific motif instead of mixing many decorative ideas. |

## Signature Primitive Recipes

These are optional app-specific primitives. Add them only when the app needs a
recognizable repeated motif that ordinary cards, badges, and rows cannot express.

| Primitive | Best for | Compose | State hooks | Type | Notes |
|:----------|:---------|:--------|:------------|:-----|:------|
| `status-strip` | Priority, health, workflow stage | Thin block/inline element plus semantic color token | `data-status`, `data-priority` | Type I | Apply to the edge or header of a record; do not use as decoration. |
| `metric-panel` | One important number with context | Label, value, unit, trend badge | `data-trend`, `data-state` | Type I or II | Use when the metric is the primary or secondary visual moment. |
| `timeline-row` | Events, audit trails, histories | Row stack, timestamp, marker, content | `data-state`, `data-current` | Type I | Let indentation and spacing carry hierarchy before adding lines. |
| `command-bar` | Search, command palettes, dense tools | `.input`, action buttons, optional shortcuts | `data-active`, `data-loading` | Type II if commands publish intents | Keep it reachable and avoid hiding primary actions on mobile. |
| `inspection-card` | Review, QA, diagnostics, approvals | `.card`, status badge, evidence rows, actions | `data-result`, `data-expanded` | Type II if expandable or async | Use for framed tools; avoid nesting cards inside evidence sections. |

## Layout Recipes

| Recipe | Shell | Container | Desktop | Mobile | Notes |
|:-------|:------|:----------|:--------|:-------|:------|
| App dashboard | Page shell + sidebar + main stack | `--layout-container-wide` | `grid-template-columns: var(--layout-sidebar) 1fr` | Sidebar becomes top nav or collapses above content | Keep main content `min-width: 0` for text truncation. |
| Data overview | Header + metric grid + detail grid | `--layout-container-wide` | Metrics 4 columns, details 2 columns | Metrics 2 columns then 1; details stack | Use `--layout-grid-min-sm` for resilient card widths. |
| Settings form | Section stack + narrow form stack | `--layout-container-narrow` | Label/content can use two-column rows | Single-column fields | Put actions in trailing `.cluster`, not a nested card. |
| Auth split | Full-height grid | Full viewport or `--layout-container-wide` | Two columns: brand/content and form | Stack brand copy above form | Keep the form in a semantic `<main>` or `<section>`. |
| Marketing hero | Full-width section + constrained inner stack | `--layout-container` or wide | Left-aligned or centered copy with CTA cluster | Copy stays first, CTA wraps | Use real media when the product/place/object matters. |
| Resource list | Header + toolbar + list/card grid | `--layout-container-wide` | Toolbar left/right, list table or 3-col grid | Toolbar wraps, cards/list become single-column | Filters need `aria-pressed` and persistent labels. |
| Detail page | Header + content/sidebar grid | `--layout-container-wide` | Main content plus sticky aside | Aside moves below content | Aside should not contain the primary action if it disappears below fold. |

## Responsive Recipes

| Pattern | Default | `md+` | `lg+` | Collapse rule |
|:--------|:--------|:------|:------|:--------------|
| Responsive grid | One column | `repeat(2, minmax(0, 1fr))` | `repeat(3, minmax(0, 1fr))` | Use auto-fit/minmax when content count is unknown. |
| Card collection | `grid-template-columns: 1fr` | `repeat(auto-fit, minmax(var(--layout-grid-min-sm), 1fr))` | Increase min to `--layout-grid-min-md` for dense cards | Never let cards shrink below readable content. |
| Sidebar layout | Content first | Optional two-column | `var(--layout-sidebar) 1fr` | Sidebar becomes horizontal cluster or below-content aside. |
| Split panel | Stack sections | Two columns if both sides remain readable | Preserve 50/50 or 40/60 | Stack if either side needs less than `--layout-grid-min-md`. |
| Toolbar | Wrapped `.cluster` | Space-between groups | Same | Controls wrap before text truncates. |
| Form row | One field per row | Optional label/control columns | Same | Required/error text stays under its control. |
| Table alternative | Card/list rows | Compact table only if useful | Table or split list/detail | Use cards when columns become unreadable. |

## Spacing Relationships

| Relationship | Token | Usage |
|:-------------|:------|:------|
| Icon to label | `--space-xs` | Inside buttons, badges, compact inline metadata. |
| Closely related controls | `--space-sm` | Button groups, field label to input, toolbar controls. |
| Component internals | `--space-md` to `--space-lg` | List rows, card bodies, form groups. |
| Card or panel padding | `--card-padding` or `--space-xl` | Standard contained surfaces. |
| Between sibling cards | `--space-md` to `--space-xl` | Grid/list gaps; scale with density. |
| Section header to content | `--space-lg` to `--space-xl` | Page sections and dashboard bands. |
| Major page bands | `--space-2xl` to `--space-4xl` | Top-level vertical rhythm. |
| Outer page inset | `--space-xl` mobile, `--space-3xl` desktop | Apply with responsive media queries. |

## Type I/II Decisions

| Need | Type | Implementation rule |
|:-----|:-----|:--------------------|
| Static layout, visual variants, hover/focus, disabled | Type I | CSS classes and `data-*` attributes only. |
| Open/closed disclosure without shared app state | Type I when native HTML works | Prefer `<details>` or dialog primitives before JS. |
| User intent changes app state | Type II | Publish `INTENT_*`, validate payload, then render from confirmed state. |
| Async operation or loading state | Type II | Set `data-loading` or `data-state` from state transitions. |
| Global notification | Type II | Use EventBus and toast Contracts. |
| Theme persistence | Type II | Set `document.documentElement.dataset.theme`; persist outside CSS. |
| User-provided content | Type I or II | Always write with `textContent`, never `innerHTML`. |
| Animation-only feedback | Type I | Respect `prefers-reduced-motion`. |

## Composing Patterns

Patterns are plain semantic HTML plus CSS. Use tokens from
`src/generated/tokens.css`, import component primitives through
`src/style/main.css`, and keep UI state in classes or `data-*`.

```html
<section class="stack" data-gap="xl">
  <header class="stack" data-gap="sm">
    <span class="badge" data-variant="soft-primary">New</span>
    <h1>Welcome back</h1>
    <p>Pick up where you left off.</p>
  </header>
  <div class="grid" data-responsive-columns="3">
    <article class="card">...</article>
    <article class="card">...</article>
    <article class="card">...</article>
  </div>
</section>
```

## Rules

- Use semantic HTML first.
- Prefer existing component class names before creating new primitives.
- Keep visual state in classes, ARIA attributes, or `data-*`.
- Do not mutate inline styles for UI state.
- All spacing, color, radius, and shadows must use tokens.
- Validate EventBus payloads with Contracts for Type II components.
