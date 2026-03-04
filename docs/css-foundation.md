# CSMA Foundation CSS Guide

Authoritative specification for the new CSMA component system. This guide is used by the `csma-foundation` package and replaces all legacy styles. There is no backward compatibility layer—every component must follow this document.

## 1. Design Principles

1. **Component-first** – Every component has a single base class (e.g., `.card`).
2. **Data attributes for variants & sizes** – Use `data-variant`, `data-tone`, `data-size`, `data-layout` to describe visual options.
3. **Explicit states** – Use `is-*` classes for transient state (focus-visible, loading, disabled, selected, expanded, busy, etc.).
4. **Token-driven** – All measurements, colors, shadows, typography reference CSS variables defined by the foundation.
5. **Responsive by token** – Breakpoints, spacing ramps, and typography scale through tokens (`--fx-breakpoint-md`, `--fx-space-lg`). No hard-coded pixels outside the token file.
6. **Accessible by default** – Components expose ARIA hooks, focus management, motion preferences, and high-contrast overrides.
7. **Composable utilities** – Shared layout helpers (`.stack`, `.cluster`, `.grid`, etc.) remain class-based but without legacy prefixes.

## 2. Package Layout (`@csma/foundation`)

```
@csma/foundation/
├─ tokens.css          # Core CSS variables (color, spacing, radius, z-index)
├─ utilities.css       # Layout helpers, typography utilities, motion helpers
├─ components/
│   ├─ card.css
│   ├─ button.css
│   ├─ modal.css
│   └─ ...
└─ themes/
    ├─ light.css
    ├─ dark.css
    └─ brand-*.css
```

Import order inside the app:

```css
@import "@csma/foundation/tokens.css";
@import "@csma/foundation/themes/light.css"; /* or brand */
@import "@csma/foundation/utilities.css";
@import "@csma/foundation/components/card.css";
```

Swapping the package name later only requires updating these import paths.

## 3. Token Specification

### 3.1 Color Tokens (`--fx-color-*`)

| Token | Description |
| --- | --- |
| `--fx-color-bg` | Application surface background |
| `--fx-color-bg-muted` | Secondary surface |
| `--fx-color-fg` | Primary text |
| `--fx-color-border` | Neutral border |
| `--fx-color-primary` / `--fx-color-on-primary` | Brand accent + readable foreground |
| `--fx-color-danger` / `--fx-color-on-danger` | Destructive tones |
| `--fx-color-success`, `--fx-color-warning`, etc. | Semantic states |
| `--fx-color-overlay` | Backdrop for modals/drawers |

### 3.2 Spacing & Sizing (`--fx-space-*`)

```
--fx-space-2xs: 0.125rem;
--fx-space-xs:  0.25rem;
--fx-space-sm:  0.5rem;
--fx-space-md:  1rem;
--fx-space-lg:  1.5rem;
--fx-space-xl:  2rem;
--fx-space-2xl: 3rem;
```

Use spacing tokens for padding, gaps, margins, inset spacing.

### 3.3 Radius (`--fx-radius-*`)

```
--fx-radius-sm: 0.25rem;
--fx-radius-md: 0.5rem;
--fx-radius-lg: 0.75rem;
--fx-radius-full: 999px;
```

### 3.4 Elevation (`--fx-shadow-*`)

```
--fx-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.08);
--fx-shadow-md: 0 4px 12px rgba(15, 23, 42, 0.12);
--fx-shadow-lg: 0 20px 45px rgba(15, 23, 42, 0.18);
```

### 3.5 Typography

```
--fx-font-family-base: "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
--fx-font-size-sm: 0.875rem;
--fx-font-size-md: 1rem;
--fx-font-size-lg: 1.125rem;
--fx-font-weight-regular: 400;
--fx-font-weight-medium: 500;
--fx-font-weight-semibold: 600;
--fx-line-height-tight: 1.2;
--fx-line-height-base: 1.5;
```

### 3.6 Breakpoints

```
--fx-breakpoint-sm: 480px;
--fx-breakpoint-md: 768px;
--fx-breakpoint-lg: 1024px;
--fx-breakpoint-xl: 1280px;
```

Use `@media (min-width: var(--fx-breakpoint-md)) { ... }` for responsive rules.

## 4. Naming Rules (Recap)

| Layer | Pattern | Example |
| --- | --- | --- |
| Component base class | `.component` | `.card`, `.modal`, `.sidebar` |
| Sub-elements (optional) | `.component__part` | `.card__header`, `.card__body`, `.card__footer` |
| Variants | `[data-variant="primary"]`, `[data-tone="muted"]` | `.card[data-variant="destructive"]` |
| Size | `[data-size="sm"]`, `[data-size="lg"]` | `.button[data-size="lg"]` |
| Layout toggles | `[data-layout="inline"]`, `[data-align="center"]` | `.badge[data-align="center"]` |
| State class | `.is-*` | `.is-active`, `.is-loading`, `.is-expanded` |
| Utility classes | `.stack`, `.grid`, `.cluster`, `.inline`, `.visually-hidden` |

Avoid namespace prefixes like `p-` or `u-`. HTML stays clean and matches shadcn readability.

## 5. Component Blueprint

### 5.1 Anatomy Template

```html
<article class="card" data-variant="default" data-size="md">
  <header class="card__header">Title</header>
  <section class="card__body">Content</section>
  <footer class="card__footer">
    <button class="button" data-variant="primary">Action</button>
  </footer>
</article>
```

### 5.2 Base Styles

