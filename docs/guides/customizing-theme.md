# Customizing CSMA Theme

CSMA styling is token-driven. To change the look of the app, edit the theme contract first, then adjust base styles only if you need global typography or layout changes.

## What To Edit

### 1. Shared tokens
Edit [`src/css/theme.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/theme.css) for tokens that apply across both themes and all components.

This file defines:
- Typography tokens such as `--font-family-base`, `--font-size-*`, and `--line-height-*`
- Spacing tokens such as `--space-*`
- Radius tokens such as `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-3xl`, and `--radius-full`
- Shadow, motion, breakpoint, and z-index tokens
- Component recipe tokens such as `--button-*`, `--input-*`, `--card-*`, `--dialog-*`, `--table-*`, and `--navbar-*`

### 2. Theme colors
Edit [`src/css/foundation/themes/light.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/foundation/themes/light.css) and [`src/css/foundation/themes/dark.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/foundation/themes/dark.css) for color-only overrides.

These files should only set semantic color values such as:
- `--background`
- `--background-muted`
- `--surface`
- `--surface-muted`
- `--foreground`
- `--foreground-muted`
- `--border`
- `--overlay`
- `--primary` and `--primary-foreground`
- `--secondary` and `--secondary-foreground`
- `--accent` and `--accent-foreground`
- `--destructive`, `--success`, `--warning`, and `--info`

### 3. Base styles
Edit [`src/css/base.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/base.css) only for global typography, resets, and document-level defaults.

Do not put brand colors or component-specific styling here.

## Current Token Contract

The current defaults in `theme.css` are:

```css
:root {
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 0.75rem;
  --space-lg: 1rem;
  --space-xl: 1.5rem;
  --space-2xl: 2rem;
  --space-3xl: 4rem;

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.5rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-3xl: 2rem;
  --radius-full: 999px;
}
```

Use these tokens directly in component CSS. Do not introduce a separate `--radius` base token unless you also update every consumer.

## Theme Switching

CSMA switches themes by setting the `data-theme` attribute on `<html>`.

```js
document.documentElement.dataset.theme = 'dark';
document.documentElement.dataset.theme = 'light';
```

The demo pages also load [`src/ui/components/theme-loader.js`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/theme-loader.js) so the saved theme applies before paint.

## Practical Customization Order

1. Change light and dark color values in the theme partials.
2. Adjust shared scale tokens in `theme.css` if you want a new spacing or radius system.
3. Update `base.css` if your new brand needs different typography or document defaults.
4. Review the component explorer at [`src/ui/components/index.html`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/index.html) to confirm the new look is applied everywhere.

## What Not To Do

- Do not hardcode color values inside component CSS unless the component is explicitly a special-case illustration.
- Do not define theme values inside component files when the value belongs in the contract.
- Do not use unsupported theme names like `zinc`; use `light` and `dark`.

## Verification

After editing the theme:

1. Open the component explorer.
2. Toggle between light and dark.
3. Confirm buttons, cards, dialogs, tables, and overlays all respond without component-specific overrides.

