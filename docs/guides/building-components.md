# Building CSMA Components

> **Philosophy**: In CSMA, UI components are **dumb**. They do not contain business logic. They simply **render state** provided by services and **publish intents** based on user actions.

---

## 1. The Golden Rules

1.  **HTML-First**: Start with semantic HTML. Use `data-*` attributes for behavior hooks.
2.  **CSS-Driven State**: Never use `style.property = value`. Toggle classes or data attributes.
3.  **Logic-Free**: If it calculates, validates, or stores data, it belongs in a **Service**, not a Component.
4.  **Event-Driven**: Components never talk to each other directly. They use the `EventBus`.

---

## 2. Component Taxonomy

We classify components into **4 Distinct Types** based on complexity and logic ownership.

| Type | Name | Characteristics | Example | Logic Owner | Initialization |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **I** | **Pure UI** | HTML/CSS only. No JavaSript. Visuals only. | `Badge`, `Card`, `Avatar` | Browser | None (Static HTML) |
| **II** | **Self-Contained** | Handles simple user interactions. "Logic-Light". | `Dialog`, `Popover`, `Tabs` | Component (Internal) | `initUI` calls `initComponent(bus)` |
| **III** | **Service-Backed** | UI is dumb; "Brain" is a Service. | `Slider`, `FormValidator` | Service (External) | `ServiceManager` + `initUI` |
| **IV** | **Module** | Massive feature set. Lazy-loaded bundle. | `Router`, `I18n` | Module Logic | `ModuleManager.loadModule(...)` |

### Components vs Patterns
*   **Atomic Components** (`src/ui/components/`): Reusable "Lego Bricks" (Button, Input). Used everywhere.
*   **Composite Patterns** (`src/ui/patterns/`): Specific compositions (Sidebar, LoginForm). Often just HTML snippets or specific layout logic. Do NOT make these overly reusable/abstract.

### How to Choose?
*   **"I just need to show a picture"** -> **Type I (Pure UI)**
*   **"I just need to toggle show/hide"** -> **Type II (Self-Contained)**
*   **"I need to calculate numbers or validate data"** -> **Type III (Service-Backed)**
*   **"I am building a whole new sub-application"** -> **Type IV (Module)**

---

## 3. Component Initialization Patterns

All UI components must be registered in `src/ui/init.js` to auto-initialize with EventBus integration.

⚠️ **WARNING: Manual Registration Required**: 
When adding a new component to `src/ui/init.js`, you MUST do all three:
1. **IMPORT** the component (at top of file)
2. **INITIALIZE** it in `initUI()` (mid file)
3. **ADD CLEANUP** to `window.csma.componentCleanup` (bottom of file)

See `src/ui/init.js` comment block for exact line numbers and full instructions.

### Important: EventBus Validation
The validation system used by EventBus returns a tuple `[error, validatedValue]`, **not** just the validated object. When using EventBus validation internally, you must destructure the tuple:

```javascript
// ❌ WRONG - Returns array
const validated = schema.validate(payload);

// ✅ CORRECT - Destructure tuple
const [error, validated] = schema.validate(payload);
if (error) throw error;
```

The EventBus `_validatePayload()` method internally handles this tuple unpacking, but if you use validation directly in your code, you must handle it correctly.

### Pattern 1: Self-Contained (Type II)

**Used for**: Components that manage their own state via EventBus - Dialog, Toast, Popover, Tabs, Accordion, Dropdown

```javascript
// Component exports
export function init[Component]System(eventBus) {
  // Auto-discover all instances on page
  const dialogs = document.querySelectorAll('.dialog-overlay');
  dialogs.forEach(dialog => initDialog(dialog, eventBus));
  
  // Subscribe to INTENT_[COMPONENT]_* events
  const unsubscribe = eventBus.subscribe('INTENT_MODAL_OPEN', (payload) => {
    openDialog(payload.modalId);
  });
  
  // Return cleanup function for hot reload
  return () => {
    unsubscribe();
    // ... other cleanup
  };
}

// In init.js
export function initUI(eventBus) {
  const dialogCleanup = initDialogSystem(eventBus);
}
```

**Characteristics**:
- ✅ Self-contained (no external Service needed)
- ✅ Subscribes to its own INTENT_* events
- ✅ Publishes events for other components
- ✅ Returns cleanup function for hot reload

**Naming Convention**: `init[Component]System(eventBus)` (singular, System suffix)

**Examples**:
- `dialog.js` - `initDialogSystem(eventBus)`
- `toast.js` - `initToastSystem(eventBus)`
- `popover.js` - Should be `initPopoverSystem(eventBus)`

---

### Pattern 2: Service-Backed (Type III)

**Used for**: Components needing complex business logic - Slider, FormValidator

