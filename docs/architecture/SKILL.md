---
name: csma-architecture
description: CSMA architecture rules, EventBus patterns, Contracts validation, component types, design token pipeline, and CSS conventions. Use when building components, understanding event-driven patterns, or onboarding onto CSMA.
---

<!-- version: 2.0.0 | tags: architecture, eventbus, contracts, css, design-tokens, components -->

# CSMA Architecture Skill

Core architecture knowledge and component-building rules for the CSMA
(Client-Side Microservices Architecture) system.

## Core Philosophy

CSMA separates concerns: **JavaScript manages state via events, CSS handles
rendering**. This achieves fast DOM updates and a minimal bundle size.

CSMA is **modules-first**. Prefer trusted modules under `src/modules/*`,
`Contracts` for validation and security, contribution registries for commands,
navigation, panels, adapters, and views, and lifecycle-safe load/unload
through `ModuleManager`, `ServiceManager`, `syncWindowRuntime()`, and
`destroyRuntimeState()`.

Global primitives under `src/ui/components/` are only for cross-app atomic UI.
Domain UI patterns belong inside their owning module, usually
`src/modules/<module>/ui/`, and can advertise reusable agent-safe patterns with
`manifest.aiUi.components`.

Module boundary:

- CSMA modules own only the client-side half: UI state, EventBus contracts,
  adapters, optimistic behavior, and safe local/cache behavior
- backend/edge companions own authority: secrets, DB writes, payment sessions,
  private search indexes, moderation, RBAC, audit sources, imports, and workflow persistence
- the vertical frontend modules currently include `catalog`, `cart`,
  `cms-content`, `comments`, `reviews`, `payment-adapters`, `permissions-ui`,
  `charts`, `admin-audit-log`, `import-export`, `content-workflow`,
  `edge-search`, `feature-flags`, `content-prefetch`, and `ab-testing`
- do not put backend authority or deployment orchestration into CSMA modules

- `loadOptionalFeatures` (`src/runtime/features.js`) loads enabled modules in
  dependency waves: independent modules run under `Promise.all`, while
  ordered edges remain sequential (network → sync → optimistic; captcha/form
  before auth-ui/checkout; consent before analytics/notifications; router
  before client navigation; file-system before file-upload/media)

Routing boundary:

- core runtime owns path normalization, page resolution, and optional History API interception
- the optional `router` module owns SPA/hybrid route orchestration
- static public MPA pages should stay real HTML outputs rather than JS HTML injection

Localization and SEO boundary:

- `i18n` owns locale state, translation loading, and language switching
- `meta-manager` owns `<title>`, meta tags, canonical links, hreflang alternates, and JSON-LD output
- page/app code composes localized SEO payloads and passes them through `PAGE_CHANGED` or `metaManagerModule`

Rigor is layered on top of this baseline. Use standard CSMA first, then add
property tests, service-local transitions, or stronger verification only when
the module risk justifies it. See `docs/rigor/SKILL.md`.

## The 6 Rules

### 1. State Changes = CSS Classes Only

```javascript
// CORRECT
element.className = 'card completed high-priority';
element.dataset.state = 'loading';

// WRONG
element.style.opacity = '1';
element.style.borderColor = 'green';
```

Exception:
Transient inline styles produced by CSS animation/keyframes or GSAP at runtime
are acceptable as animation output. Inline styles are still not allowed as the
durable source of truth for UI state.

### 2. Define All States in CSS

```css
.card[data-state="pending"] { border-inline-start: 4px solid var(--warning); }
.card[data-state="completed"] { border: 4px solid var(--success); }
.card[data-state="loading"] { opacity: 0.7; pointer-events: none; }
```

### 3. JavaScript Publishes Events, CSS Handles Rendering

```javascript
// Service publishes event
class NoteService {
  saveNote(note) {
    const validated = this.validate(note);
    this.eventBus.publish('NOTE_SAVED', validated);
  }
}

// UI subscribes and updates class
eventBus.subscribe('NOTE_SAVED', (note) => {
  document.getElementById(`note-${note.id}`).className = `card ${note.status}`;
});
```

### 4. Security First - Always Validate

```javascript
// CORRECT: textContent + validation
element.textContent = userInput;
const [error, validated] = Schema.validate(userInput);
if (error) throw error;
eventBus.publish('NOTE_SAVED', validated);

// WRONG: parse user-controlled markup or skip validation
parseAndAppendUserMarkup(element, userInput); // XSS vulnerability!
```

