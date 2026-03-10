# Building Modules

CSMA extensions are **modules-first**.

Use a module when you want to add:
- a feature service
- a backend or gateway adapter
- app navigation or routes
- commands or diagnostics panels
- platform-specific capabilities

Use `src/modules/example-module/` as the copy/adapt scaffold.

## Canonical Module Shape

Every module should export:

```javascript
export const manifest = {
  id: 'feature-id',
  name: 'Feature Name',
  version: '1.0.0',
  description: 'What the module does',
  dependencies: [],
  services: ['featureService'],
  contracts: ['FEATURE_EVENT'],
  contributes: {
    commands: [],
    routes: [],
    navigation: [],
    panels: [],
    adapters: []
  }
};

export const services = {
  featureService: FeatureService
};
```

Rules:
- `manifest.id` must match the module folder name
- `manifest.services` must exactly match the keys exported from `services`
- `contracts` stays the validation boundary
- `contributes` is optional and declarative

## Contribution Registries

CSMA ships five first-party registries:

- `commandRegistry`
- `routeRegistry`
- `navigationRegistry`
- `panelRegistry`
- `adapterRegistry`

Registries track:
- installed contributions
- ownership by `moduleId`
- deterministic removal on unload

Contracts still handle validation. Registries do not replace contracts.

## Contribution Shapes

### Commands

```javascript
{
  id: 'search.reindex',
  title: 'Reindex search',
  handlerService: 'search',
  handlerMethod: 'reindex',
  group: 'search',
  order: 10
}
```

### Routes

```javascript
{
  id: 'search.page',
  path: '/search',
  page: 'search-page'
}
```

### Navigation

```javascript
{
  id: 'search.nav',
  label: 'Search',
  href: '#/search',
  group: 'main',
  order: 20
}
```

### Panels

```javascript
{
  id: 'search.panel',
  title: 'Search Diagnostics',
  mount: '#search-diagnostics',
  placement: 'right',
  order: 20
}
```

### Adapters

```javascript
{
  id: 'search.gateway',
  type: 'search-backend',
  serviceName: 'search',
  capabilities: ['index', 'query']
}
```

## Lifecycle Rules

Module code is trusted, but it must still be unload-safe.

Every module-owned service must clean up:
- EventBus subscriptions
- timers and animation frames
- observers
- DOM listeners
- workers, channels, and sockets

`ModuleManager.unloadModule()` removes:
1. registry contributions
2. module services in reverse order
3. the loaded-module record

`window.csma.destroyApp()` tears down the whole runtime safely.

## Example Flow

1. Add a new folder under `src/modules/`.
2. Copy the structure from `src/modules/example-module/`.
3. Export `manifest` and `services`.
4. Define any contracts in the module contract file and aggregate them into `src/runtime/Contracts.js`.
5. If the module adds commands/routes/navigation/panels/adapters, declare them under `manifest.contributes`.
6. Enable or load the module from `src/main.js` or feature-flag flow.

## When Not To Use a Module

Do not build a plugin layer unless you actually need:
- third-party extensions
- runtime-installed add-ons
- tenant/customer extension packs

For normal CSMA app customization, modules are the correct tool.
