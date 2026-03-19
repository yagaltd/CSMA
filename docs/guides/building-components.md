# Building CSMA Components

CSMA components are intentionally small. They either render static UI, manage simple interactions through the EventBus, or delegate business logic to a service.

## 1. Component Types

| Type | Pattern | Use when | Example |
|---|---|---|---|
| I | Pure CSS | The component is visual only | Badge, Card, Avatar |
| II | `init[Name]System(eventBus)` | The component handles its own interaction state | Dialog, Toast, Tabs, Dropdown |
| III | `create[Name]Service()` + UI init | The component needs business logic, validation, or data coordination | Slider, Table, File Upload |

There is no separate module component type. Whole-feature work belongs in `src/modules/*`.

## 2. Core Rules

1. Use semantic HTML first.
2. Use `data-*` attributes for variants, sizes, and state.
3. Keep state changes in CSS classes or `data-*` only.
4. Publish intents through the EventBus.
5. Validate payloads before publishing or consuming them.
6. Do not use `window.csma.componentCleanup`; return cleanup functions from component init functions and let `src/ui/init.js` collect them.

## 3. Build Flow

### Type I
1. Create `src/ui/components/<name>/<name>.css`.
2. Use tokens from [`src/css/theme.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/theme.css).
3. Create `*.demo.html`.
4. Register the component in `src/ui/components/component-registry.js` if you want it to appear in the explorer.

### Type II
1. Create `src/ui/components/<name>/<name>.js`.
2. Export `init<Name>System(eventBus)`.
3. Query matching elements and attach listeners.
4. Subscribe to your own `INTENT_*` events.
5. Return a cleanup function.
6. Register the init function in [`src/ui/init.js`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/init.js).

### Type III
1. Create a service in `src/services/<Name>Service.js`.
2. Export `create<Name>Service(eventBus)`.
3. Put business logic, validation, and shared state in the service.
4. Keep the UI file focused on rendering and DOM wiring.
5. Register the service in `src/ui/init.js` through `window.serviceManager` when available.

## 4. Recommended File Layout

```text
src/ui/components/button/
├── button.css
├── button.js
├── button.demo.html
└── manifest.json
```

For JS-backed components, treat `componentDependencies` as the source of truth for:
- required runtime objects
- service dependencies
- shared helper files
- stylesheet entry points
- integration notes

## 5. Minimal Type II Example

```js
export function initToastSystem(eventBus) {
  if (!eventBus) return () => {};

  const unsubscribe = eventBus.subscribe('INTENT_TOAST_SHOW', (payload) => {
    // render safely with textContent and CSS state
  });

  return () => unsubscribe();
}
```

## 6. Minimal Type III Example

```js
export function createSliderService(eventBus) {
  return {
    cleanup() {
      // unsubscribe and release state
    }
  };
}
```

In [`src/ui/init.js`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/init.js), create the service first, register it if `window.serviceManager` exists, then initialize the UI wrapper and store the returned cleanup function.

## 7. Demo Pages

Every interactive component should have a standalone `*.demo.html` page that:
- loads [`src/ui/components/theme-loader.js`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/ui/components/theme-loader.js)
- imports [`src/css/main.css`](/home/aurel/Documents/github/CSMA-SSMA/CSMA/src/css/main.css)
- initializes an `EventBus` when the component needs one
- uses safe DOM APIs such as `textContent` instead of `innerHTML`

## 8. What To Avoid

- Do not introduce a fourth component category for whole applications.
- Do not hide business logic in component DOM handlers when a service is the right owner.
- Do not hardcode colors, spacing, or radius values when a token already exists.
- Do not rely on legacy patterns that mutate inline styles for state.

## 9. Practical Checklist

Before merging a component:
- The CSS works with both `light` and `dark` themes.
- The component has a demo page.
- The registry entry points to the demo.
- JS-backed components expose `componentDependencies`.
- `src/ui/init.js` initializes and cleans up the component.
- Any event payload used by the component has a matching contract in `src/runtime/Contracts.js`.

