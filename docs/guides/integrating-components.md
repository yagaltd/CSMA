# Integrating CSMA Components Into Another App

Use this guide when you want to copy a CSMA component into an existing app instead of running the full template.

## 1. Copy The Foundation CSS

Start with these files:
- [`src/css/theme.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/theme.css)
- [`src/css/foundation/themes/light.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/foundation/themes/light.css)
- [`src/css/foundation/themes/dark.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/foundation/themes/dark.css)
- [`src/css/base.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/base.css)

If you want the full template styling, also copy [`src/css/main.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/main.css). If you only want atomic components, copy [`src/ui/components/index.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/index.css) and omit the patterns bundle.

## 2. Copy The Component Folder

Copy the component directory under `src/ui/components/<name>/`.

- Type I components need only CSS and markup.
- Type II components need the component JS file plus an EventBus.
- Type III components also need any paired service from `src/services/`.

## 3. Use `componentDependencies`

For JS-backed components, check the exported `componentDependencies` object in the component file.

Treat it as the source of truth for:
- runtime requirements
- service requirements
- shared helper files
- required stylesheets
- integration notes

If the component also has a `manifest.json`, treat it as supplemental metadata, not the primary dependency contract.

## 4. Initialize The Component

### Type I
Render the HTML and load the CSS. No runtime setup is needed.

### Type II
Create or reuse an `EventBus`, then call the exported `init[Name]System(eventBus)` function.

### Type III
Create the service first, register it if your app has a service registry, then initialize the UI wrapper with the same `EventBus`.

## 5. Theme Switching

Set the theme by updating:

```js
document.documentElement.dataset.theme = 'light';
document.documentElement.dataset.theme = 'dark';
```

If you have a saved preference, load it before first paint. CSMA uses [`src/ui/components/theme-loader.js`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/theme-loader.js) for that behavior in demos.

## 6. Recommended Integration Order

1. Copy the foundation CSS.
2. Copy the component folder.
3. Copy any declared helper or service dependency from `componentDependencies`.
4. Initialize Type II and Type III components with an `EventBus`.
5. Verify keyboard behavior, focus states, and theme switching in the host app.

## 7. Notes For Existing Apps

- Keep the component CSS token-driven.
- Do not depend on the CSMA explorer or registry runtime unless you are copying those pieces too.
- If you only need one component, you do not need to bring over the whole template.

