# CSMA UI Components Skill

Use this skill when building or restyling components in `src/ui/components/*`.

## Design System Source

- Canonical token contract: [`src/css/theme.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/theme.css)
- Light overrides: [`src/css/foundation/themes/light.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/foundation/themes/light.css)
- Dark overrides: [`src/css/foundation/themes/dark.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/foundation/themes/dark.css)

## Current Token Groups

### Colors
- `--background`, `--background-muted`
- `--surface`, `--surface-muted`
- `--foreground`, `--foreground-muted`
- `--border`, `--overlay`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--success`, `--success-foreground`
- `--warning`, `--warning-foreground`
- `--info`, `--info-foreground`

### Scale and recipe tokens
- Spacing: `--space-2xs` through `--space-5xl`
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-3xl`, `--radius-full`
- Typography: `--font-family-base`, `--font-family-mono`, `--font-size-*`, `--font-weight-*`, `--line-height-*`
- Motion: `--transition-fast`, `--transition-normal`, `--transition-slow`
- Layers: `--z-base`, `--z-overlay`, `--z-modal`, `--z-popover`, `--z-toast`
- Recipes: `--button-*`, `--input-*`, `--card-*`, `--dialog-*`, `--navbar-*`, `--table-*`

## Component Rules

1. Use semantic HTML first.
2. Use a single base class and `data-*` attributes for variants, sizes, and state.
3. Keep visual changes in CSS classes or `data-*` values.
4. Use EventBus only for Type II and Type III components.
5. Use `textContent` and safe DOM APIs for user data.
6. Keep theme-dependent values in the token contract, not in component files.

## Component Structure

Each component should live in its own folder:

```text
button/
├── button.css
├── button.js
├── button.demo.html
└── manifest.json
```

For JS-backed components:
- expose `componentDependencies`
- define `init[Name]System(eventBus)` for Type II
- define `create[Name]Service(eventBus)` for Type III services
- return a cleanup function from the initializer

## Theme Switching

Themes are switched by setting `document.documentElement.dataset.theme` to `light` or `dark`.

Demo pages should load [`src/ui/components/theme-loader.js`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/theme-loader.js) before paint so the saved theme is applied immediately.

## Current Component Entry Points

- Explorer: [`src/ui/components/index.html`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/index.html)
- CSS bundle: [`src/ui/components/index.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/index.css)
- App stylesheet entry: [`src/css/main.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/main.css)

## What To Watch For

- Do not use a `--radius` base token; use the fixed radius scale from `theme.css`.
- Do not assume every component supports arbitrary theme names.
- Do not hardcode color fallbacks when a semantic token exists.
- Do not copy old docs that reference a package-only `@csma/foundation` layout; the repo paths above are the current source of truth.

