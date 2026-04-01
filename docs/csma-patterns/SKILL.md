---
name: csma-patterns
version: "1.0.0"
description: >-
  Expert guidance on building composite UI sections and page layouts in CSMA.
  Covers pattern types (CSS-only layout vs JS-backed EventBus), CSS rules,
  layout anatomy, and the recommended approach for composing starter components
  into reusable page sections. Use when building hero sections, settings
  panels, checkout flows, data tables, or any composite UI surface.
tags:
  - patterns
  - layout
  - composition
  - css
  - eventbus
  - advanced
related_files:
  - src/ui/components/index.css
  - src/css/foundation/utilities.css
  - src/ui/init.js
  - src/runtime/EventBus.js
---

# CSMA Patterns Skill

Guidance for building composite UI sections and page layouts by composing
CSMA components and layout rules.

## Pattern Philosophy

```text
Component = Atomic UI element (button, badge, toast)
Pattern   = Reusable composition of components (hero, settings, checkout)
Module    = Feature/service layer with contracts, registries, and behavior
```

## Core Principle

Build with existing components first.

- If you need a new atomic primitive, create it in `src/ui/components/*`.
- If you need business logic or long-lived state, keep that in a module or
  service.
- If you need a reusable page section, compose components using CSS layout
  and HTML structure.

## Pattern Types

### CSS-Only Layout

Use when the pattern is layout/composition only and components already provide
all interaction.

Example: a hero section using `.stack` layout, a `button`, and a `badge`.

### JS-Backed (EventBus)

Use when the pattern coordinates components, listens to EventBus events, or
manages local state. The JS should follow the same `init(eventBus)` to cleanup
function pattern as Type II components.

## CSS Rules

Use the token contract only:

- Colors: `--background`, `--surface`, `--foreground`, `--border`, `--primary`
- Spacing: `--space-*` scale
- Radius: `--radius-*` scale
- Layout: `.stack`, `.grid`, `.cluster` from `src/css/foundation/utilities.css`

Follow CSMA rendering rules:

1. Use semantic HTML first.
2. Keep visual state in classes or `data-*`.
3. Do not mutate inline styles for UI state.
4. Use existing component class names instead of re-creating primitives.

## Pattern Anatomy

Most patterns follow a predictable structure:

- **Header region** -- title, description, controls
- **Content/body region** -- main content
- **Action/footer region** -- buttons, navigation

Common examples:

- **Hero**: copy + action row
- **Settings**: header + content + actions
- **Data surface**: title + controls + content + summary
- **Flow**: progress + active panel + navigation

## JS Pattern

Return a cleanup function and remove listeners/subscriptions:

```javascript
export function initMyPattern(eventBus, container = document) {
  if (!eventBus) return () => {};

  const cleanups = [];
  const root = container.querySelector('[data-my-pattern]');
  if (!root) return () => {};

  // Subscribe to events, bind handlers
  cleanups.push(eventBus.subscribe('EVENT_NAME', handler));

  return () => cleanups.forEach(fn => fn());
}
```

Do not store business logic in patterns -- use services or modules for that.

## Recommended Approach

1. Identify which starter components to compose from (button, badge, toast).
2. Create CSS for the layout using tokens and utility classes.
3. Add JS only if the pattern coordinates EventBus interactions.
4. Keep patterns focused on layout and composition, not business logic.
5. Validate in both light and dark themes.