### 5. Data Attributes for Complex State

```javascript
// CORRECT
Object.assign(element.dataset, {
  status: 'pending',
  priority: 'high',
  category: 'urgent'
});

// WRONG
element.className = 'card pending high priority urgent category';
```

### 6. Self-Contained Components Subscribe to Own Intents

```javascript
export function initToastSystem(eventBus) {
  const unsubscribe = eventBus.subscribe('INTENT_TOAST_SHOW', (payload) => {
    showToast(payload);
    eventBus.publish('TOAST_SHOWN', { toastId: payload.id, timestamp: Date.now() });
  });

  return () => { unsubscribe(); };
}
```

## Component Types

| Type | Name | Init Pattern | When to Use |
|------|------|--------------|-------------|
| I | Pure CSS | None | Static visuals (Badge, Button, Toggle-Card, Slider) |
| II | Self-Contained | `init[Name]System(eventBus)` | Simple interactions (Toast) |

### Type I -- Pure CSS

Only CSS. Uses `data-*` attributes for variants and states. No JS needed.

```
button/
  manifest.json    # AIUI catalog entry (propsSchema, slots, render, behavior)
  button.css        # Component styles using design tokens
  button.demo.html  # Optional showcase template
```

Reference: `src/ui/components/button/button.css`

Each Type I component has a `manifest.json` with an `aiUi` block that defines:

- `propsSchema` — allowed string props (e.g. `label`, `value`, `state`)
- `slots` — named child containers with `selector` + `allowedChildren`
- `render` — DOM tag, className, attributes, children, `textProp`
- `behavior` — role, events, `intentMap` (e.g. `{"click": "settings:select"}`)
- `style` — `surfaceAware`, `supportsVariant/Size/Tone`

### Type II -- EventBus-Driven

CSS + JS. JS exports `init[Name]System(eventBus)` returning a cleanup function.

```
toast/
  manifest.json
  toast.css
  toast.js          # initToastSystem(eventBus) → cleanup function
```

Reference: `src/ui/components/toast/toast.js`

### AIUI Composer Service

The `src/modules/ai-ui/` module provides `AIUIComposerService` — a secure
DOM composition engine that:

- **Catalog**: 18 registered components (7 original + 11 settings primitives).
  Auto-generated from `manifest.json` files via `npm run generate-ai-ui-catalog`.
- **Ops**: `mount`, `unmount`, `clear`, `reorder`, `updateProps`, `setState`,
  `setText` — all validated before DOM mutation.
- **SAFE_TAGS**: 54 whitelisted HTML tags (layout, forms, tables, media, text
  semantics). Never allows `script`, `iframe`, `style`, `svg`, `canvas`, etc.
- **Intent system**: manifest `behavior.intentMap` maps DOM events to CSMA
  intents (e.g. `click → settings:select`). The controller subscribes and
  emits ops — the component itself never touches DOM directly.

To create a new Type I component, see the `csma-component-creation` skill.

## EventBus Patterns

### Subscribe (with cleanup)

```javascript
const unsubscribe = eventBus.subscribe('EVENT_NAME', (payload) => {
  // Handle event
});

// Cleanup on hot reload
return () => unsubscribe();
```

### Publish

```javascript
eventBus.publish('INTENT_ACTION', {
  id: 'element-id',
  value: someValue,
  timestamp: Date.now()
});
```

### Event Naming Convention

- `INTENT_*` -- User actions or component intents (e.g., `INTENT_MODAL_OPEN`)
- `*_COMPLETED`, `*_UPDATED` -- State changes (e.g., `MODAL_OPENED`)
- `SECURITY_*` -- Security events (e.g., `SECURITY_VIOLATION`)

## Contracts

Contracts validate all EventBus payloads.

`src/runtime/Contracts.js` exports **core contracts only** (shared runtime,
component, module-lifecycle, and a few root services). Feature modules own
their contracts under `src/modules/<id>/contracts/*` and export them as
`export const contracts = …` from the module index. `ModuleManager.loadModule`
registers those contracts before contributions are installed, normalizes
intent rate limits, and unregisters them on unload.

