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

Existing primitives are badge, button, card, field, input, theme-toggle, and
toast. Do not promote heavy UI such as video players, charts, maps, or carousels
to global primitives by default. Put domain UI under `src/modules/<module>/ui/`
and put true cross-app primitives under `src/ui/components/<component>/`.

Pages and screens under `frontend/` are authoring surfaces, not reusable UI by
default. Reusable UI becomes AI-discoverable only when it has explicit `aiUi`
metadata. Core primitives use `src/ui/components/<component>/manifest.json`;
module-scoped reusable UI uses `manifest.aiUi.components` and is discoverable
only after that module is loaded. Component ids must be globally unique.
Module-owned embeddable surfaces live in `src/modules/<module>/aiui/`
(currently `comments-thread`, `chart-display`); adapter contribution ids are
dotted and module-prefixed (`search.flexsearch`, `captcha.cap`).

The `ai-ui` module is a runtime prefab renderer for AI answers. Skills are the
build-time authoring layer. Registered component manifests bridge those layers,
and `aiUi.render` is the safe DOM rendering source of truth while `template`
remains documentation/example material.

After layout or breakpoint token edits, inspect
`/showcase/token-showcase.html` and its Layout Primitives section before
composing page recipes.

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
| Auth panel | `auth-ui` module pattern | Module renders semantic forms | Module default | form errors, loading, session status | Type II | Use `FEATURES.AUTH_UI_MODULE`; do not create auth primitives under `src/ui/components/`. |

### Auth Pattern

For account flows, use the module-scoped `auth-ui` pattern (`auth-ui.panel`)
instead of hand-wiring global auth form primitives. It composes the existing
`.button`, `.field`, `.input`, and `.badge` primitives, delegates session work to
`auth`, and delegates form preflight to `form-management`.

Plan the full lifecycle when relevant: login, register, forgot password, reset
password, verify email, resend verification, OAuth, logout, and session status.
Enable `runtimeConfig.authUi.captcha` for public registration and recovery abuse
surfaces when CAPTCHA is available.

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
| Single modal, drawer, or menu | Type I when native HTML works | Prefer `<dialog>` (`showModal()`) or `popover` attribute; use `overlay-manager` only when you need stacking, multi-overlay queues, or cross-archetype consistency. |
| User intent changes app state | Type II | Publish `INTENT_*`, validate payload, then render from confirmed state. |
| Async operation or loading state | Type II | Set `data-loading` or `data-state` from state transitions. |
| Global notification | Type II | Use EventBus and toast Contracts. |
| Theme persistence | Type II | Set `document.documentElement.dataset.theme`; persist outside CSS. |
| User-provided content | Type I or II | Always write with `textContent`, never `innerHTML`. |
| Animation-only feedback | Type I | Respect `prefers-reduced-motion`. |

Before inventing new JS for responsive behavior, overlay plumbing, or purely
visual validation feedback, consult `docs/css/SKILL.md` to check whether modern
CSS or native HTML primitives already cover the case with a clear fallback.

## Composing Patterns

### From recipes to project page layouts

Layout recipes above are prose guidance for composing one page. When the same
page shape recurs across a project (second and third category page, another
detail page), extract it into a **project page-layout function** instead of
re-composing per page:

- Same shape as slide layouts: a pure render function that takes a config
  object and returns a spec tree (mounted via `spec()`/`mountTree()` from
  `ai-ui/specHelpers.js`) — stateless, no listeners, no lifecycle.
- Lives near the app code that shares it (project `layouts/` folder), not in
  CSMA core. Page templates encode *this product's* page shapes and stay
  project-specific; only cross-project interactive shells graduate to
  `src/modules/archetypes/` (see `docs/architecture/SKILL.md` — template
  disambiguation + extraction rule).
- Recipe → layout mapping is direct: "Detail page" recipe becomes
  `createDetailPageLayout(config)`, "Auth split" becomes
  `createAuthSplitLayout(config)`, and so on. Landmarks from the recipe become
  the layout's fixed structure.

### Page landmarks

Every composed page or demo surface is copyable teaching material — it must
expose standard landmarks:

- Exactly one `<main>` wrapping the primary content column (the app root or
  grid container is usually the right element).
- `<header>` for the page/tool chrome, `<nav>` for primary navigation,
  `<aside>` for side content, `<footer>` for page-end content.
- Decorative shells inside those landmarks stay `div`s — do not promote them.

### Rendering containment for long lists

Foundation ships utilities in `hardening/states.css` and
`hardening/accessibility.css`. Apply them at *structural boundaries* — the
list/grid container, not each item:

- Repeated-item containers likely to grow beyond the viewport (data-grid rows,
  decks, feeds): add `content-visibility: auto` (`.content-auto`) and pair it
  with `contain-intrinsic-size: auto <estimated-height>` so the scrollbar does
  not jump. Intrinsic size is per-surface (depends on row height) — set it in
  the surface's own CSS or via a `--row-h` token, not as a blanket utility.
- Self-contained widgets and islands (cards with internal updates, embed
  surfaces): `.contain-content` / `.contain-layout` / `.contain-paint`.
- Containment is an architecture decision per surface, not a design-token
  value — tokens carry values (color/space); structure carries containment.
- For data-driven surfaces where offscreen DOM should not exist at all
  (large decks, grids), compose with the `layout` module utilities
  (`CullingCore` viewport culling, `RenderScheduler` rAF coalescing,
  `yieldToMain` for long synchronous loops) — they complement CSS containment:
  CSS skips paint for DOM you keep; culling skips creating it.

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
- Prefer `@container` for component-local adaptation and `@media` for page/shell breakpoints.
- Prefer native HTML/CSS primitives such as `<details>`, `<dialog>`, or `popover` when they fit the interaction better than custom JS.
- Compose pages with standard landmarks (`<main>`, `<header>`, `<nav>`); long repeated lists get `content-visibility` at their container boundary.
- All spacing, color, radius, and shadows must use tokens.
- Validate EventBus payloads with Contracts for Type II components.
