# CSMA Todo App Demo

A minimal, working example of a CSMA application.

## What it demonstrates

- **Real CSMA EventBus** — imported from `../src/runtime/EventBus.js`
- **Token-driven CSS** — uses `../src/generated/tokens.css` from `design-tokens.json`
- **Component primitives** — Button, Badge, Input, Field from `../src/ui/components/`
- **Service/DOM separation** — `app.js` holds state logic, `todo-app.js` handles DOM
- **Theme toggle** — light / dark / contrast, persisted in localStorage
- **Two-column layout** — main content + sticky sidebar using layout tokens
- **Phase 1 module examples** — auth login form, notifications center trigger, share action, and upload drop zone
- **Vanilla JS, no build step needed** — open with any static server

## Run

```bash
# From the repo root (not inside demo/)
npm run tokens    # generate CSS from design tokens
npm run dev       # Vite dev server opens the demo

# Or any static server from repo root
python -m http.server 8080
# open http://localhost:8080/demo/
```

> **Note:** This demo uses ES module imports (`import ... from '../src/...'`). It must be served from within the repo structure so the `../src/` paths resolve. Do not copy the `demo/` folder out of the repo and expect it to work standalone.

## Architecture

```
demo/
  index.html       — markup, templates, no inline JS
  app.css          — todo-specific styles + token/component imports
  app.js           — bootstraps EventBus, TodoService, theme toggle, and Phase 1 module examples
  todo-app.js      — DOM layer: subscribes to events, renders UI
```

`app.js` creates the **TodoService** which subscribes to `INTENT_TODO_*` events and publishes `TODO_STATE_CHANGED` state updates. `todo-app.js` subscribes to those state updates and re-renders the DOM.

The layout uses CSMA layout tokens:
- `--layout-container-wide` for page max-width
- `--layout-sidebar` for sidebar width
- `--layout-grid-min-sm` for board view column sizing
