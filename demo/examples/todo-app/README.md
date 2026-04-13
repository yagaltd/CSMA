# Todo App Reference

A full CRUD app demonstrating every core CSMA pattern: EventBus, Contracts, CSS-class reactivity, ThreadManager workers, and LogAccumulator.

---

## Architecture

| Layer | File(s) | Responsibilities |
|-------|---------|------------------|
| UI | `index.html`, `todo.css`, `todo-app.js` | DOM templates, view state, EventBus intents |
| Services | `services/TodoService.js` | Business logic, storage, analytics, worker orchestration |
| Workers | `workers/todoInsights.worker.js` | Stats/insights computation off the main thread |
| Runtime | `src/runtime/EventBus.js`, `src/runtime/LogAccumulator.js`, `src/runtime/ThreadManager.js` | Contract enforcement, logging, worker lifecycle |

Data always flows through EventBus contracts. There are no direct function calls between UI and services.

## EventBus Contracts

| Contract | Direction | Purpose |
|----------|-----------|---------|
| `INTENT_TODO_CREATE` | UI -> Service | Add a task (title, optional metadata) |
| `INTENT_TODO_TOGGLE` | UI -> Service | Flip completion state |
| `INTENT_TODO_DELETE` | UI -> Service | Remove task |
| `TODO_LIST_UPDATED` | Service -> UI | Broadcast normalized state (todos, stats, filters) |
| `LOG_ENTRY` | Service/UI -> LogAccumulator | Structured logs |

Contracts are defined inline in `todo-app.js` and attached to the EventBus instance.

## Storage Strategy

- Primary store: `localStorage` (`todo-app:v2`)
- Compatibility: migrates legacy key `todo-app` on load
- Metadata (activity timeline, stats cache) lives in memory and is recomputed via the worker
- You can swap persistence by replacing the storage adapter in `TodoService` (for example IndexedDB or REST) while keeping the EventBus contract identical

## Running

```bash
npm run dev
npm run test
npm run test:smoke
```

Open `examples/todo-app/index.html` in the dev server to see it running.

## Using This as a Template

Duplicate the `examples/todo-app/` folder, rename contracts, and update the copy. It is a practical starting point for a small CSMA app.