```css
.card {
  border-radius: var(--fx-radius-lg);
  border: 1px solid var(--fx-color-border);
  background: var(--fx-color-bg);
  color: var(--fx-color-fg);
  padding: var(--fx-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--fx-space-md);
  box-shadow: var(--fx-shadow-sm);
  transition: box-shadow 150ms ease, transform 150ms ease;
}

.card__header {
  font-size: var(--fx-font-size-lg);
  font-weight: var(--fx-font-weight-semibold);
}

.card__body {
  font-size: var(--fx-font-size-md);
  line-height: var(--fx-line-height-base);
}

.card__footer {
  display: flex;
  gap: var(--fx-space-sm);
  justify-content: flex-end;
}
```

### 5.3 Variants

```css
.card[data-variant="primary"] {
  background: var(--fx-color-primary);
  color: var(--fx-color-on-primary);
  border-color: transparent;
}

.card[data-variant="muted"] {
  background: var(--fx-color-bg-muted);
  border-color: var(--fx-color-border);
}
```

### 5.4 Size Map

```css
.card[data-size="sm"] {
  padding: var(--fx-space-md);
  border-radius: var(--fx-radius-md);
}

.card[data-size="lg"] {
  padding: var(--fx-space-xl);
  border-radius: var(--fx-radius-lg);
}
```

### 5.5 States

```css
.card.is-hoverable:hover,
.card.is-hoverable:focus-visible {
  box-shadow: var(--fx-shadow-md);
  transform: translateY(-2px);
}

.card.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
  pointer-events: none;
}

.card.is-loading::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: color-mix(in srgb, var(--fx-color-fg) 8%, transparent);
  animation: fx-pulse 1s linear infinite;
}
```

## 6. Utility System

### 6.1 Stack

```css
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--fx-space-md);
}

.stack[data-gap="sm"] { gap: var(--fx-space-sm); }
.stack[data-gap="lg"] { gap: var(--fx-space-lg); }
```

### 6.2 Grid

```css
.grid {
  display: grid;
  gap: var(--fx-space-md);
}

.grid[data-columns="2"] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: var(--fx-breakpoint-md)) {
  .grid[data-responsive-columns="3"] {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
```

### 6.3 Cluster

```css
.cluster {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fx-space-sm);
  align-items: center;
}

.cluster[data-align="end"] { justify-content: flex-end; }
.cluster[data-align="space-between"] { justify-content: space-between; }
```

### 6.4 Visibility Helpers

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .motion-safe { transition: none !important; animation: none !important; }
}
```

Utilities never carry `csma-` prefixes; they are global helpers defined solely by this package.

## 7. Accessibility & Interaction

1. **Focus styles** – Provide `.focus-ring` utility and integrate with components via `:focus-visible`.
2. **Reduced motion** – Wrap motion-heavy components with `@media (prefers-reduced-motion: reduce)` overrides.
3. **Contrast** – Tokens must satisfy WCAG AA for text/interactive states. Provide `themes/high-contrast.css` for contexts requiring >4.5:1 ratios.
4. **ARIA hooks** – Document default ARIA roles/states alongside each component blueprint.
5. **Keyboard** – Components must specify expected keyboard interactions in their docs (e.g., `Space` toggles `.is-expanded`).

## 8. Theming Strategy

Themes override tokens only; component CSS never redefines colors directly. Example:

```css
:root {
  color-scheme: light;
  --fx-color-bg: #0b1120;
  --fx-color-fg: #f8fafc;
  --fx-color-primary: #22d3ee;
  --fx-color-on-primary: #042f2e;
}

[data-theme="light"] {
  --fx-color-bg: #f8fafc;
  --fx-color-fg: #0f172a;
  --fx-color-primary: #6366f1;
}
```

App code can toggle `data-theme` on `<html>` or `<body>` to switch themes without touching component CSS.

## 9. Component Authoring Checklist

1. Define anatomy: list required sub-elements and ARIA roles.
2. Map tokens: background, text, border, spacing, radius, shadow, typography.
3. Declare variants via `data-variant` / `data-tone`.
4. Declare sizes via `data-size`.
5. Declare states via `is-*` classes.
6. Add responsive rules using breakpoint tokens only.
7. Add motion safety and reduced-motion overrides.
8. Document usage snippet, JS hooks (if any), and accessibility notes.

## 10. Migration Playbook

1. **Inventory** – List existing components and map their props/states.
2. **Tokenize** – Replace raw values with `--fx-*` tokens.
3. **Rebuild base** – Re-implement component CSS following this guide.
4. **Wire variants** – Move variant logic to `data-variant` selectors.
5. **Introduce states** – Replace `.active`, `.open`, etc. with `.is-active`, `.is-open`.
6. **Adopt utilities** – Replace ad-hoc layout CSS with `.stack`, `.grid`, `.cluster` where possible.
7. **Validate** – Run linting (`stylelint` with `csma-foundation` config), visual regression, and accessibility checks.
8. **Publish** – Update import paths to pull from `@csma/foundation`.

## 11. Linting & Tooling

- Provide a shared Stylelint config enforcing:
  - No raw color/spacing values outside `tokens.css`.
  - Disallow `.p-*` / `.u-*` prefixes.
  - Require `data-` attributes for variants/sizes.
  - Require `is-` prefix for state classes.
- Add a codemod (optional) that converts old class names to the new structure.
- Integrate visual regression tests (Percy/Playwright) during migration to catch design drifts.

## 12. Reference Implementation

Include a Storybook (or minimal pattern library) built from `@csma/foundation` to show every component variation (base/variants/sizes/states). This acts as the contract between design and engineering and is the fastest way to verify LLM-generated UI conforms to the system.

---

Use this guide as the only source of truth when authoring or refactoring components. If a component requires behavior outside the defined patterns, document the reasoning and update this file before implementing it.