```javascript
// Core bootstrap (default-deny base map)
eventBus.contracts = Contracts;

// Module contracts arrive when loadModule runs
// ModuleManager.registerContracts(module.contracts)

// Example module-owned intent
export const FormManagementContracts = {
  INTENT_FORM_SUBMIT: {
    version: 1,
    type: 'intent',
    owner: 'form-management',
    schema: object({ formId: string(), timestamp: number() }),
    security: {
      rateLimits: { requests: 10, windowMs: 60000, scope: 'session' }
    }
  }
};
```

Registries do **not** replace contracts. Contracts validate data and runtime
messages; registries track installed contributions and ownership by module id;
modules and services implement behavior.

Contracts are the production boundary. They are not a substitute for higher
development-time rigor, and they do not imply every service needs a transition
map. Use `docs/rigor/SKILL.md` to decide when to add more.

Tests that construct a runtime without `loadModule` must register the module's
`contracts` export themselves or events will default-deny.

Current runtime registries: `commandRegistry`, `navigationRegistry`,
`panelRegistry`, `adapterRegistry`, `viewRegistry`.

### Validation Destructuring

CSMA uses a fork of Superstruct. Always destructure the tuple:

```javascript
// CORRECT
const [error, validated] = Schema.validate(payload);
if (error) throw error;

// WRONG -- returns array, not object
const validated = Schema.validate(payload);
```

## Security Layers

1. **CSP Headers** -- Restrict script sources
2. **Contract Validation** -- Validate all event payloads
3. **Input Sanitization** -- Use textContent, not innerHTML
4. **Rate Limiting** -- Built into EventBus
5. **Honeypot Fields** -- Bot detection
6. **Schema Spoofing Protection** -- Prototype pollution prevention

## Design Token Pipeline

```
token-overrides.json  ->  patch-tokens.js  ->  design-tokens.json  ->  generate-tokens.js  ->  generated/tokens.css
```

For app-specific token customization, edit `src/style/token-overrides.json` and
run `npm run tokens:patch`. Never edit `tokens.css` directly.

DTCG format basics:
- `$type` -- token type (color, dimension, fontFamily, etc.)
- `$value` -- token value
- `$description` -- optional description

### Token Reference

**Colors**: `--background`, `--surface`, `--foreground`, `--border`,
`--primary`, `--secondary`, `--accent`, `--destructive`, `--success`,
`--warning`, `--info` (each with `-foreground` and/or `-muted` variants).

**Spacing**: `--space-2xs` (2px) through `--space-5xl` (96px).

**Radius**: `--radius-sm` through `--radius-full` (999px).

**Typography**: `--font-family-base`, `--font-family-mono`;
`--font-size-xs` through `--font-size-3xl`; `--font-weight-regular` through
`--font-weight-bold`; `--line-height-tight` through `--line-height-loose`.

**Motion**: `--transition-fast` (120ms), `--transition-normal` (200ms),
`--transition-slow` (320ms).

**Shadows**: `--shadow-xs` through `--shadow-xl`.

**Breakpoints**: `--breakpoint-sm` (480px) through `--breakpoint-xl` (1280px).

**Z-Index**: `--z-base` (1) through `--z-tooltip` (600).

## CSS Conventions

- Single base class + `data-*` attributes (never BEM modifier classes)
- `var(--token)` for every visual value (never raw pixels/colors)
- Focus ring: `box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring)`
- `prefers-reduced-motion: reduce` disables transitions/animations
- Theme switch: `document.documentElement.dataset.theme = 'light' | 'dark'`

## Component Structure

Each component lives in its own folder under `src/ui/components/`:

```
your-component/
  your-component.css   # required -- all visual states
  your-component.js    # optional -- only for Type II components
```

## Adding a Component

1. Create `src/ui/components/<name>/<name>.css` with all visual states
2. (Optional) Create `<name>.js` for Type II -- export
   `init[Name]System(eventBus)`
3. Add `@import './<name>/<name>.css';` to `src/ui/components/index.css`
4. (Type II) Import and call init in your bootstrap file

## What To Watch For

- Do not hardcode color fallbacks when a semantic token exists.
- Do not use `innerHTML` for user data -- always use `textContent`.
- Do not use inline styles for state changes -- use CSS classes or
  `data-*` attributes.
- All visual values must reference `var(--token-name)`.

## 8-State Discipline

Every interactive CSMA component must define CSS for all 8 visual states.
This ensures predictable behavior across themes, registers, and contexts.

