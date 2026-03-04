# For LLMs: CSMA Coding Guide

> **For AI Coding Agents**: Use these workflows and rules when generating CSMA code

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [The 8 Rules](#the-8-rules)
- [Workflows](#workflows)
- [Complete Example](#complete-example-note-card)
- [Security Checklist](#security-checklist)
- [Contract Definition](#contract-definition-pattern)
- [Performance Tips](#performance-tips)

---

## Architecture Overview

**CSMA Pattern**: Services communicate via EventBus, CSS handles all rendering

```
User Action 
    → Component publishes INTENT
    → EventBus delivers to subscribers
    → Type II: Component handles intent itself
    → Type III: Service processes, publishes EVENT
    → CSS updates based on classes/data-attributes
```

**3 Component Types**:
- **Type I (Pure CSS)**: No JavaScript - Badge, Card, Avatar
- **Type II (Self-Contained)**: `init[Name]System(eventBus)` - Dialog, Toast, Popover
- **Type III (Service-Backed)**: `create[Name]Service() + init[Name]UI()` - Slider

---

## The 8 Rules

### Rule 1: State Changes = CSS Classes Only
**DO THIS** ✅
```javascript
element.className = 'card completed high-priority';
```
**NOT THIS** ❌
```javascript
element.style.opacity = '1';
element.style.borderColor = 'green';
```
**Why**: CSS class changes are 10x faster (15ms vs 150ms)

---

### Rule 2: Define All States in CSS
**DO THIS** ✅
```css
.card.pending { border-left: 4px solid var(--fx-color-warning); }
.card.completed { border: 4px solid var(--fx-color-success); }
```
**NOT THIS** ❌
```javascript
if (status === 'completed') {
  element.style.borderLeft = '4px solid green';
}
```

---

### Rule 3: Use CSS Custom Properties
**DO THIS** ✅
```css
:root { --fx-color-primary: #3b82f6; }
```
**NOT THIS** ❌
```javascript
element.style.backgroundColor = '#3b82f6';
```

---

### Rule 4: JavaScript Publishes Events, CSS Handles Rendering
**DO THIS** ✅
```javascript
// Service publishes event
eventBus.publish('NOTE_SAVED', note);

// UI subscriber changes class
eventBus.subscribe('NOTE_SAVED', ({ id, status }) => {
  document.getElementById(`note-${id}`).className = `card ${status}`;
});
```
**NOT THIS** ❌
```javascript
function saveNote(note) {
  saveToDatabase(note);
  document.getElementById(`note-${note.id}`).style.opacity = '1';
}
```

---

### Rule 5: Security First
**DO THIS** ✅
```javascript
element.textContent = userInput; // Safe
const validated = validate(userInput);
eventBus.publish('NOTE_SAVED', validated);
```
**NOT THIS** ❌
```javascript
element.innerHTML = userInput; // XSS!
eventBus.publish('NOTE_SAVED', userInput); // No validation!
```

---

### Rule 6: Data Attributes for Complex State
**DO THIS** ✅
```javascript
Object.assign(element.dataset, {
  status: 'pending',
  priority: 'high',
  category: 'urgent'
});
```
**NOT THIS** ❌
```javascript
element.className = 'card pending high priority urgent category';
```

---

### Rule 7: Output Contracts
If you use new events, include contract definition:
```javascript
// Add to src/runtime/Contracts.js
export const NOTE_SAVED = {
  version: 1,
  type: 'event',
  owner: 'note-service',
  schema: object({
    id: string(),
    title: size(string(), 1, 200),
    status: enums(['pending', 'completed'])
  })
};
```

---

### Rule 8: Self-Contained Pattern
**DO THIS** ✅
```javascript
// Type II components subscribe to their own intents
export function initDialogSystem(eventBus) {
  eventBus.subscribe('INTENT_MODAL_OPEN', (payload) => {
    openDialog(payload.modalId);
    eventBus.publish('MODAL_OPENED', { modalId: payload.modalId });
  });
  return () => { /* cleanup */ };
}
```
**NOT THIS** ❌
```javascript
// Don't create separate Service for simple components
class DialogService { openDialog(id) { /* ... */ } } // Overkill!
```

---

## Workflows

### Workflow A: Build from Scratch (Recommended)
**When**: New visual components
**Strategy**: Visualize First, Connect Later

**Stage 1: HTML/CSS** (Context: `src/css/foundation/tokens.css`)
```markdown
# Role: Expert UI Engineer
# Task: Build [Component Name] with semantic HTML + CSS variables
# Requirements:
1. HTML-First (use <dialog>, <button>, <input>)
2. Use CSS variables from the foundation token files
3. Use data-state for interaction states
4. No JS logic (validation goes in Service)
5. Output: HTML file with embedded CSS
```

**Stage 2: Add EventBus** (Context: `Contracts.js`, `init.js`, `dialog.js`, `SliderService.js`)
```markdown
# Role: CSMA Architecture Specialist
# Task: Convert vanilla JS to CSMA component

Choose Pattern:
- Type II: init[Name]System(eventBus) for Dialog/Popover/Tabs/Toast
- Type III: create[Name]Service() + init[Name]UI() for Slider/Complex Forms

Rules:
1. Subscribe to INTENT_[NAME]_* events (self-contained)
2. Replace addEventListener with eventBus.publish('INTENT_...')
3. Return cleanup function
4. Register in src/ui/init.js

Output: Component code + Contracts + init.js registration
```

### Workflow B: Restyle Existing Markup
**When**: You have HTML, need new look
**Context**: `src/css/foundation/tokens.css`
**Task**: Style with CSS variables, preserve structure

### Workflow C: Legacy Migration
**When**: Component uses DOM manipulation, needs EventBus
**Task**: Run Workflow A Stage 2 on existing file

---

## Complete Example: Note Card

```javascript
// ✅ CORRECT CSMA Pattern

// 1. Service handles business logic
class NoteService {
  saveNote(noteData) {
    const validated = this.validateNote(noteData);
    const note = { ...validated, id: crypto.randomUUID() };
    this.saveToStorage(note);
    this.eventBus.publish('NOTE_SAVED', note);
  }
}

// 2. UI subscribes and renders
class NoteUI {
  init() {
    this.eventBus.subscribe('NOTE_SAVED', this.renderNote.bind(this));
  }
  
  renderNote(note) {
    const template = document.getElementById('note-card');
    const card = template.content.cloneNode(true);
    const cardEl = card.querySelector('.card');
    
    // Set ID and state
    cardEl.id = `note-${note.id}`;
    Object.assign(cardEl.dataset, {
      status: note.status,
      priority: note.priority,
      category: note.category
    });
    
    // CSS-class pattern
    cardEl.className = `card ${note.status}`;
    
    // textContent for security
    card.querySelector('.title').textContent = note.title;
    card.querySelector('.text').textContent = note.text;
    
    this.container.appendChild(card);
  }
}
```

```css
/* 3. CSS defines all visual states */
.card.pending {
  opacity: 0.7;
  border-left: 4px solid var(--fx-color-warning);
}

.card.completed {
  opacity: 1;
  border: 4px solid var(--fx-color-success);
}

.card[data-priority="high"] {
  box-shadow: var(--shadow-lg);
}

.card[data-category="urgent"]::before {
  content: "🔥 ";
}
```

---

## Security Checklist

When generating CSMA code, always:
- [ ] Use `textContent` instead of `innerHTML` for user data
- [ ] Validate all payloads with validation contracts
- [ ] Sanitize LLM inputs with `sanitizeLLMInput()`
- [ ] Check rate limits for user actions
- [ ] Use CSP headers in HTML
- [ ] Never trust external data (localStorage, API, URL params)
- [ ] **ALWAYS output the `Contracts.js` code block for any new Event or Intent used**

---

## Contract Definition Pattern

```javascript
export const NOTE_SAVED = {
  version: 1,
  type: 'event',
  owner: 'note-service',
  lifecycle: 'active',
  stability: 'stable',
  compliance: 'public',
  
  security: {
    rateLimits: {
      perUser: { requests: 10, window: 60000 }
    }
  },
  
  schema: object({
    id: string(),
    title: size(string(), 1, 200),
    text: size(string(), 1, 16000),
    status: enums(['pending', 'completed', 'failed']),
    timestamp: number()
  })
};
```

---

## Performance Tips

Fastest (use these):
1. **className** - Fastest (single reflow)
2. **dataset** - Fast + semantic
3. **classList** - Fast + precise
4. **CSS variables** - Fast for dynamic values
5. **hidden attribute** - Fast for show/hide

Avoid:
- `innerHTML` (XSS + slow)
- Direct `style.property` manipulation (triggers reflow per property)
- Reading layout properties (`offsetHeight`, `getBoundingClientRect`)

---

## Reference Files

- `src/runtime/Contracts.js` - Event definitions
- `src/ui/init.js` - Component initialization
- `src/css/foundation/tokens.css` - CSS variables
- `src/ui/components/dialog/dialog.js` - Type II example (Perfect)
- `src/services/SliderService.js` - Type III example (Perfect)

---

**Result**: Lean (17KB), fast (15ms updates), secure (6 defense layers), maintainable!
