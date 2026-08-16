---
name: csma-service-pattern
description: Building service-backed components and business logic services in CSMA. Covers service templates, module contributions, EventBus integration, state management, and error handling. Use when writing services under src/services/ or src/modules/*/services/.
---

<!-- version: 1.0.0 | tags: services, eventbus, state-management, modules, contracts -->

# CSMA Services API Skill

Guidance for building service-backed components and business logic services
in the CSMA architecture.

If you are deciding whether a service needs explicit lifecycle rigor, start
with `docs/rigor/SKILL.md`. This skill explains how to implement service
patterns once that decision is made.

## Service Philosophy

In CSMA, services are the "brain" while UI components are "dumb". Services
handle all business logic and calculations, manage state and data persistence,
validate and transform data, and coordinate between components via EventBus.

For extension work, services are also the execution target behind module
contributions. Command handlers, adapters, route-backed flows, and long-lived
background behavior should resolve to service methods instead of putting
behavior directly in manifests.

Services should stay as simple as their risk allows. Do not add lifecycle
machinery to every service by default.

## Service Types

### Module Services

Standalone business logic in feature modules.

```
src/modules/ai/services/AIService.js
src/modules/search/services/SearchModuleService.js
src/modules/search/services/CoreSearchService.js
src/modules/checkout/services/CheckoutService.js
src/modules/modal-system/services/ModalService.js
```

## Service Template

```javascript
/**
 * CSMA [Name] Service
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: service
 * - Owner: [domain]-service
 * - Lifecycle: active
 * - Stability: stable
 */

export class NameService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.state = new Map();      // Service state
    this.cache = new Map();      // Optional caching
    this.listeners = [];         // EventBus subscriptions
    this.config = {};            // Service configuration

    this.setupSubscriptions();
  }

  /** Setup EventBus subscriptions */
  setupSubscriptions() {
    this.listeners.push(
      this.eventBus.subscribe('INTENT_ACTION', this.handleAction.bind(this))
    );
    this.listeners.push(
      this.eventBus.subscribe('EXTERNAL_UPDATE', this.handleExternalUpdate.bind(this))
    );
  }

  /** Handle intent from UI or other services */
  handleAction(payload) {
    const validated = this.validateInput(payload);
    const result = this.process(validated);
    this.updateState(payload.id, result);
    this.eventBus.publish('ACTION_COMPLETED', {
      id: payload.id,
      result,
      timestamp: Date.now()
    });
  }

  /** Validate input data */
  validateInput(data) {
    return data;
  }

  /** Core business logic */
  process(data) {
    return { processed: true, data };
  }

  /** Update service state */
  updateState(id, data) {
    this.state.set(id, { ...data, lastUpdated: Date.now() });
  }

  /** Get current state */
  getState(id) {
    return this.state.get(id);
  }

  /** Get all states (for debugging/analytics) */
  getAllStates() {
    return Object.fromEntries(this.state);
  }

  /** Cleanup resources */
  cleanup() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
    this.state.clear();
    this.cache.clear();
  }
}

/** Factory function */
export function createNameService(eventBus) {
  return new NameService(eventBus);
}
```

## Module Contribution Pattern

Module manifests declare metadata and contribution wiring; services contain the
actual logic. Registry entries must be removable on module unload. Every
long-lived service must implement `destroy()` or `cleanup()`.

```javascript
export const manifest = {
  id: 'checkout',
  name: 'Checkout Module',
  version: '1.0.0',
  description: 'Cart + payment orchestration',
  dependencies: ['formManager'],
  services: ['checkout'],
  contracts: ['CHECKOUT_COMPLETED'],
  contributes: {
    commands: [
      {
        id: 'checkout.submit',
        title: 'Submit checkout',
        handlerService: 'checkout',
        handlerMethod: 'submit'
      }
    ],
    adapters: [
      {
        id: 'checkout.gateway',
        type: 'payment',
        serviceName: 'checkout'
      }
    ]
  }
};
```

## Service Registration

### In `src/ui/init.js` (Component Services)

```javascript
import { initToastSystem } from './components/toast/toast.js';

export function initUI(eventBus) {
  if (!eventBus) return () => {};

  const cleanups = [];

  // Type II: EventBus-driven components
  cleanups.push(initToastSystem(eventBus));

  return () => cleanups.splice(0).reverse().forEach(fn => fn());
}
```

### In Module Bootstrap

```javascript
// Modules are loaded through ModuleManager using the exported manifest/services pair.
export const manifest = {
  id: 'ai',
  name: 'AI Module',
  version: '1.0.0',
  description: 'Multi-provider AI orchestration with fallback and tooling',
  dependencies: [],
  services: ['ai'],
  contracts: ['AI_GENERATE_STARTED', 'AI_GENERATE_COMPLETE']
};

