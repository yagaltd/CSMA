# AI UI Module

## Purpose

Runtime prefab renderer for AI answers using registered, approved CSMA
components. Supports both **one-shot** composition (full spec → complete DOM)
and **streaming** composition (incremental ops → live tree mutations).

Skills author reusable UI at build time; manifests register what the
runtime can safely compose.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `AIUIComposerService` |
| Contracts | None. |

## Runtime Integration

`AIUIComposerService` exposes:

### One-shot composition (existing)

- `getCatalog()` and `getComponent(id)` for discovery.
- `registerComponent(definition, { owner })` and `unregisterOwner(owner)` for runtime registration.
- `validateComposition(spec)` and `compose(spec, { documentRef })` for safe full-tree DOM composition.

### Streaming composition (new)

- `applyOp(op, { documentRef })` — apply a single incremental mutation.
- `applyOps(ops[], { documentRef })` — apply a batch of ops with atomic pre-flight validation.
- `getLiveNode(id)` — inspect a live instance by stable ID.
- `liveSnapshot()` — serialize the current live tree for debugging.

### Op types

| Op | Purpose |
|----|---------|
| `mount` | Add a component instance (root or into a parent slot) |
| `unmount` | Remove an instance and all its children |
| `reorder` | Reorder children within a named slot |
| `clear` | Remove all children from a named slot |
| `updateProps` | Update props on an existing instance |
| `setState` | Set a `data-*` state attribute (loading, ready, error, etc.) |
| `setText` | Update text content on a component with a `textProp` |

### Streaming example

```js
// Mount into a page-level mount point (anchor in static HTML)
service.applyOp({
  type: 'mount', id: 'results',
  target: '[data-mount="ai-results"]',   // CSS selector for a mount-point anchor
  spec: { component: 'card', props: { title: 'Analyzing…' } }
}, { documentRef });

// Mount a loading card (no target — orphaned element, caller attaches manually)
service.applyOp({
  type: 'mount', id: 'results',
  spec: { component: 'card', props: { title: 'Analyzing…' } }
}, { documentRef });
service.applyOp({ type: 'setState', id: 'results', attr: 'state', value: 'loading' });

// Fill in partial results
service.applyOp({
  type: 'mount', id: 'stat-1', parent: 'results', slot: 'body',
  spec: { component: 'badge', props: { label: 'Processing…', variant: 'soft-info' } }
}, { documentRef });

// Transition to ready
service.applyOp({ type: 'setState', id: 'results', attr: 'state', value: 'ready' });
service.applyOp({ type: 'updateProps', id: 'stat-1', props: { variant: 'soft-success' } });
```

No full re-render at any step. Each op touches exactly what changed. CSS
handles visual transitions via `data-*` attributes.

### Mount points

Root-level `mount` ops can include an optional `target` — a CSS selector that
points to an empty anchor element in the page. The composed element is appended
directly to that anchor.

```html
<!-- Static HTML includes empty mount-point anchors -->
<div data-mount="ai-results"></div>
```

```js
// The composed card lands inside the anchor
service.applyOp({
  type: 'mount', id: 'results',
  target: '[data-mount="ai-results"]',
  spec: { component: 'card', props: { title: 'Live Results' } }
}, { documentRef });
```

The `data-mount` attribute is a convention. The foundation CSS hides empty
mount points (`[data-mount]:empty { display: none }`) and makes filled ones
transparent (`display: contents`). This means the anchor is invisible until
content arrives, then collapses away so the child participates directly in the
parent's layout. No re-render, no layout shift.

### Batch (atomic)

```js
service.applyOps([
  { type: 'mount', id: 'card-1', spec: { component: 'card', props: { title: 'Test' } } },
  { type: 'mount', id: 'badge-1', parent: 'card-1', slot: 'body',
    spec: { component: 'badge', props: { label: 'Done' } } },
  { type: 'setState', id: 'card-1', attr: 'state', value: 'ready' }
], { documentRef });
```

All ops are validated before any are applied. If any fails, none execute.

## Composition spec (one-shot)

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

## Security

Both `compose()` and `applyOp()` share the same security boundaries:
- `SAFE_TAGS` and `SAFE_ATTRIBUTES` whitelists
- `textContent` for all user text (never `innerHTML`)
- `isSafeUrl()` for URL attributes
- `KNOWN_STATE_ATTRS` whitelist for `setState` ops
- `MAX_TEXT_LENGTH` (1000 chars) for all string values
- Catalog-only component access (no unregistered components)

## Catalog

Core primitives are generated from `src/ui/components/*/manifest.json` into
`src/modules/ai-ui/catalog/componentCatalog.js`. Module-scoped components can be
declared in `manifest.aiUi.components`; they are registered on `MODULE_LOADED`
and removed on `MODULE_UNLOADED`.

## Storage / Side Effects

No browser storage or network side effects.

## Tests

| File | Covers |
|------|--------|
| `tests/ai-ui-composer-service.test.js` | Unit tests for compose, applyOp, applyOps, liveSnapshot |
| `tests/ai-ui-e2e-streaming.test.js` | E2E streaming scenarios, error recovery, concurrent streams |
| `tests/ai-ui-catalog-generation.test.js` | Catalog generation from manifests |
