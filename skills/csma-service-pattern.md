# CSMA Service Pattern Skill

Expert guidance on building service-backed components and business logic services in CSMA architecture.

## Service Philosophy

In CSMA, services are the "brain" while UI components are "dumb". Services:
- Handle all business logic and calculations
- Manage state and data persistence
- Validate and transform data
- Coordinate between components via EventBus

For extension work, services are also the execution target behind module contributions. Command handlers, adapters, and route-backed flows should resolve to service methods instead of putting behavior directly in manifests.

## Service Types

### Type III Component Services
Paired with UI components for complex interactions.

```
src/services/SliderService.js  ←→  src/ui/components/slider/slider.js
src/services/FormValidator.js  ←→  src/ui/components/form/form.js
```

### Module Services
Standalone business logic in feature modules.

```
src/modules/ai/services/AIService.js
src/modules/search/services/SearchService.js
src/modules/checkout/services/CheckoutService.js
```

## Service Template

### Basic Service Structure
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

  /**
   * Setup EventBus subscriptions
   */
  setupSubscriptions() {
    this.listeners.push(
      this.eventBus.subscribe('INTENT_ACTION', this.handleAction.bind(this))
    );
    
    this.listeners.push(
      this.eventBus.subscribe('EXTERNAL_UPDATE', this.handleExternalUpdate.bind(this))
    );
  }

  /**
   * Handle intent from UI or other services
   */
  handleAction(payload) {
    // 1. Validate input
    const validated = this.validateInput(payload);
    
    // 2. Process business logic
    const result = this.process(validated);
    
    // 3. Update state
    this.updateState(payload.id, result);
    
    // 4. Publish result
    this.eventBus.publish('ACTION_COMPLETED', {
      id: payload.id,
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Validate input data
   */
  validateInput(data) {
    // Use CSMA validation or custom logic
    return data;
  }

  /**
   * Core business logic
   */
  process(data) {
    return { processed: true, data };
  }

  /**
   * Update service state
   */
  updateState(id, data) {
    this.state.set(id, {
      ...data,
      lastUpdated: Date.now()
    });
  }

  /**
   * Get current state
   */
  getState(id) {
    return this.state.get(id);
  }

  /**
   * Get all states (for debugging/analytics)
   */
  getAllStates() {
    return Object.fromEntries(this.state);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
    this.state.clear();
    this.cache.clear();
  }
}

/**
 * Factory function
 */
export function createNameService(eventBus) {
  return new NameService(eventBus);
}
```

## Module Contribution Pattern

Module manifests can contribute runtime entries, but the behavior should stay service-backed:

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

Rules:
- manifests declare metadata and contribution wiring only
- services contain the actual logic
- registry entries must be removable on module unload
- every long-lived service must implement `destroy()` or `cleanup()`

## Service Registration

### In src/ui/init.js (Component Services)
```javascript
import { createSliderService } from '../services/SliderService.js';
import { initSliderUI } from './components/slider/slider.js';

export function initUI(eventBus) {
  // Create and register service
  const sliderService = createSliderService(eventBus);
  if (window.serviceManager) {
    window.serviceManager.register('slider', sliderService);
  }
  
  // Initialize UI
  const sliderCleanup = initSliderUI(eventBus);
  
  // Store cleanup
  window.csma.componentCleanup = () => {
    sliderCleanup();
    sliderService.cleanup();
  };
}
```

### In src/main.js (Module Services)
```javascript
import { ServiceManager } from './runtime/ServiceManager.js';
import { AIService } from './modules/ai/services/AIService.js';

const serviceManager = new ServiceManager();
serviceManager.register('ai', new AIService(eventBus));
```

## EventBus Integration

### Intent Handling Pattern
```javascript
setupSubscriptions() {
  // Subscribe to intents
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

// Set
this.state.set('userId', 123);

// Get
const userId = this.state.get('userId');

// Has
if (this.state.has('userId')) { ... }

// Delete
this.state.delete('userId');
```

### Complex State (Nested)
```javascript
this.state = new Map();

updateUser(userId, updates) {
  const current = this.state.get(userId) || {};
  this.state.set(userId, { ...current, ...updates });
}
```

### History Tracking
```javascript
this.history = new Map();

trackChange(id, value) {
  if (!this.history.has(id)) {
    this.history.set(id, []);
  }
  
  const history = this.history.get(id);
  history.push({ value, timestamp: Date.now() });
  
  // Limit history size
  if (history.length > 100) history.shift();
}

getHistory(id, limit = 50) {
  return (this.history.get(id) || []).slice(-limit);
}
```

## Analytics Integration

### Track Interactions
```javascript
this.analytics = {
  interactions: [],
  startTime: Date.now()
};

logInteraction(type, data) {
  this.analytics.interactions.push({
    type,
    data,
    timestamp: Date.now()
  });
}

exportAnalytics() {
  return {
    duration: Date.now() - this.analytics.startTime,
    totalInteractions: this.analytics.interactions.length,
    interactions: this.analytics.interactions
  };
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
    
    // Publish error for UI to handle
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

## Real Example: SliderService

```javascript
export class SliderService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.sliderStates = new Map();
    this.dragSessions = new Map();
    this.valueHistory = new Map();
    this.listeners = [];
    
    this.setupSubscriptions();
  }

  setupSubscriptions() {
    this.listeners.push(
      this.eventBus.subscribe('INTENT_SLIDER_VALUE_CHANGED', 
        this.handleValueChanged.bind(this))
    );
    
    this.listeners.push(
      this.eventBus.subscribe('INTENT_SLIDER_DRAG_STARTED', 
        this.handleDragStarted.bind(this))
    );
    
    this.listeners.push(
      this.eventBus.subscribe('INTENT_SLIDER_DRAG_ENDED', 
        this.handleDragEnded.bind(this))
    );
  }

  handleValueChanged(payload) {
    const { sliderId, value, min, max, step } = payload;
    
    // Validate
    const validatedValue = this.validateValue(value, min, max, step);
    const percentage = ((validatedValue - min) / (max - min)) * 100;
    
    // Update state
    this.updateSliderState(sliderId, {
      value: validatedValue,
      percentage,
      min, max, step
    });
    
    // Track history
    this.trackValueHistory(sliderId, validatedValue);
    
    // Publish update
    this.eventBus.publish('SLIDER_VALUE_UPDATED', {
      sliderId,
      value: validatedValue,
      percentage
    });
  }

  validateValue(value, min, max, step) {
    let clamped = Math.max(min, Math.min(max, value));
    if (step > 0) {
      const steps = Math.round((clamped - min) / step);
      clamped = min + steps * step;
    }
    return clamped;
  }

  // ... more methods
}
```

## Best Practices

1. **Single Responsibility** - Each service handles one domain
2. **EventBus Only** - Services never call UI methods directly
3. **Stateless When Possible** - Store minimal state, derive when possible
4. **Always Cleanup** - Return cleanup function, unsubscribe from events
5. **Validate Everything** - All inputs validated before processing
6. **Log Meaningfully** - Use prefixed console.log for debugging
7. **Document Contracts** - All events documented with expected payloads