export const services = {
  ai: AIService
};
```

At runtime, prefer:

```javascript
await runtime.moduleManager.loadModule('ai');
const aiService = runtime.serviceManager.get('ai');
```

Do not teach new modules to register themselves through ad hoc `window.serviceManager`
bootstraps when the repo already uses manifest-driven loading.

## EventBus Integration

### Intent Handling Pattern

```javascript
setupSubscriptions() {
  this.listeners.push(
    this.eventBus.subscribe('INTENT_FORM_SUBMIT', async (payload) => {
      try {
        const result = await this.submitForm(payload);
        this.eventBus.publish('FORM_SUBMITTED', result);
      } catch (error) {
        this.eventBus.publish('FORM_ERROR', {
          formId: payload.formId,
          error: error.message
        });
      }
    })
  );
}
```

### Publishing State Changes

```javascript
updateValue(id, value) {
  this.state.set(id, value);
  this.eventBus.publish('VALUE_UPDATED', {
    id,
    value,
    timestamp: Date.now()
  });
}
```

### Cross-Service Communication

```javascript
// Service A publishes
this.eventBus.publish('DATA_READY', { data });

// Service B subscribes
this.eventBus.subscribe('DATA_READY', (payload) => {
  this.processData(payload.data);
});
```

## State Management

### Simple State (Map)

```javascript
this.state = new Map();
this.state.set('userId', 123);
const userId = this.state.get('userId');
if (this.state.has('userId')) { /* ... */ }
this.state.delete('userId');
```

### Complex State (Nested)

```javascript
updateUser(userId, updates) {
  const current = this.state.get(userId) || {};
  this.state.set(userId, { ...current, ...updates });
}
```

## Service Lifecycle Rigor

### Keep Simple State By Default

Use ordinary mutable service state when:

- the service has few states
- illegal transitions are not a meaningful risk
- example tests are enough to explain behavior

Examples:

- modal state
- small view coordination services
- simple caches

### Add Service-Local Transitions Selectively

Use a service-local transition map when:

- the service has explicit statuses
- async workflow steps matter
- illegal edges can corrupt behavior or hide bugs
- the lifecycle is easier to reason about as allowed transitions

Examples:

- checkout
- cart totals previews
- payment-adapter flow state
- content workflow transitions
- comments/reviews optimistic pending states
- retry/queue workflows
- optimistic flows with pending/in-progress/error states

Rules:

- keep transition logic local to the service or its domain contracts
- expose a small helper or constant for tests if needed
- throw domain-local errors on illegal transitions
- do not move transition enforcement into `EventBus`

### When Transitions Are Overkill

Do not add them just because:

- a service has a `status` string
- the module is security-sensitive but still simple
- you want more formality without clear illegal edges

In those cases, stronger tests are usually enough.

### History Tracking

```javascript
this.history = new Map();

trackChange(id, value) {
  if (!this.history.has(id)) this.history.set(id, []);
  const history = this.history.get(id);
  history.push({ value, timestamp: Date.now() });
  if (history.length > 100) history.shift();
}

getHistory(id, limit = 50) {
  return (this.history.get(id) || []).slice(-limit);
}
```

## Error Handling

### Graceful Degradation

```javascript
handleAction(payload) {
  try {
    const result = this.process(payload);
    this.eventBus.publish('ACTION_COMPLETED', result);
  } catch (error) {
    console.error('[Service] Action failed:', error);
    this.eventBus.publish('ACTION_ERROR', {
      id: payload.id,
      error: error.message,
      recoverable: this.isRecoverable(error)
    });
  }
}
```

### Validation Errors

```javascript
validateInput(data) {
  const errors = [];
  if (!data.id) errors.push('ID is required');
  if (!data.value && data.value !== 0) errors.push('Value is required');
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  return data;
}
```

## Analytics Integration

```javascript
this.analytics = {
  interactions: [],
  startTime: Date.now()
};

logInteraction(type, data) {
  this.analytics.interactions.push({ type, data, timestamp: Date.now() });
}

exportAnalytics() {
  return {
    duration: Date.now() - this.analytics.startTime,
    totalInteractions: this.analytics.interactions.length,
    interactions: this.analytics.interactions
  };
}
```

If you apply this pattern in the current repo, keep analytics ownership in `src/modules/analytics/` rather than attaching tracking methods to `LogAccumulator`.

For vertical modules such as `catalog`, `cart`, `reviews`, `comments`, `payment-adapters`, `permissions-ui`, `charts`, `admin-audit-log`, `import-export`, `content-workflow`, and `edge-search`, keep services frontend-only: state, contracts, adapters, optimistic behavior, and teardown. Authoritative backend/edge behavior stays outside CSMA.

## Best Practices

1. **Single Responsibility** -- Each service handles one domain.
2. **EventBus Only** -- Services never call UI methods directly.
3. **Stateless When Possible** -- Store minimal state, derive when possible.
4. **Always Cleanup** -- Return cleanup function, unsubscribe from events.
5. **Validate Everything** -- All inputs validated before processing.
6. **Log Meaningfully** -- Use prefixed `console.warn` / `console.debug` for
diagnostics. `console.log` is banned in `src/` (enforced by the security check).
7. **Document Contracts** -- All events documented with expected payloads.