```javascript
// Service exports factory
export function create[Component]Service(eventBus) {
  return {
    validate(input) { /* ... */, eventBus.publish('VALIDATION_RESULT', result) },
    calculate(data) { /* ... */, eventBus.publish('CALCULATION_RESULT', result) }
  };
}

// Component exports UI init
export function init[Component]UI(eventBus) {
  // UI-specific initialization only
  const items = document.querySelectorAll('.component-item');
  items.forEach(item => initComponentItem(item, eventBus));
  
  return cleanupFunction;
}

// In init.js
export function initUI(eventBus) {
  const service = createSliderService(eventBus);
  window.serviceManager.register('slider', service);
  const sliderCleanup = initSliderUI(eventBus);
}
```

**Characteristics**:
- ✅ Complex business logic separated from UI
- ✅ Service registers with ServiceManager
- ✅ UI component handles only rendering
- ✅ Good for data-intensive components

**Naming Convention**: 
- Service: `create[Component]Service(eventBus)` → serviceInstance
- UI: `init[Component]UI(eventBus)` → cleanupFunction

**Examples**:
- `SliderService.js` - `createSliderService(eventBus)` + `initSliderUI(eventBus)`

---

### Pattern 3: Pure CSS (Type I)

**Used for**: Static visual components - Badge, Card, Avatar, Separator, Skeleton

```javascript
// No JavaScript file needed
// CSS only in src/ui/components/badge/badge.css
// Demo HTML in badge.demo.html
```

**Characteristics**:
- ✅ Zero JavaScript
- ✅ CSS variables for theming
- ✅ `data-state` for states (if any)
- ✅ Semantic HTML

**Examples**:
- `badge` - Visual only
- `card` - Visual only
- `avatar` - Visual only

---

## 4. How to Build a Component (Step-by-Step)

Let's build a **"Like Button"** that updates a counter.

### Step 1: Define HTML Structure
Use `data-` attributes to mark interactive elements.

```html
<!-- In index.html or a template -->
<div id="like-widget" class="like-widget">
  <span class="count">0</span>
<button data-action="like" class="button" data-variant="secondary">
    ♥ Like
  </button>
</div>
```

### Step 2: Define CSS States
Define how the component looks in different states using CSS classes or attributes.

```css
/* src/css/components.css */
.like-widget[data-state="liked"] .button {
  color: red;
  font-weight: bold;
}

.like-widget[data-state="loading"] {
  opacity: 0.7;
  pointer-events: none;
}
```

### Step 3: Create JS Component
Create `src/ui/components/like-widget/like-widget.js`.

```javascript
import { setState } from '../init.js'; // Helper for data-state

export class LikeWidget {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.container = document.getElementById('like-widget');
        
        // 1. Subscribe to state changes
        this.eventBus.subscribe('LIKE_UPDATED', this.render.bind(this));
    }

    init() {
        if (!this.container) return;

        // 2. Handle user interaction (Publish Intent)
        const btn = this.container.querySelector('[data-action="like"]');
        btn.addEventListener('click', () => {
            // Optimistic UI update (optional)
            setState(this.container, 'loading');

            this.eventBus.publish('INTENT_LIKE_CLICKED', {
                widgetId: 'main-like',
                timestamp: Date.now()
            });
        });
    }

    // 3. Render State (Update DOM)
    render({ count, isLiked }) {
        // Clear loading state
        setState(this.container, isLiked ? 'liked' : null);

        // Update text safely
        this.container.querySelector('.count').textContent = count;
    }
}
```

### Step 4: Define Contracts
Define the events in `src/runtime/Contracts.js`.

```javascript
// Intent
INTENT_LIKE_CLICKED: {
    type: 'intent',
    schema: object({ widgetId: string(), timestamp: number() })
},

// Event
LIKE_UPDATED: {
    type: 'event',
    schema: object({ count: number(), isLiked: boolean() })
}
```

### Step 5: Register in `src/ui/init.js`
Initialize the component in the central UI registry.

```javascript
import { initLikeWidget } from '../components/like-widget/like-widget.js';

export function initUI(eventBus) {
    // ...
    initLikeWidget(eventBus);
}
```

### Step 6: Initialize Demo Files (CRITICAL - Type II/III Only)
**For Type II (Self-Contained) and Type III (Service-Backed) components**, you MUST initialize EventBus:

```html
<!DOCTYPE html>
<html>
<head>
    <!-- ... -->
</head>
<body>
    <!-- Your component HTML -->
    
    <script type="module">
        import { EventBus } from '../../../runtime/EventBus.js';
        import { init[Component]System } from './[component].js';
        import { Contracts } from '../../../runtime/Contracts.js';
        
        const eventBus = new EventBus();
        eventBus.contracts = Contracts;
        
        init[Component]System(eventBus);
    </script>
</body>
</html>
```

**IMPORTANT**: This pattern is for **Type II and III components only** (EventBus-based). Do NOT use this for Type I (CSS-only) components.

**Why this matters**: Without EventBus initialization, Type II/III components won't be interactive in demos. They subscribe to EventBus events, so the EventBus must exist and have Contracts defined.

---

### Step 6b: Type I (Pure CSS) Components
For **Type I components** (CSS-only, no EventBus), use a different pattern:

