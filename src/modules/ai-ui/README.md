# AI UI Module

## Purpose

Runtime prefab renderer for AI answers using registered, approved CSMA
components. Skills author reusable UI at build time; manifests register what the
runtime can safely compose.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `AIUIComposerService` |
| Contracts | None. |

## Runtime Integration

`AIUIComposerService` exposes:

- `getCatalog()` and `getComponent(id)` for discovery.
- `registerComponent(definition, { owner })` and `unregisterOwner(owner)` for runtime registration.
- `validateComposition(spec)` and `compose(spec, { documentRef })` for safe DOM composition.

Composition specs use registered component ids only:

```js
{
  component: 'card',
  props: { title: 'Status', description: 'Current sync state' },
  slots: {
    body: [{ component: 'badge', props: { label: 'Online', variant: 'soft-success' } }],
    footer: [{ component: 'button', props: { label: 'Refresh', variant: 'primary' } }]
  }
}
```

The renderer returns DOM nodes or `DocumentFragment`. It uses
`document.createElement`, `textContent`, explicit attributes, and catalog
metadata. It rejects raw HTML, arbitrary tags, arbitrary attributes, inline event
handlers, unregistered components, unknown props, invalid slots, disallowed
children, unsafe URLs, and oversized strings.

Core primitives are generated from `src/ui/components/*/manifest.json` into
`src/modules/ai-ui/catalog/componentCatalog.js`. Module-scoped components can be
declared in `manifest.aiUi.components`; they are registered on `MODULE_LOADED`
and removed on `MODULE_UNLOADED`.

Event-backed components such as toast can remain catalog entries, but they are
not normal DOM composition nodes unless a future safe event-action shape
explicitly represents them.

## Storage / Side Effects

No browser storage or network side effects.

## Tests

Add dedicated tests when catalog validation or composition behavior changes.
