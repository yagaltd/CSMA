# CSMA CSS Foundation Guide

This document describes the CSS system that exists in the current repository. It is the source of truth for styling the CSMA template today.

If a future `@csma/foundation` package is extracted later, it should mirror this layout and token contract. Until then, the repo paths below are the real ones to use.

## 1. Import Order

The current app entrypoint is [`src/css/main.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/main.css).

```css
@import './theme.css';
@import './foundation/utilities.css';
@import './base.css';
@import './touch.css';
@import '../ui/components/index.css';
@import '../ui/patterns/index.css';
```

Use that order in new apps too:
- theme contract first
- utilities second
- global base styles third
- component and pattern bundles last

## 2. Token Contract

[`src/css/theme.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/theme.css) defines the shared scales and component recipe tokens.

### Typography
- `--font-family-base`
- `--font-family-mono`
- `--font-size-xs`, `--font-size-sm`, `--font-size-base`, `--font-size-lg`, `--font-size-xl`, `--font-size-2xl`
- `--font-weight-regular`, `--font-weight-medium`, `--font-weight-semibold`, `--font-weight-bold`
- `--line-height-tight`, `--line-height-base`, `--line-height-loose`

### Spacing
- `--space-2xs`
- `--space-xs`
- `--space-sm`
- `--space-md`
- `--space-lg`
- `--space-xl`
- `--space-2xl`
- `--space-3xl`
- `--space-4xl`
- `--space-5xl`

### Radius
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--radius-xl`
- `--radius-2xl`
- `--radius-3xl`
- `--radius-full`

### Motion and layering
- `--transition-fast`
- `--transition-normal`
- `--transition-slow`
- `--breakpoint-sm`
- `--breakpoint-md`
- `--breakpoint-lg`
- `--breakpoint-xl`
- `--z-base`
- `--z-overlay`
- `--z-modal`
- `--z-popover`
- `--z-toast`

### Component recipes
- `--button-*`
- `--input-*`
- `--card-*`
- `--dialog-*`
- `--navbar-*`
- `--table-*`

## 3. Theme Values

Theme-specific color values live in:
- [`src/css/foundation/themes/light.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/foundation/themes/light.css)
- [`src/css/foundation/themes/dark.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/foundation/themes/dark.css)

Those files should only override semantic colors:
- `--background`
- `--background-muted`
- `--surface`
- `--surface-muted`
- `--foreground`
- `--foreground-muted`
- `--border`
- `--overlay`
- `--primary`
- `--primary-foreground`
- `--secondary`
- `--secondary-foreground`
- `--accent`
- `--accent-foreground`
- `--destructive`
- `--destructive-foreground`
- `--success`
- `--success-foreground`
- `--warning`
- `--warning-foreground`
- `--info`
- `--info-foreground`

## 4. Component Rules

1. Use a single base class per component.
2. Use `data-variant`, `data-size`, and `data-state` for styling branches.
3. Keep visual state in CSS, not inline JS styles.
4. Use `is-*` classes only for transient states that are hard to represent with `data-*`.
5. Prefer semantic tokens over raw values.

Examples that already follow this pattern:
- [`src/ui/components/button/button.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/button/button.css)
- [`src/ui/components/card/card.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/card/card.css)
- [`src/ui/components/dialog/dialog.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/dialog/dialog.css)
- [`src/ui/components/table/table.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/table/table.css)

## 5. Theme Switching

Theme selection is done by setting `document.documentElement.dataset.theme` to `light` or `dark`.

The demo pages use [`src/ui/components/theme-loader.js`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/theme-loader.js) to restore the saved theme before the page paints.

## 6. Current vs Future

Current repo layout:
- `src/css/theme.css`
- `src/css/base.css`
- `src/css/main.css`
- `src/css/foundation/themes/*.css`
- `src/ui/components/index.css`

Future package extraction:
- If the styles are ever published as a package, keep the same token names and import order.
- Do not rename tokens to fit a package boundary.
- Do not introduce legacy prefixing or a second design system.

