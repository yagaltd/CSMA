# CSMA Theme Guide

## Overview

CSMA now uses `src/css/theme.css` as the canonical theme contract.

- `src/css/main.css` is the only stylesheet entrypoint applications should import.
- `src/css/theme.css` defines shared scales, semantic tokens, and component recipe tokens.
- `src/css/foundation/themes/light.css` and `src/css/foundation/themes/dark.css` define theme-specific variable values only.

## Where To Change What

| File | Purpose |
|------|---------|
| `src/css/theme.css` | Shared scales, semantic token contract, component recipe defaults |
| `src/css/foundation/themes/light.css` | Light theme color values |
| `src/css/foundation/themes/dark.css` | Dark theme color values |
| `src/ui/components/*/*.css` | Component implementation details that should consume semantic or recipe tokens |

## Token Layers

### Semantic tokens

Use these for broad theming across all components:

```css
--background
--foreground
--surface
--border
--primary
--secondary
--accent
--destructive
--success
--warning
--info
--ring
```

### Recipe tokens

Use these when a component needs structure or behavior beyond palette swaps:

```css
--button-radius
--input-height
--card-shadow
--dialog-radius
--navbar-link-hover-bg
--table-row-selected-bg
```

### Legacy import note

Legacy token families and the old `tokens.css` entrypoint have been removed from the source tree.

## Theme Switching

Theme switching remains:

```js
document.documentElement.dataset.theme = 'dark';
```

Supported values:
- `light`
- `dark`

If no `data-theme` is set, CSMA defaults to the light theme and respects the dark preference fallback defined in `dark.css`.

## Authoring Rules

1. Import only `src/css/main.css` from app and demo pages.
2. Do not import `foundation/themes/*.css` directly in components.
3. Prefer semantic tokens first, recipe tokens second, and one-off component overrides last.
4. Keep theme files variable-only. No component selectors in theme partials.

## Verification

```bash
npm run lint:styles
npm run build
```

The style guard now checks that:
- `main.css` imports `theme.css`
- `theme.css` imports both `light.css` and `dark.css`
- every component CSS file is registered in `src/ui/components/index.css`
- removed foundation component stylesheet paths are not referenced in source files