### Required states

| State | Attribute / Selector | Purpose |
|-------|---------------------|---------|
| Default | *(base selector)* | Resting, no user interaction |
| Hover | `.is-hover` or `:hover` | Mouse pointer over element |
| Active | `.is-active` or `:active` | Element is being pressed |
| Focus | `.is-focus` or `:focus-visible` | Keyboard focus |
| Disabled | `[disabled]` or `[aria-disabled="true"]` | Non-interactive |
| Loading | `[data-state="loading"]` | Async operation in progress |
| Error | `[data-state="error"]` or `[aria-invalid="true"]` | Validation or operation error |
| Selected | `[aria-pressed="true"]` or `[data-state="selected"]` | Toggleable element selected |

### Preview classes for static inspection

In `preview.html` files (generated by `create-component`), CSS simulation
classes `.is-hover`, `.is-focus`, and `.is-active` mirror their
pseudo-class equivalents for static rendering:

```css
/* Component CSS should mirror hover styles for preview */
.my-button:hover,
.my-button.is-hover {
  background: var(--primary-foreground);
  color: var(--primary);
}

.my-button:active,
.my-button.is-active {
  transform: scale(0.98);
}

.my-button:focus-visible,
.my-button.is-focus {
  box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring);
}
```

### Generating preview files

When you create a component with `create-component`, it generates a
`{name}.preview.html` showing all 8 states in a grid. Use this page to
verify state styles are complete and visually consistent before shipping.

### Error vs Success states

`[data-state="error"]` is for error outcomes. For success outcomes, use
`[data-state="success"]`. Both are optional but recommended for components
that display operation results (cards, badges, fields).

```css
.badge[data-state="error"] { background: var(--destructive-muted); color: var(--destructive); }
.badge[data-state="success"] { background: var(--success-muted); color: var(--success); }
```


## Agent Context (state-to-text bridge)

CSMA modules expose their state to AI agents through the **agent-context**
service (`src/modules/agent-context/`). It is the canonical bridge between
runtime state and LLM-readable text. Direct IDB queries or per-module
`toMarkdown()` helpers should not be reinvented — register a serializer
instead.

### Contribution shape

Any module that wants its state readable by an agent declares serializers
in its manifest:

```js
contributes: {
  contextSerializers: [
    { store: 'maps', format: 'markdown', fn: 'toMarkdown', default: true },
    { store: 'maps', format: 'ascii',    fn: 'toAscii' },
    { store: 'maps', format: 'json',     fn: 'toMinimalJson' }
  ]
}
```

- `store` is the IDB store or logical name the serializer targets.
- `format` is `markdown` (default for LLM token economy), `json`, `ascii`,
  or a custom name prefixed with `x-`.
- `fn` is a function (inline) or a string export name resolved against
  the module's service or namespace at call time.

The serializer signature is `(data, options) => string | { text, cursor? }`.
The `data` argument is supplied by the caller (or fetched from `storage`
when available); `options` carries `{ store, id, filter, depth, cursor,
format }`.

### Dispatch and fallbacks

`AgentContextService.get({ store, format, data?, filter?, depth?, cursor? })`
returns `{ text, format, bytes, truncated?, cursor? }`.

When no serializer is registered for `{ store, format }`, the service
falls back to a generic formatter (`MarkdownFormatter`, `JsonFormatter`,
or `AsciiFormatter`) that produces best-effort output over arbitrary
record shapes. Built-in formats are always available even without any
module registered.

Output is truncated at 50KB by default; the response carries
`truncated: true` plus a `cursor` for pagination.

### Subscriptions

`subscribe({ store, format, filter }, cb)` re-serializes and delivers on
each matching `HISTORY_OP_RECORDED` event. Requires the `history` module
to be loaded; otherwise throws `[AgentContext] subscription requires
history module`.

### What agent-context does NOT do

- No MCP server transport in v1 (decision 1a). The `get()` / `subscribe()`
  surface is shaped so a future `mcp-bridge` module can wrap it without
  API changes.
- No streaming. v1 returns complete strings with truncation.
- No authn/authz. The in-browser agent is assumed same-origin and
  trusted. Cross-origin or extension-based agents need the MCP bridge
  with its own auth layer.
- No caching of serialized output. Recompute per `get()`; add an LRU if
  profiling shows hot spots.
