# CSMA Architecture Skill

Expert guidance on CSMA (Client-Side Microservices Architecture) patterns, EventBus usage, and security validation.

## Core Philosophy

CSMA separates concerns: **JavaScript manages state via events, CSS handles rendering**. This achieves 10x faster DOM updates and 17KB bundle size.

## Extension Direction

CSMA is **modules-first**.

Prefer:
- trusted modules under `src/modules/*`
- `Contracts` for validation and security
- contribution registries for commands, routes, navigation, panels, and adapters
- lifecycle-safe load/unload through `ModuleManager`, `ServiceManager`, and `destroyApp()`

Do not introduce a plugin layer unless the requirement is truly third-party or runtime-installed extensions.

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
.card[data-state="pending"] { border-left: 4px solid var(--fx-color-warning); }
.card[data-state="completed"] { border: 4px solid var(--fx-color-success); }
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
export function initDialogSystem(eventBus) {
  eventBus.subscribe('INTENT_MODAL_OPEN', (payload) => {
    openDialog(payload.modalId);
    eventBus.publish('MODAL_OPENED', { modalId: payload.modalId });
  });
  
  return () => { /* cleanup */ };
}
```

## Component Types

| Type | Name | Init Pattern | When to Use |
|------|------|--------------|-------------|
| I | Pure CSS | None | Static visuals (Badge, Card, Avatar) |
| II | Self-Contained | `init[Name]System(eventBus)` | Simple interactions (Dialog, Toast, Tabs) |
| III | Service-Backed | `create[Name]Service()` | Complex logic (Slider, FormValidator) |

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
- `INTENT_*` - User actions or component intents (e.g., `INTENT_MODAL_OPEN`)
- `*_COMPLETED`, `*_UPDATED` - State changes (e.g., `MODAL_OPENED`, `VALUE_UPDATED`)
- `SECURITY_*` - Security events (e.g., `SECURITY_VIOLATION`)

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

Registries do **not** replace contracts.

- contracts validate data and runtime messages
- registries track installed contributions and ownership by module id
- modules and services implement behavior

Current runtime registries:
- `commandRegistry`
- `routeRegistry`
- `navigationRegistry`
- `panelRegistry`
- `adapterRegistry`

## Validation

CSMA uses a fork of Superstruct. Always destructure the tuple:

```javascript
// CORRECT - Destructure tuple
const [error, validated] = Schema.validate(payload);
if (error) throw error;

// WRONG - Returns array, not object
const validated = Schema.validate(payload);
```

## Security Layers

1. **CSP Headers** - Restrict script sources
2. **Contract Validation** - Validate all event payloads
3. **Input Sanitization** - Use textContent, not innerHTML
4. **Rate Limiting** - Built into EventBus
5. **Honeypot Fields** - Bot detection
6. **Schema Spoofing Protection** - Prototype pollution prevention

## Common Patterns

### Type II Component Template
```javascript
export function init[Component]System(eventBus) {
  if (!eventBus) {
    console.warn('[Component] EventBus not provided');
    return () => {};
  }

  const items = document.querySelectorAll('.component-item');
  const cleanups = [];

  items.forEach(item => {
    const cleanup = initItem(item, eventBus);
    cleanups.push(cleanup);
  });

  const unsubscribe = eventBus.subscribe('INTENT_COMPONENT_ACTION', handler);

  return () => {
    unsubscribe();
    cleanups.forEach(c => c());
  };
}
```

### Type III Service Template
```javascript
export class ComponentService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.listeners = [];
    this.setupSubscriptions();
  }

  setupSubscriptions() {
    this.listeners.push(
      this.eventBus.subscribe('INTENT_COMPONENT_ACTION', this.handleAction.bind(this))
    );
  }

  handleAction(payload) {
    // Business logic here
    const result = this.process(payload);
    this.eventBus.publish('COMPONENT_RESULT', result);
  }

  cleanup() {
    this.listeners.forEach(unsubscribe => unsubscribe());
  }
}

export function createComponentService(eventBus) {
  return new ComponentService(eventBus);
}
```

## Module Pattern

Each module should export:

```javascript
export const manifest = {
  id: 'search',
  name: 'Search Module',
  version: '1.0.0',
  description: 'Tiered search integration for CSMA',
  dependencies: [],
  services: ['search'],
  contracts: ['SEARCH_RESULTS_RETURNED'],
  contributes: {
    commands: [],
    routes: [],
    navigation: [],
    panels: [],
    adapters: []
  }
};

export const services = {
  search: SearchService
};
```

Module unload must remove:
- module-owned services
- registry contributions
- EventBus subscriptions
- timers, observers, workers, channels, and DOM listeners