```html
<!DOCTYPE html>
<html>
<head>
    <!-- ... -->
</head>
<body>
    <!-- Your component HTML -->
    
    <script type="module">
        import { helperFunction } from './[component].js';
        
        // Expose functions for onclick handlers
        window.helperFunction = helperFunction;
    </script>
</body>
</html>
```

**Example** (Alert Dialog - Type I):
```html
<script type="module">
    import { openAlertDialog, closeAlertDialog } from './alert-dialog.js';
    
    window.openAlertDialog = openAlertDialog;
    window.closeAlertDialog = closeAlertDialog;
</script>
```

**Why different patterns?**
- **Type I**: Helper functions are called directly from HTML via onclick handlers
- **Type II/III**: Components publish/subscribe to EventBus events, EventBus manages all interactions

---

### Step 7: (Optional) Register Service
If your component has a paired *Service* (business logic), register in `src/main.js`.

```javascript
import { NoteService } from './services/NoteService.js';
serviceManager.register('note', new NoteService());
```

---

## 5. Adding a New Component

### For Type II (Self-Contained):

1. Create `src/ui/components/my-component/my-component.js`
2. Export `initMyComponentSystem(eventBus)`
3. In component:
   - Query all instances: `document.querySelectorAll('.my-component')`
   - Subscribe to events: `eventBus.subscribe('INTENT_MY_COMPONENT_*, handler)`
   - Return cleanup function
4. Add to `src/ui/init.js`:
   ```javascript
   import { initMyComponentSystem } from './components/my-component/my-component.js';
   
   export function initUI(eventBus) {
     const myComponentCleanup = initMyComponentSystem(eventBus);
     // ... other components ...
   }
   ```

### For Type III (Service-Backed):

1. Create `src/services/MyComponentService.js`
2. Export `createMyComponentService(eventBus)`
3. Create `src/ui/components/my-component/my-component.js`
4. Export `initMyComponentUI(eventBus)`
5. In `src/ui/init.js`:
   ```javascript
   import { createMyComponentService } from '../services/MyComponentService.js';
   import { initMyComponentUI } from './components/my-component/my-component.js';
   
   export function initUI(eventBus) {
     const service = createMyComponentService(eventBus);
     window.serviceManager.register('my-component', service);
     const cleanup = initMyComponentUI(eventBus);
   }
   ```

### For Type I (Pure CSS):

1. Create `src/ui/components/my-component/my-component.css`
2. Use CSS variables from `src/css/foundation/tokens.css`
3. No JavaScript needed
4. Add demo in `my-component.demo.html`

---

## 6. Best Practices

### Security
*   ✅ **DO**: Use `textContent` to set text.
*   ❌ **DON'T**: Use `innerHTML` (XSS risk).

### Performance
*   ✅ **DO**: Use `className` or `dataset` changes (1 reflow).
*   ❌ **DON'T**: Use `style.color = 'red'` (triggers reflows per property).

### State Management
*   ✅ **DO**: Use `data-state="error"` or `data-state="success"`.
*   ❌ **DON'T**: Store state in JS variables (except transient UI state like "isMenuOpen").

### Validation
*   ✅ **DO**: Validate inputs before publishing intents.
*   ✅ **DO**: Let the Service handle complex business validation.

---

## 7. Common Patterns

### Input Validation (Debounced)
```javascript
let timeout;
input.addEventListener('input', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        // Validate and publish INTENT_INPUT_CHANGED
    }, 300);
});
```

### Modals (Native `<dialog>`)
```javascript
// Open for better accessibility
dialog.showModal(); // Native method (handles focus trap)
eventBus.publish('INTENT_MODAL_OPEN', ...);

// Close
dialog.close();
eventBus.publish('INTENT_MODAL_CLOSE', ...);
```

---

## 8. Naming Conventions

### Type II (Self-Contained)
- **Export**: `init[Component]System(eventBus)` (singular component name, System suffix)
- **Examples**: initDialogSystem, initToastSystem, initPopoverSystem (not initPopovers)
- **Don't**: initPopovers, initAllComponents, initComponentService
- **Why**: Consistency across all Type II components

### Type III (Service-Backed)
- **Service**: `create[Component]Service(eventBus)`
- **UI**: `init[Component]UI(eventBus)`
- **Examples**: createSliderService + initSliderUI (not initAllSliders)
- **Don't**: initAllSliders (confusing - sounds Type II)

---

## 9. Error Handling

### When to warn (console.warn)
- Optional EventBus (component works in demo mode)
- Non-critical missing elements (graceful degradation)
- Expected failures (user can fix)

### When to throw (throw new Error)
- Contract violations (invalid event payloads)
- Required dependencies missing (Critical Service)
- Security issues (XSS attempts, validation failures)

### Use CSMA Validation
- All event payloads validated with validation library (fork of superstruct)
- Use StructError for validation failures
- Example: `const result = validate(payload, schema);`
