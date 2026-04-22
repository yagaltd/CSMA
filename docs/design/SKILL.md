---
name: csma-design
description: CSMA design skill — token system, visual principles, layout rules, component usage, and design workflow. Use when designing or updating UI in a CSMA project.
---

<!-- version: 2.0.0 | tags: design, tokens, css, layout, components -->

# CSMA Design Skill

## Token System

All visual values live in `src/style/design-tokens.json` (DTCG format).

```bash
npm run tokens   # regenerates src/generated/tokens.css
```

**Never edit generated CSS directly.** Always change the JSON source and regenerate.

### Token categories

- **Colors**: `--background`, `--surface`, `--foreground`, `--border`, `--primary`, `--secondary`, `--accent`, `--destructive`, `--success`, `--warning`, `--info`
- **Spacing**: `--space-2xs` (2px) through `--space-5xl` (96px)
- **Radius**: `--radius-sm` through `--radius-full`
- **Typography**: `--font-family-base`, `--font-family-mono`; `--font-size-xs` through `--font-size-3xl`; `--font-weight-regular` through `--font-weight-bold`; `--line-height-tight` through `--line-height-loose`
- **Motion**: `--transition-fast` (120ms), `--transition-normal` (200ms), `--transition-slow` (320ms)
- **Shadows**: `--shadow-xs` through `--shadow-xl`
- **Breakpoints**: `--breakpoint-sm` (480px) through `--breakpoint-xl` (1280px)
- **Z-Index**: `--z-base` (1) through `--z-tooltip` (600)

## Visual Principles

1. **Tokens first.** Every visual value must reference a token.
2. **Hierarchy before decoration.** Spacing, weight, and alignment do more work than chrome.
3. **Accessibility is default.** WCAG contrast, focus rings, reduced motion support.
4. **Intentional and calm.** Surfaces stay quiet. One dominant action per major section.
5. **Light and dark themes.** Toggle via `document.documentElement.dataset.theme = 'light' | 'dark'`.

## State Changes = CSS Classes Only

```javascript
// CORRECT
element.className = 'card completed high-priority';
element.dataset.state = 'loading';

// WRONG
element.style.opacity = '1';
element.style.borderColor = 'green';
```

Define all states in CSS:

```css
.card[data-state="pending"] { border-left: 4px solid var(--warning); }
.card[data-state="completed"] { border: 4px solid var(--success); }
.card[data-state="loading"] { opacity: 0.7; pointer-events: none; }
```

## Component Usage

### Type I — Pure CSS

No JS required. Uses `data-*` attributes for variants and states.

```css
button.badge[data-variant="soft-primary"] { … }
```

### Type II — EventBus-Driven

CSS + JS. Exports `init[Name]System(eventBus)` returning a cleanup function.

```javascript
export function initToastSystem(eventBus) {
  const unsubscribe = eventBus.subscribe('INTENT_TOAST_SHOW', (payload) => {
    showToast(payload);
  });
  return () => unsubscribe();
}
```

## Layout Rules

- Use spacing tokens for all gaps and padding.
- Use container tokens for max-widths.
- Use `.stack`, `.grid`, `.cluster` utilities from `src/style/foundation/layout.css`.
- Support `prefers-reduced-motion: reduce`.
- Do not hardcode color fallbacks when a semantic token exists.
- Do not use `innerHTML` for user data — always use `textContent`.

## Adding a Component

1. Create `src/ui/components/<name>/<name>.css` with all visual states.
2. (Optional) Create `<name>.js` for Type II — export `init[Name]System(eventBus)`.
3. Add `@import './<name>/<name>.css';` to `src/ui/components/index.css`.
4. (Type II) Import and call init in your bootstrap file.

## Product Structure (UX Planning)

Before composing a new screen, clarify:

- **Domain** — what problem does this solve?
- **Primary user roles** — who uses this?
- **Top-level screens** — what are the main views?
- **Navigation groups** — how do users move between views?
- **Top flows** — what are the critical user journeys?
- **State expectations** — what do empty, loading, error, and success states look like?

Write these findings into `design.md` (or chat them with your agent) before building.

## Primitive Rules

Primitives must be:

- **Narrow** — do one thing well.
- **Reusable** — not tied to a specific page or brand.
- **Role-based** — named by function, not appearance.
- **Stable** — props and slots don't change arbitrarily.
- **Not brand-specific** — no logos, no campaign colors.

Examples: `button`, `input`, `field`, `card`, `badge`.
