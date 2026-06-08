# AI UI Module Refactor — Streaming Composition via Ops

> Add incremental, op-based composition to `src/modules/ai-ui/` while keeping
> the existing `compose()` API intact. Inspired by remdom's typed mutation ops,
> adapted to CSMA's component catalog and `data-*` state model.

**Status:** Plan · **Target:** `src/modules/ai-ui/services/AIUIComposerService.js` + tests · **Non-breaking:** existing `compose()` unchanged

---

## Table of Contents

1. [Current architecture and its limits](#1-current-architecture-and-its-limits)
2. [What changes and why](#2-what-changes-and-why)
3. [Op protocol — detailed spec](#3-op-protocol--detailed-spec)
4. [New internal state — live node registry](#4-new-internal-state--live-node-registry)
5. [applyOp — implementation contract](#5-applyop--implementation-contract)
6. [Compatibility with existing compose()](#6-compatibility-with-existing-compose)
7. [Security model — op validation](#7-security-model--op-validation)
8. [Catalog changes — what components need](#8-catalog-changes--what-components-need)
9. [Testing strategy](#9-testing-strategy)
10. [E2E streaming scenario — full walkthrough](#10-e2e-streaming-scenario--full-walkthrough)
11. [Implementation order](#11-implementation-order)
12. [File change inventory](#12-file-change-inventory)

---

## 1. Current architecture and its limits

### Current state

```javascript
// AIUIComposerService has ONE composition method:
compose(spec, { documentRef }) → Node
```

It takes a complete JSON spec and renders the entire tree from scratch.
Working well for one-shot rendering. Not designed for:

| Gap | Example | Impact |
|-----|---------|--------|
| **No incremental updates** | Show loading skeleton → fill in results | Must destroy and re-render entire tree. Lose scroll position, focus, transient CSS state. |
| **No state transitions** | Change `data-state` from `"loading"` to `"ready"` | CSMA's entire reactivity model (CSS handles visuals via `data-*` attributes) is unavailable during AI composition. |
| **No instance identity** | Update badge variant from `"soft-info"` to `"soft-success"` | No way to target a specific composed node — everything is anonymous after render. |
| **No streaming** | AI generates response token by token | Cannot stream UI partials; must wait for complete spec. |
| **No lifecycle** | Component enters/leaves view | No mount/unmount tracking, no cleanup hooks. |

### Root cause

After `compose()` returns DOM nodes, the service forgets them. No registry, no
IDs, no mutation API. The result is anonymous DOM that can only be destroyed and
replaced.

---

## 2. What changes and why

### Addition, not rewrite

The existing `compose()` method stays. It's the right API for one-shot rendering
(pre-built specs, static UI). The refactor adds a parallel system:

| Method | When to use |
|--------|-------------|
| `compose(spec)` | Existing — one-shot full render. **Unchanged.** |
| `applyOp(op)` | **New** — incremental mutation on the live tree. |
| `applyOps(ops[])` | **New** — batch multiple ops in one call (atomic validation). |
| `liveSnapshot()` | **New** — return the current live tree for inspection/debugging. |
| `getLiveNode(id)` | **New** — inspect a specific instance. |

### Core new concepts

| Concept | What it is | Like remdom's... |
|---------|-----------|-----------------|
| **Stable instance ID** | Every composed node gets a `data-aiui-id` attribute | `data-rdid` |
| **Live node registry** | `Map<string, LiveNode>` tracking all active instances | `Map<string, Node>` |
| **Composition ops** | Typed JSON ops (mount, unmount, updateProps, setState, etc.) | mutation ops |
| **Slot-aware tracking** | Children organized by registered slot name | N/A — remdom is generic DOM |

### What stays the same

- Component catalog (`componentCatalog.js`, `manifest.json` files)
- `manifest.aiUi` schema (propsSchema, slots, render, allowedChildren)
- Security boundaries (SAFE_TAGS, SAFE_ATTRIBUTES, URL validation, textContent)
- `normalizeSpec()`, `normalizeProps()`, `normalizeSlots()` — validation logic unchanged
- `registerComponent()`, `registerModuleComponents()`, `unregisterOwner()`
- EventBus subscriptions (`MODULE_LOADED`, `MODULE_UNLOADED`)

---

## 3. Op protocol — detailed spec

### 3.1 Op types

```typescript
type CompositionOp =
  // Tree mutation — add/remove/reorder component instances
  | MountOp
  | UnmountOp
  | ReorderOp
  | ClearSlotOp

  // State mutation — update attributes on existing instances
  | UpdatePropsOp
  | SetStateOp
  | SetTextOp
```

### 3.2 MountOp

```typescript
{
  type: 'mount',
  id: string,                // stable instance ID, client-assigned

  // Where to attach (omit for root)
  parent?: string,           // parent instance ID
  slot?: string,             // named slot on the parent

  // What to render (same spec shape as compose())
  spec: {
    component: string,        // catalog component id
    props?: Record<string, string>,
    slots?: Record<string, CompositionSpec[]>
  }
}
```

**Rules:**
- `id` must be globally unique within the service instance — duplicate `id` is an error
- `component` must exist in the catalog — same validation as `normalizeSpec()`
- When `parent` is provided: `parent` must exist in `liveNodes`, and `slot` must be a valid slot on the parent's definition
- `spec` is validated through the same `normalizeSpec()` pipeline — props schema, slots, allowed children, depth limits, URL safety
- Returns the rendered `LiveNode`

**DOM effect:**
- If root: appends to the document fragment or container provided at construction
- If parent + slot: appends to the slot's container element inside the parent
- The created element gets `data-aiui-id="<id>"` for tracking

### 3.3 UnmountOp

```typescript
{
  type: 'unmount',
  id: string                 // instance ID to remove
}
```

**Rules:**
- `id` must exist in `liveNodes` — unknown id is an error
- Recursively unmounts all children (verified children of the node's slots)
- Removes the element from the DOM
- Removes the node and all descendants from `liveNodes`

**DOM effect:**
- Element is removed from its parent
- All child instances (recursive) are also removed and unregistered

### 3.4 ReorderOp

```typescript
{
  type: 'reorder',
  parent: string,            // parent instance ID
  slot: string,              // named slot to reorder
  order: string[]            // desired order of child instance IDs
}
```

**Rules:**
- `parent` must exist in `liveNodes`
- `slot` must be a valid slot on the parent's definition
- Every id in `order` must be a current child of `parent.slot`
- `order` must contain every current child of `parent.slot` (no drops)
- Uses `.appendChild()` to reorder in place — DOM reorders without detaching/recreating

**DOM effect:**
- Children of the slot container are reordered to match `order`
- Elements are moved, not destroyed and recreated

### 3.5 ClearSlotOp

```typescript
{
  type: 'clear',
  parent: string,            // parent instance ID
  slot: string               // named slot to clear
}
```

**Rules:**
- `parent` must exist in `liveNodes`
- `slot` must be a valid slot on the parent's definition
- Unmounts every child of that slot recursively
- Removes all child entries from `liveNodes`

**DOM effect:**
- All children of the slot container are removed from DOM and destroyed

### 3.6 UpdatePropsOp

```typescript
{
  type: 'updateProps',
  id: string,                 // instance ID
  props: Record<string, string>  // props to update
}
```

**Rules:**
- `id` must exist in `liveNodes`
- Every key in `props` must exist in the component's `propsSchema` — unknown prop is an error
- Every value is validated: max length, URL safety for URL-patterned keys
- The prop change is applied through the same `applyAttributes()` logic as `compose()` — reads the component's `render.attributes` mapping, updates each corresponding `data-*` attribute
- Internal `liveNode.props` is updated to reflect the new values

**DOM effect:**
- The element's attributes are updated per the render mapping
- Example: updating `variant` on a badge changes `data-variant` attribute
- No DOM nodes are created or destroyed

### 3.7 SetStateOp

```typescript
{
  type: 'setState',
  id: string,                 // instance ID
  attr: string,               // attribute name (without "data-" prefix)
  value: string               // new value
}
```

**CSMA-specific.** This is the op that maps to CSMA's CSS-driven reactivity
model — state changes via `data-*` attributes, CSS handles the visual rendering.

**Rules:**
- `id` must exist in `liveNodes`
- `attr` is a valid CSMA state attribute (one of the known `data-*` attributes):
  - `data-state` — component lifecycle state (loading, ready, error, success, empty)
  - `data-variant` — visual variant (primary, secondary, ghost, etc.)
  - `data-tone` — tone/emphasis (brand, neutral, muted, etc.)
  - `data-size` — size modifier (sm, md, lg)
  - `data-shape` — shape modifier (rounded, square, pill)
  - `data-disabled` — disabled state
  - `data-theme-active` — active theme
- Unknown `attr` is an error — prevents arbitrary attribute injection
- `value` max length enforced
- No HTML injection risk — `setAttribute()` on known safe names

**DOM effect:**
- `element.setAttribute('data-' + attr, value)` — single attribute change
- CSMA's CSS selectors (`[data-state="loading"]`, etc.) handle the visual change
- No DOM tree mutation

### 3.8 SetTextOp

```typescript
{
  type: 'setText',
  id: string,                 // instance ID
  text: string                // new text content
}
```

**Rules:**
- `id` must exist in `liveNodes`
- The component must have a `render.textProp` defined in its manifest — otherwise the op is rejected (component doesn't support text updates)
- `text` is set via `element.textContent` — safe, no HTML interpretation
- Max length enforced

**DOM effect:**
- `element.textContent = text` — single text node update
- No HTML parsing, no XSS vector

### 3.9 Batch: applyOps

```typescript
applyOps(ops: CompositionOp[], { documentRef } = {}): void
```

Applies an array of ops in sequence. All ops are validated **before** any are
applied (see Section 7). If any op fails validation, none are applied.

**Rules:**
- Validates every op in the array first (pre-flight pass)
- If all pass, applies in array order
- If any fails, throws with the index and error — zero ops applied
- Each op's ID uniqueness is checked across the entire batch (no duplicate `mount` IDs within a batch)

---

## 4. New internal state — live node registry

### 4.1 LiveNode structure

```typescript
interface LiveNode {
  id: string                    // stable instance ID
  definition: CatalogEntry      // component catalog entry (immutable reference)
  element: HTMLElement          // the rendered DOM element (root)
  props: Record<string, string> // current resolved prop values
  parentId: string | null       // parent instance ID, or null if root
  slot: string | null           // slot name this node occupies, or null if root
  children: Map<string, LiveNode[]>  // slot name → array of child LiveNodes
}
```

### 4.2 Registry

```typescript
// New private field on AIUIComposerService
this.liveNodes = new Map<string, LiveNode>()
```

### 4.3 data-aiui-id attribute

Every element created via `applyOp` gets a `data-aiui-id` attribute set to its
instance ID. This enables:

- DOM inspection for debugging (`document.querySelector('[data-aiui-id="..."]')`)
- Re-targeting elements after reordering (DOM moves don't destroy the element)
- Integration with browser dev tools

The attribute is set via `element.setAttribute('data-aiui-id', id)` — allowed
because `data-aiui-id` is a valid `data-*` attribute and has no security
implications.

### 4.4 Slot container tracking

When a component has named slots (e.g., `card` has `body` and `footer`), the
render metadata defines which children elements are the slot containers (via
`slots[slotName].selector`). The live node registry uses this to know which
child element to append `mount` targets to or reorder within.

During `mount`:
1. Find the slot container element inside the parent's element tree
2. Append the new child element to it
3. Record the child in `liveNode.children.get(slotName)`

During `reorder`:
1. Find the slot container element
2. Use `.appendChild()` to move each child (in order) within the container
3. Update the order in `liveNode.children.get(slotName)`

### 4.5 Cleanup cascade

When `unmount` is called for a node, all its slot children must be recursively
unmounted first. The structure:

```javascript
_unmountRecursive(id) {
  const node = this.liveNodes.get(id)
  if (!node) return

  // Unmount all children first (depth-first)
  for (const [, children] of node.children) {
    for (const child of [...children]) {    // copy array since we're mutating
      this._unmountRecursive(child.id)
    }
  }

  // Remove element from DOM
  node.element.remove()

  // Remove from parent's children mapping
  if (node.parentId) {
    const parent = this.liveNodes.get(node.parentId)
    if (parent) {
      const slotChildren = parent.children.get(node.slot)
      if (slotChildren) {
        const idx = slotChildren.findIndex(c => c.id === id)
        if (idx !== -1) slotChildren.splice(idx, 1)
      }
    }
  }

  // Remove from registry
  this.liveNodes.delete(id)
}
```

### 4.6 liveSnapshot()

```javascript
liveSnapshot() {
  return [...this.liveNodes.entries()].map(([id, node]) => ({
    id: node.id,
    component: node.definition.id,
    props: { ...node.props },
    parentId: node.parentId,
    slot: node.slot,
    children: [...node.children.entries()].map(([slot, children]) => ({
      slot,
      children: children.map(c => c.id)
    }))
  }))
}
```

Used for debugging, testing, and serialization of the current live composition.

---

## 5. applyOp — implementation contract

### 5.1 Method signature

```javascript
applyOp(op, { documentRef = globalThis.document } = {}) {
  // 1. Validate the op (throws on invalid)
  // 2. Apply the op (mutates liveNodes + DOM)
  // 3. Return the affected LiveNode(s) or void
}
```

### 5.2 Op dispatch

```javascript
applyOp(op, { documentRef = globalThis.document } = {}) {
  this._validateOp(op)   // throws on invalid — no DOM mutations yet

  switch (op.type) {
    case 'mount':
      return this._applyMount(op, { documentRef })
    case 'unmount':
      return this._applyUnmount(op)
    case 'reorder':
      return this._applyReorder(op)
    case 'clear':
      return this._applyClear(op)
    case 'updateProps':
      return this._applyUpdateProps(op)
    case 'setState':
      return this._applySetState(op)
    case 'setText':
      return this._applySetText(op)
    default:
      throw new Error(`Unknown op type "${op.type}"`)
  }
}
```

### 5.3 _applyMount

```javascript
_applyMount(op, { documentRef }) {
  // 1. Validate spec through normalizeSpec() (reuses existing validation)
  const normalized = this.normalizeSpec(op.spec)

  // 2. Render the component tree (reuses existing renderNode)
  const element = this.renderNode(normalized, { documentRef, depth: 0, parent: null })

  // 3. Tag the element with the instance ID
  element.setAttribute('data-aiui-id', op.id)

  // 4. Create LiveNode entry
  const liveNode = {
    id: op.id,
    definition: this.catalog.get(op.spec.component),
    element,
    props: { ...(op.spec.props || {}) },
    parentId: op.parent || null,
    slot: op.slot || null,
    children: new Map()
  }

  // 5. If parent + slot, attach to parent's slot container
  if (op.parent && op.slot) {
    const parentNode = this.liveNodes.get(op.parent)
    if (!parentNode) throw new Error(`Parent "${op.parent}" not found`)

    const slotContainer = parentNode.element.querySelector(
      parentNode.definition.slots[op.slot]?.selector || ':root'
    )
    if (!slotContainer) throw new Error(`Slot container for "${op.slot}" not found`)

    slotContainer.append(element)

    // Track in parent's children map
    if (!parentNode.children.has(op.slot)) {
      parentNode.children.set(op.slot, [])
    }
    parentNode.children.get(op.slot).push(liveNode)
  }

  // 6. Recursively tag all descendant elements with their IDs
  this._tagDescendants(element, normalized)

  // 7. Store in registry
  this.liveNodes.set(op.id, liveNode)

  return liveNode
}
```

Note: Step 6 (`_tagDescendants`) requires the spec to carry optional `id` hints
for nested components. See Section 8 on catalog changes.

### 5.4 _applyUnmount

```javascript
_applyUnmount(op) {
  const node = this.liveNodes.get(op.id)
  if (!node) throw new Error(`Instance "${op.id}" not found`)
  this._unmountRecursive(op.id)
}
```

Uses the recursive unmount from Section 4.5.

### 5.5 _applyUpdateProps

```javascript
_applyUpdateProps(op) {
  const node = this.liveNodes.get(op.id)
  if (!node) throw new Error(`Instance "${op.id}" not found`)

  const definition = node.definition

  // Validate each prop against the schema
  const allowedProps = new Set(Object.keys(definition.propsSchema || {}))
  for (const key of Object.keys(op.props)) {
    if (!allowedProps.has(key)) {
      throw new Error(`Unknown prop "${key}" for "${definition.id}"`)
    }
    // Validate value (reuse existing validation)
    const value = op.props[key]
    if (typeof value !== 'string') throw new Error(`Prop "${key}" must be a string`)
    if (value.length > MAX_TEXT_LENGTH) throw new Error(`Prop "${key}" exceeds max length`)
    if (/(url|href|src)$/i.test(key) && !this.isSafeUrl(value)) {
      throw new Error(`Unsafe URL rejected for prop "${key}"`)
    }
  }

  // Apply attribute changes through the render mapping (reuses applyAttributes)
  this.applyAttributes(node.element, definition.render.attributes || {}, op.props)

  // Update internal prop state
  Object.assign(node.props, op.props)
}
```

### 5.6 _applySetState

```javascript
const KNOWN_STATE_ATTRS = new Set([
  'data-state', 'data-variant', 'data-tone',
  'data-size', 'data-shape', 'data-disabled',
  'data-theme-active'
])

_applySetState(op) {
  const node = this.liveNodes.get(op.id)
  if (!node) throw new Error(`Instance "${op.id}" not found`)

  const attrName = `data-${op.attr}`
  if (!KNOWN_STATE_ATTRS.has(attrName)) {
    throw new Error(`Unknown state attribute "${attrName}"`)
  }

  if (typeof op.value !== 'string') throw new Error('State value must be a string')
  if (op.value.length > MAX_TEXT_LENGTH) throw new Error('State value exceeds max length')

  node.element.setAttribute(attrName, op.value)
}
```

### 5.7 _applySetText

```javascript
_applySetText(op) {
  const node = this.liveNodes.get(op.id)
  if (!node) throw new Error(`Instance "${op.id}" not found`)

  if (!node.definition.render.textProp) {
    throw new Error(`Component "${node.definition.id}" does not support text updates`)
  }

  if (typeof op.text !== 'string') throw new Error('Text must be a string')
  if (op.text.length > MAX_TEXT_LENGTH) throw new Error('Text exceeds max length')

  node.element.textContent = op.text
  node.props[node.definition.render.textProp] = op.text
}
```

### 5.8 _applyReorder

```javascript
_applyReorder(op) {
  const parentNode = this.liveNodes.get(op.parent)
  if (!parentNode) throw new Error(`Parent "${op.parent}" not found`)

  const slotDef = parentNode.definition.slots[op.slot]
  if (!slotDef) throw new Error(`Unknown slot "${op.slot}" on "${parentNode.definition.id}"`)

  const slotChildren = parentNode.children.get(op.slot)
  if (!slotChildren) throw new Error(`No children in slot "${op.slot}"`)

  // Validate all IDs exist and match
  const currentIds = new Set(slotChildren.map(c => c.id))
  if (op.order.length !== slotChildren.length) {
    throw new Error('Reorder order length must match current children count')
  }
  for (const id of op.order) {
    if (!currentIds.has(id)) throw new Error(`Child "${id}" not found in slot "${op.slot}"`)
  }

  // Reorder DOM by appending in desired order (moves elements in place)
  const slotContainer = parentNode.element.querySelector(slotDef.selector || ':root')
  for (const id of op.order) {
    const childNode = slotChildren.find(c => c.id === id)
    slotContainer.append(childNode.element)  // DOM .appendChild() moves existing nodes
  }

  // Reorder registry
  slotChildren.sort((a, b) => op.order.indexOf(a.id) - op.order.indexOf(b.id))
}
```

### 5.9 _applyClear

```javascript
_applyClear(op) {
  const parentNode = this.liveNodes.get(op.parent)
  if (!parentNode) throw new Error(`Parent "${op.parent}" not found`)

  const slotDef = parentNode.definition.slots[op.slot]
  if (!slotDef) throw new Error(`Unknown slot "${op.slot}" on "${parentNode.definition.id}"`)

  const slotChildren = parentNode.children.get(op.slot) || []
  for (const child of [...slotChildren]) {
    this._unmountRecursive(child.id)    // depth-first cleanup
  }
}
```

---

## 6. Compatibility with existing compose()

### 6.1 compose() stays identical

The existing `compose()` method is not modified. It continues to:

1. Take a JSON spec
2. Validate through `normalizeSpec()`
3. Render full tree via `renderNode()`
4. Return DOM nodes

The new `applyOp()` system runs alongside it. They share the catalog, the
validation functions, and the render logic, but `compose()` does NOT register
instances in `liveNodes`.

### 6.2 Optional: promoting compose() results to live nodes

A future enhancement could add an optional second argument to `compose()` to
also register the result in the live node registry:

```javascript
// Current — returns anonymous DOM
compose(spec, { documentRef })

// Future — returns anonymous DOM but also registers for later updates
compose(spec, { documentRef, trackAs: { id: 'results-1' } })
```

This is **not in scope** for this refactor. Start with `applyOp()` only.

### 6.3 Cleanup integration

`cleanup()` currently removes EventBus subscriptions and unregisters module
components. It should additionally clear the live node registry:

```javascript
cleanup() {
  // Clear all live nodes (removes elements from DOM)
  this._clearAllLiveNodes()

  // Existing cleanup
  this.cleanups.splice(0).reverse().forEach((cleanup) => cleanup?.())
  this.unregisterOwner('runtime')
}

_clearAllLiveNodes() {
  // Get all root node IDs (no parent)
  const rootIds = [...this.liveNodes.values()]
    .filter(n => !n.parentId)
    .map(n => n.id)

  // Unmount recursively from roots
  for (const id of rootIds) {
    this._unmountRecursive(id)
  }
}
```

---

## 7. Security model — op validation

### 7.1 Pre-flight validation for applyOps()

When `applyOps(ops)` is called with multiple ops, ALL ops are validated before
ANY are applied:

```javascript
applyOps(ops, { documentRef } = {}) {
  // Phase 1 — Pre-flight validation (no DOM mutations)
  const mountedIds = new Set()     // IDs being mounted in this batch
  for (let i = 0; i < ops.length; i++) {
    this._validateOpDry(ops[i], i, mountedIds)
  }

  // Phase 2 — Apply (all passed, now safe to mutate)
  for (const op of ops) {
    this.applyOp(op, { documentRef })
  }
}
```

### 7.2 Per-op validation rules

| Op type | What is validated |
|---------|-------------------|
| `mount` | `id` is non-empty string, unique (not in liveNodes, not in batch). `component` exists in catalog. `spec` passes through `normalizeSpec()`. If `parent` provided: exists in liveNodes. `slot` is valid on parent. |
| `unmount` | `id` exists in liveNodes |
| `reorder` | `parent` exists, `slot` is valid, every ID in `order` is a child of `parent.slot`, `order` contains every child |
| `clear` | `parent` exists, `slot` is valid |
| `updateProps` | `id` exists, every key in `props` exists in component's `propsSchema`, values are safe strings, URL props pass URL validation |
| `setState` | `id` exists, `attr` is in KNOWN_STATE_ATTRS, `value` is safe string |
| `setText` | `id` exists, component supports text updates (`render.textProp` exists), `text` is safe string |

### 7.3 What is NOT allowed

| Attack vector | Blocked by |
|---------------|-----------|
| Mount an unregistered component | `normalizeSpec()` throws `"Unknown component"` |
| Set an unknown prop | `normalizeProps()` throws `"Unknown prop"` |
| Inject HTML via text | `textContent` always used, never `innerHTML` |
| Inject event handlers | `SAFE_ATTRIBUTES` set rejects `on*` attributes |
| Unsafe URLs | `isSafeUrl()` rejects `javascript:`, `data:`, etc. |
| Overflow text buffers | `MAX_TEXT_LENGTH` (1000 chars) enforced |
| Set arbitrary data-* attributes | `KNOWN_STATE_ATTRS` set limits which can be set |
| Mount at invalid slot | `normalizeSlots()` checks slot exists and child is allowed |

---

## 8. Catalog changes — what components need

### 8.1 Existing manifest.json is sufficient

The current `manifest.json` structure already has everything needed:
- `propsSchema` — for `updateProps` validation
- `slots` — for slot-aware mounting and reordering
- `render` — for attribute mapping and text prop identification
- `allowedChildren` — for child validation

**No manifest.json changes required.**

### 8.2 Optional: id hint for nested sub-trees

When `mount` is called with a spec that has nested children (slots with more
components inside), those nested components also need stable IDs for future
updates. Two approaches:

**Approach A (recommended for initial implementation):** The spec can carry
optional `id` hints for nested nodes:

```javascript
{
  type: 'mount',
  id: 'card-1',
  spec: {
    component: 'card',
    props: { title: 'Status' },
    slots: {
      body: [{
        id: 'badge-1',  // optional — allows targeting this nested node later
        component: 'badge',
        props: { label: 'Online', variant: 'soft-success' }
      }]
    }
  }
}
```

When `id` is present on a nested spec node, it gets registered in `liveNodes`
and tagged with `data-aiui-id`. When absent, the component renders but is
anonymous (cannot be targeted by later ops).

**Approach B (simpler):** Auto-assign IDs to every nested node. Not recommended
— the AI response may not need to update every node, and auto-IDs add noise.

**Decision for initial implementation:** Start with optional `id` (Approach A).
The `normalizeSpec()` method needs a minimal change to pass `id` through:

```javascript
// In normalizeSpec(): preserve optional id field
normalizeSpec(spec, ...) {
  // ... existing validation ...
  return {
    id: spec.id,          // optional — pass through if present
    component: id,
    props,
    slots
  }
}
```

### 8.3 No breaking changes

Catalog entries are unaffected. The `applyOp` system only reads existing
manifest fields. No component author needs to update their manifest.

---

## 9. Testing strategy

### 9.1 Test file changes

| File | Action |
|------|--------|
| `tests/ai-ui-composer-service.test.js` | Add tests for `applyOp`, `applyOps`, `liveSnapshot`, `getLiveNode` |
| `tests/ai-ui-e2e-streaming.test.js` | **New** — end-to-end streaming scenario |

### 9.2 Unit tests (in existing test file)

#### applyOp — mount

```javascript
describe('applyOp — mount', () => {
  it('mounts a root component with text', () => {
    const service = createService()
    const result = service.applyOp({
      type: 'mount',
      id: 'badge-1',
      spec: { component: 'badge', props: { label: 'Hello' } }
    }, { documentRef: document })

    expect(result.id).toBe('badge-1')
    expect(result.element.getAttribute('data-aiui-id')).toBe('badge-1')
    expect(result.element.textContent).toBe('Hello')
    expect(result.parentId).toBeNull()
  })

  it('mounts a component into a parent slot', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Test' } }
    }, { documentRef: document })

    service.applyOp({
      type: 'mount', id: 'badge-1',
      parent: 'card-1', slot: 'body',
      spec: { component: 'badge', props: { label: 'Inside' } }
    }, { documentRef: document })

    const badge = service.getLiveNode('badge-1')
    expect(badge.parentId).toBe('card-1')
    expect(badge.slot).toBe('body')
    expect(badge.element.closest('.card__body')).toBeTruthy()
  })

  it('rejects duplicate mount id', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'badge-1',
      spec: { component: 'badge', props: { label: 'First' } }
    }, { documentRef: document })

    expect(() => service.applyOp({
      type: 'mount', id: 'badge-1',
      spec: { component: 'badge', props: { label: 'Second' } }
    }, { documentRef: document })).toThrow(/already exists/)
  })

  it('rejects mount with unknown component', () => {
    const service = createService()
    expect(() => service.applyOp({
      type: 'mount', id: 'x-1',
      spec: { component: 'does-not-exist' }
    }, { documentRef: document })).toThrow(/Unknown/)
  })

  it('rejects mount at invalid slot', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Test' } }
    }, { documentRef: document })

    expect(() => service.applyOp({
      type: 'mount', id: 'badge-1',
      parent: 'card-1', slot: 'nonexistent',
      spec: { component: 'badge', props: { label: 'X' } }
    }, { documentRef: document })).toThrow(/Unknown slot/)
  })
})
```

#### applyOp — unmount

```javascript
describe('applyOp — unmount', () => {
  it('unmounts a root component and removes from registry', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'badge-1',
      spec: { component: 'badge', props: { label: 'Hello' } }
    }, { documentRef: document })

    expect(service.getLiveNode('badge-1')).toBeTruthy()
    expect(document.body.contains(
      service.getLiveNode('badge-1').element
    )).toBe(true)

    service.applyOp({ type: 'unmount', id: 'badge-1' })

    expect(service.getLiveNode('badge-1')).toBeNull()
  })

  it('cascades unmount to children', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Parent' } }
    }, { documentRef: document })

    service.applyOp({
      type: 'mount', id: 'badge-1',
      parent: 'card-1', slot: 'body',
      spec: { component: 'badge', props: { label: 'Child' } }
    }, { documentRef: document })

    service.applyOp({ type: 'unmount', id: 'card-1' })

    expect(service.getLiveNode('card-1')).toBeNull()
    expect(service.getLiveNode('badge-1')).toBeNull()
  })

  it('rejects unmount of unknown id', () => {
    const service = createService()
    expect(() => service.applyOp({
      type: 'unmount', id: 'does-not-exist'
    })).toThrow(/not found/)
  })
})
```

#### applyOp — updateProps

```javascript
describe('applyOp — updateProps', () => {
  it('updates data-variant on a badge', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'badge-1',
      spec: { component: 'badge', props: { label: 'Status', variant: 'soft-info' } }
    }, { documentRef: document })

    service.applyOp({
      type: 'updateProps', id: 'badge-1',
      props: { variant: 'soft-success' }
    })

    const el = service.getLiveNode('badge-1').element
    expect(el.getAttribute('data-variant')).toBe('soft-success')
  })

  it('rejects update with unknown prop', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'badge-1',
      spec: { component: 'badge', props: { label: 'Test' } }
    }, { documentRef: document })

    expect(() => service.applyOp({
      type: 'updateProps', id: 'badge-1',
      props: { nonexistent: 'value' }
    })).toThrow(/Unknown prop/)
  })
})
```

#### applyOp — setState

```javascript
describe('applyOp — setState', () => {
  it('sets data-state on a card', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Loading' } }
    }, { documentRef: document })

    service.applyOp({
      type: 'setState', id: 'card-1', attr: 'state', value: 'loading'
    })

    const el = service.getLiveNode('card-1').element
    expect(el.getAttribute('data-state')).toBe('loading')
  })

  it('rejects unknown state attribute', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Test' } }
    }, { documentRef: document })

    expect(() => service.applyOp({
      type: 'setState', id: 'card-1', attr: 'random', value: 'x'
    })).toThrow(/Unknown state attribute/)
  })

  it('transitions through loading → ready → error', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Data' } }
    }, { documentRef: document })

    const el = service.getLiveNode('card-1').element
    expect(el.hasAttribute('data-state')).toBe(false)  // no default state attr

    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'loading' })
    expect(el.getAttribute('data-state')).toBe('loading')

    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'ready' })
    expect(el.getAttribute('data-state')).toBe('ready')

    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'error' })
    expect(el.getAttribute('data-state')).toBe('error')
  })
})
```

#### applyOp — setText

```javascript
describe('applyOp — setText', () => {
  it('updates text content on a badge', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'badge-1',
      spec: { component: 'badge', props: { label: 'Old' } }
    }, { documentRef: document })

    service.applyOp({ type: 'setText', id: 'badge-1', text: 'Updated' })

    expect(service.getLiveNode('badge-1').element.textContent).toBe('Updated')
  })

  it('rejects setText on a component without textProp', () => {
    const service = createService()
    // card has no textProp — its text is in slots and children
    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Test' } }
    }, { documentRef: document })

    expect(() => service.applyOp({
      type: 'setText', id: 'card-1', text: 'New'
    })).toThrow(/does not support text updates/)
  })
})
```

#### applyOp — reorder

```javascript
describe('applyOp — reorder', () => {
  it('reorders children in a slot', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'List' } }
    }, { documentRef: document })

    service.applyOp({ type: 'mount', id: 'a', parent: 'card-1', slot: 'body',
      spec: { component: 'badge', props: { label: 'A' } } }, { documentRef: document })
    service.applyOp({ type: 'mount', id: 'b', parent: 'card-1', slot: 'body',
      spec: { component: 'badge', props: { label: 'B' } } }, { documentRef: document })
    service.applyOp({ type: 'mount', id: 'c', parent: 'card-1', slot: 'body',
      spec: { component: 'badge', props: { label: 'C' } } }, { documentRef: document })

    const slotEl = service.getLiveNode('card-1').element.querySelector('.card__body')
    const originalOrder = [...slotEl.children].map(c => c.textContent).join('')
    expect(originalOrder).toBe('ABC')

    service.applyOp({ type: 'reorder', parent: 'card-1', slot: 'body',
      order: ['c', 'a', 'b'] })

    const newOrder = [...slotEl.children].map(c => c.textContent).join('')
    expect(newOrder).toBe('CAB')
  })
})
```

#### applyOps — batch

```javascript
describe('applyOps — batch', () => {
  it('applies multiple ops atomically', () => {
    const service = createService()
    service.applyOps([
      {
        type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Result' } }
      },
      {
        type: 'mount', id: 'badge-1',
        parent: 'card-1', slot: 'body',
        spec: { component: 'badge', props: { label: 'Complete' } }
      },
      {
        type: 'setState', id: 'card-1', attr: 'state', value: 'ready'
      }
    ], { documentRef: document })

    expect(service.getLiveNode('card-1').element.getAttribute('data-state')).toBe('ready')
    expect(service.getLiveNode('badge-1').parentId).toBe('card-1')
  })

  it('rejects batch with duplicate mount IDs', () => {
    const service = createService()
    expect(() => service.applyOps([
      { type: 'mount', id: 'badge-1',
        spec: { component: 'badge', props: { label: 'A' } } },
      { type: 'mount', id: 'badge-1',
        spec: { component: 'badge', props: { label: 'B' } } }
    ], { documentRef: document })).toThrow()
  })

  it('does not apply any op if one fails validation (atomicity)', () => {
    const service = createService()
    // Second op is invalid (unknown slot)
    const batch = [
      { type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Test' } } },
      { type: 'mount', id: 'badge-1',
        parent: 'card-1', slot: 'nonexistent',
        spec: { component: 'badge', props: { label: 'X' } } }
    ]

    expect(() => service.applyOps(batch, { documentRef: document })).toThrow()

    // First op should NOT have been applied
    expect(service.getLiveNode('card-1')).toBeNull()
  })
})
```

#### liveSnapshot

```javascript
describe('liveSnapshot', () => {
  it('returns current live tree structure', () => {
    const service = createService()
    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Analysis' } }
    }, { documentRef: document })

    const snapshot = service.liveSnapshot()
    expect(snapshot).toEqual([
      expect.objectContaining({
        id: 'card-1',
        component: 'card',
        props: { title: 'Analysis' },
        parentId: null
      })
    ])
  })
})
```

### 9.3 E2E streaming test (new file)

```javascript
// tests/ai-ui-e2e-streaming.test.js
// End-to-end streaming scenario: AI response rendered incrementally

import { describe, expect, it } from 'vitest'
import EventBus from '../src/runtime/EventBus.js'
import { AIUIComposerService } from '../src/modules/ai-ui/services/AIUIComposerService.js'

function createService() {
  return new AIUIComposerService(new EventBus())
}

describe('AI UI — streaming composition (E2E)', () => {

  it('streams a loading → partial → complete flow via ops', () => {
    const service = createService()

    // Step 1: mount skeleton in loading state
    service.applyOp({
      type: 'mount', id: 'results',
      spec: { component: 'card', props: { title: 'Analyzing data…' } }
    }, { documentRef: document })
    service.applyOp({
      type: 'setState', id: 'results', attr: 'state', value: 'loading'
    })

    let cardEl = service.getLiveNode('results').element
    expect(cardEl.getAttribute('data-state')).toBe('loading')
    expect(cardEl.querySelector('.card__title').textContent).toBe('Analyzing data…')

    // Step 2: AI produces first partial result
    service.applyOp({
      type: 'mount', id: 'stat-1',
      parent: 'results', slot: 'body',
      spec: { component: 'badge', props: { label: 'Processing…', variant: 'soft-info' } }
    }, { documentRef: document })

    expect(service.getLiveNode('results')
      .element.querySelector('.card__body .badge').textContent).toBe('Processing…')

    // Step 3: Transition to ready, update the badge
    service.applyOp({ type: 'setState', id: 'results', attr: 'state', value: 'ready' })
    service.applyOp({ type: 'updateProps', id: 'stat-1',
      props: { label: 'Complete', variant: 'soft-success' } })

    expect(cardEl.getAttribute('data-state')).toBe('ready')
    expect(cardEl.querySelector('.badge').getAttribute('data-variant')).toBe('soft-success')
    expect(cardEl.querySelector('.badge').textContent).toBe('Complete')

    // Step 4: Mount a button in the footer
    service.applyOp({
      type: 'mount', id: 'btn-1',
      parent: 'results', slot: 'footer',
      spec: { component: 'button', props: { label: 'View Details', variant: 'primary' } }
    }, { documentRef: document })

    expect(cardEl.querySelector('.card__footer .button').textContent).toBe('View Details')

    // Verify final live tree
    const snapshot = service.liveSnapshot()
    expect(snapshot).toContainEqual(expect.objectContaining({ id: 'results' }))
    const results = snapshot.find(n => n.id === 'results')
    const bodyChildren = results.children.find(c => c.slot === 'body')
    expect(bodyChildren).toBeTruthy()
    expect(bodyChildren.children).toContain('stat-1')
  })

  it('handles error recovery via state transitions', () => {
    const service = createService()

    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Fetch' } }
    }, { documentRef: document })
    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'loading' })

    // Simulate error
    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'error' })
    expect(service.getLiveNode('card-1').element.getAttribute('data-state')).toBe('error')

    // Retry: back to loading, then success
    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'loading' })
    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'ready' })
    expect(service.getLiveNode('card-1').element.getAttribute('data-state')).toBe('ready')
  })

  it('unmounts a subtree and cleans children', () => {
    const service = createService()

    service.applyOps([
      { type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Parent' } } },
      { type: 'mount', id: 'badge-1', parent: 'card-1', slot: 'body',
        spec: { component: 'badge', props: { label: 'Child' } } },
      { type: 'mount', id: 'btn-1', parent: 'card-1', slot: 'footer',
        spec: { component: 'button', props: { label: 'Go', variant: 'primary' } } }
    ], { documentRef: document })

    expect(service.liveSnapshot().length).toBe(3)

    service.applyOp({ type: 'unmount', id: 'card-1' })

    expect(service.liveSnapshot().length).toBe(0)
  })

  it('supports two independent concurrent compositions', () => {
    const service = createService()

    // First stream: card with results
    service.applyOp({ type: 'mount', id: 'stream-a',
      spec: { component: 'card', props: { title: 'Stream A' } } }, { documentRef: document })
    service.applyOp({ type: 'mount', id: 'a-badge', parent: 'stream-a', slot: 'body',
      spec: { component: 'badge', props: { label: 'A' } } }, { documentRef: document })

    // Second stream: card with different content
    service.applyOp({ type: 'mount', id: 'stream-b',
      spec: { component: 'card', props: { title: 'Stream B' } } }, { documentRef: document })
    service.applyOp({ type: 'mount', id: 'b-badge', parent: 'stream-b', slot: 'body',
      spec: { component: 'badge', props: { label: 'B' } } }, { documentRef: document })

    // Update A independently
    service.applyOp({ type: 'updateProps', id: 'a-badge', props: { label: 'A Updated' } })
    expect(service.getLiveNode('a-badge').element.textContent).toBe('A Updated')

    // B unchanged
    expect(service.getLiveNode('b-badge').element.textContent).toBe('B')

    // Unmount A only
    service.applyOp({ type: 'unmount', id: 'stream-a' })
    expect(service.getLiveNode('stream-a')).toBeNull()
    expect(service.getLiveNode('a-badge')).toBeNull()
    expect(service.getLiveNode('stream-b')).toBeTruthy()
    expect(service.getLiveNode('b-badge')).toBeTruthy()
  })

  it('rejects setState with unknown attribute (security boundary)', () => {
    const service = createService()
    service.applyOp({ type: 'mount', id: 'badge-1',
      spec: { component: 'badge', props: { label: 'Secure' } } }, { documentRef: document })

    expect(() => service.applyOp({
      type: 'setState', id: 'badge-1', attr: 'onerror', value: 'alert(1)'
    })).toThrow(/Unknown state attribute/)
  })

  it('does not allow mounting into a cleared slot', () => {
    const service = createService()
    service.applyOp({ type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Container' } } }, { documentRef: document })
    service.applyOp({ type: 'mount', id: 'old-1', parent: 'card-1', slot: 'body',
      spec: { component: 'badge', props: { label: 'Old' } } }, { documentRef: document })

    // Clear the slot
    service.applyOp({ type: 'clear', parent: 'card-1', slot: 'body' })
    expect(service.getLiveNode('old-1')).toBeNull()

    // Mount new content in same slot
    service.applyOp({ type: 'mount', id: 'new-1', parent: 'card-1', slot: 'body',
      spec: { component: 'badge', props: { label: 'New' } } }, { documentRef: document })
    expect(service.getLiveNode('new-1').element.textContent).toBe('New')
  })
})
```

---

## 10. E2E streaming scenario — full walkthrough

This is what the AI module + AI UI module do together after the refactor:

```
AI module receives user query: "Analyze this data"
        │
        ▼
AI provider starts generating
        │
        ▼
AI module publishes ops progressively via EventBus
        │
        ▼
EventBus → AI UI composer receives ops

Timeline:
  T+0ms:   mount "Analyzing…" card, setState loading
           → User sees skeleton with spinner (CSS handles visual via [data-state="loading"])

  T+800ms: mount "Processing" badge in body
           → User sees partial progress

  T+2s:    updateProps badge to "Phase 2 complete"
           mount "75%" badge
           → Results build up incrementally

  T+4s:    setState ready (CSS transitions skeleton → final)
           mount "View Report" button in footer
           → Final state: full composition, smooth transition

  T+4.2s:  User clicks "View Report"
           → Type II event fires via EventBus
```

The key advantage: **no full re-render at any step.** Each op touches exactly
what changed. CSS handles the visual transitions (CSMA's architecture). The
existing `compose()` would have required destroying and recreating the entire
tree at every step.

---

## 11. Implementation order

### Step 1: Internal state (no API changes)

- Add `this.liveNodes = new Map()` to constructor
- Add `this._liveNodeCounter = 0` for auto-ID generation if needed
- Add `KNOWN_STATE_ATTRS` constant
- Add `_unmountRecursive(id)` private method
- Add `_clearAllLiveNodes()` private method
- Update `cleanup()` to call `_clearAllLiveNodes()`

**Files:** `AIUIComposerService.js` only

**Risks:** Low — purely additive, no existing code paths touched

### Step 2: applyOp with mount + unmount

- Implement `applyOp(op, { documentRef })` dispatcher
- Implement `_applyMount()` — renders, tags, registers
- Implement `_applyUnmount()` — cascading cleanup
- Implement `getLiveNode(id)` — simple Map lookup
- Implement `liveSnapshot()` — serialize current state

**Files:** `AIUIComposerService.js`

### Step 3: applyOp with updateProps + setState + setText

- Implement `_applyUpdateProps()` — validates + applies via `applyAttributes()`
- Implement `_applySetState()` — validates against `KNOWN_STATE_ATTRS`
- Implement `_applySetText()` — validates `textProp` then sets `textContent`

**Files:** `AIUIComposerService.js`

### Step 4: applyOp with reorder + clear

- Implement `_applyReorder()` — validates IDs, uses `.appendChild()` to reorder
- Implement `_applyClear()` — recursively unmounts all children of a slot

**Files:** `AIUIComposerService.js`

### Step 5: applyOps batch

- Implement `applyOps(ops[], { documentRef })` with pre-flight validation phase
- Track mounted IDs within batch for duplicate detection

**Files:** `AIUIComposerService.js`

### Step 6: Optional id passthrough in normalizeSpec

- Modify `normalizeSpec()` to preserve nested `id` fields
- Modify `_applyMount()` to recursively register tagged descendants

**Files:** `AIUIComposerService.js`

### Step 7: Update tests

- Add all unit tests from Section 9.2 to `tests/ai-ui-composer-service.test.js`
- Create `tests/ai-ui-e2e-streaming.test.js` with all e2e tests from Section 9.3

**Files:** `tests/ai-ui-composer-service.test.js`, `tests/ai-ui-e2e-streaming.test.js`

### Step 8: Document

- Update `src/modules/ai-ui/README.md` with new `applyOp()`/`applyOps()` API
- Note streaming composition as a usage example

**Files:** `src/modules/ai-ui/README.md`

---

## 12. File change inventory

### Modified files

| File | What changes |
|------|-------------|
| `src/modules/ai-ui/services/AIUIComposerService.js` | Add liveNodes registry, applyOp(), applyOps(), getLiveNode(), liveSnapshot(), all `_apply*` methods, KNOWN_STATE_ATTRS, updated cleanup() |
| `src/modules/ai-ui/README.md` | Document new streaming API + usage example |
| `tests/ai-ui-composer-service.test.js` | Add unit tests for all new methods |

### New files

| File | Content |
|------|---------|
| `tests/ai-ui-e2e-streaming.test.js` | End-to-end streaming scenario, error recovery, concurrent streams, security boundary tests |

### Unchanged files

| File | Reason |
|------|--------|
| `src/modules/ai-ui/index.js` | Exposes `AIUIComposerService` — no API changes needed |
| `src/modules/ai-ui/catalog/componentCatalog.js` | Generated — no changes to generation pipeline |
| `src/ui/components/*/manifest.json` | No catalog changes needed |
| `src/modules/ai-ui/services/AIUIComposerService.js` — `compose()` | Stays identical for backward compat |
| `src/modules/ai-ui/services/AIUIComposerService.js` — `normalizeSpec()`, `normalizeProps()`, etc. | Validation logic reused by applyOp, not modified (except optional id passthrough) |
| `src/runtime/` | No runtime changes |
| `src/modules/ai/` | AI module unchanged — it just publishes different event payloads |

---

## Summary

| Metric | Value |
|--------|-------|
| New methods on `AIUIComposerService` | 4 (`applyOp`, `applyOps`, `getLiveNode`, `liveSnapshot`) |
| Private helpers | 7 (`_applyMount`, `_applyUnmount`, `_applyUpdateProps`, `_applySetState`, `_applySetText`, `_applyReorder`, `_applyClear`) |
| Internal state additions | 1 (`liveNodes: Map`) |
| New constants | 1 (`KNOWN_STATE_ATTRS`) |
| Breaking changes to existing API | **Zero** — `compose()` works exactly as before |
| New test assertions | ~60+ (unit + e2e) |
| New test file | 1 (`tests/ai-ui-e2e-streaming.test.js`) |
| Net code change | ~300 lines (service) + ~400 lines (tests) |
