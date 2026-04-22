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
routes, navigation, panels, and adapters, and lifecycle-safe load/unload
through `ModuleManager`, `ServiceManager`, and `destroyApp()`.

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

### 2. Define All States in CSS

```css
.card[data-state="pending"] { border-left: 4px solid var(--warning); }
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

// WRONG: innerHTML or skip validation
element.innerHTML = userInput; // XSS vulnerability!
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
| I | Pure CSS | None | Static visuals (Badge, Button) |
| II | Self-Contained | `init[Name]System(eventBus)` | Simple interactions (Toast) |

### Type I -- Pure CSS

Only CSS. Uses `data-*` attributes for variants and states. No JS needed.

```
button/
  button.css
```

Reference: `src/ui/components/button/button.css`

### Type II -- EventBus-Driven

CSS + JS. JS exports `init[Name]System(eventBus)` returning a cleanup function.

```
toast/
  toast.css
  toast.js
```

Reference: `src/ui/components/toast/toast.js`

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

Contracts validate all EventBus payloads:

```javascript
// In src/runtime/Contracts.js
export const Contracts = {
  INTENT_MODAL_OPEN: {
    schema: object({
      modalId: string(),
      timestamp: number()
    }),
    security: {
      rateLimits: {
        perSecond: 10,
        perMinute: 100
      }
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

Current runtime registries: `commandRegistry`, `routeRegistry`,
`navigationRegistry`, `panelRegistry`, `adapterRegistry`, `viewRegistry`.

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
design-tokens.json  ->  generate-tokens.js  ->  generated/tokens.css
```

To customize tokens, edit `src/style/design-tokens.json` and run
`npm run tokens`. Never edit `tokens.css` directly.

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
