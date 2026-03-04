+ # Todo App Reference (Week 4)
+
+ This example demonstrates every core CSMA pattern in a single, testable app. Use it as the blueprint for new apps before touching production data.
+
+ ---
+
+ ## 1. Architecture Overview
+
+ | Layer | File(s) | Responsibilities |
+ |-------|---------|------------------|
+ | UI | `examples/todo-app/index.html`, `todo.css`, `todo-app.js` | DOM templates, view state, EventBus intents |
+ | Services | `examples/todo-app/services/TodoService.js` | Business logic, storage, analytics, worker orchestration |
+ | Workers | `examples/todo-app/workers/todoInsights.worker.js` | Heavy stats/insights computation off the main thread |
+ | Runtime | `src/runtime/ThreadManager.js`, `src/runtime/LogAccumulator.js`, `src/runtime/EventBus.js` | Contract enforcement, logging, worker lifecycle |
+
+ Data always flows through EventBus contracts—no direct function calls between UI and services.
+
+ ---
+
+ ## 2. EventBus Contracts
+
+ Key intents/events:
+
+ | Contract | Direction | Purpose |
+ |----------|-----------|---------|
+ | `INTENT_TODO_CREATE` | UI → Service | Add a task (title, optional metadata) |
+ | `INTENT_TODO_TOGGLE` | UI → Service | Flip completion state |
+ | `INTENT_TODO_DELETE` | UI → Service | Remove task |
+ | `TODO_LIST_UPDATED` | Service → UI | Broadcasts normalized state (todos, stats, filters) |
+ | `LOG_ENTRY` | Service/UI → LogAccumulator | Structured logs (`type`, `data`, `sessionId`) |
+
+ Contracts live in `src/runtime/Contracts.js`. Any new intent/event must be registered there before use.
+
+ ---
+
+ ## 3. ThreadManager & Worker Flow
+
+ 1. `TodoService` imports `threadManager` and spawns a worker named `todo-insights-worker` pointing to `workers/todoInsights.worker.js`.
+ 2. When todos change, the service posts `{ requestId, todos }` to the worker.
+ 3. Worker computes stats (completion rate, streaks, tag counts) and responds with `{ requestId, stats, insights }`.
+ 4. Service merges the response, updates local cache, and emits `TODO_LIST_UPDATED`.
+ 5. If the worker crashes or times out, the service falls back to synchronous computation and logs a warning via LogAccumulator.
+
+ This pattern keeps the UI responsive even with hundreds of tasks.
+
+ ---
+
+ ## 4. Storage Strategy
+
+ - Primary store: `localStorage` (`todo-app:v2`).
+ - Compatibility: migrates legacy key `todo-app` on load.
+ - Metadata (activity timeline, stats cache) lives in memory and is recomputed via worker.
+ - You can swap persistence by replacing the storage adapter in `TodoService` (e.g., IndexedDB, REST). Keep the EventBus contract identical.
+
+ ---
+
+ ## 5. Logging & DevTools
+
+ - Every user action funnels through `logTodoAction()` which emits `LOG_ENTRY` with `type: 'click'` and `component: 'todo-app'`.
+ - LogAccumulator persists entries in `localStorage` and powers the DevTools panel (dev-only). Use it to trace intents/events without console spam.
+ - Errors surface through the CSP-compliant error boundary defined in `LogAccumulator`.
+
+ ---
+
+ ## 6. Customizing the App
+
+ 1. Theme: edit `src/css/foundation/tokens.css` + `src/css/foundation/themes/*.css`; `todo.css` only references semantic variables.
+ 2. Layout: `todo.css` is scoped to `.todo-app`; you can copy it into your project and adjust grid/flex rules without touching shared components.
+ 3. Services: extend `TodoService` with new intents/events (e.g., `INTENT_TODO_ASSIGN`). Remember to declare the contract first.
+ 4. Workers: add additional workers via ThreadManager if you need ML scoring, large data imports, etc.
+
+ ---
+
+ ## 7. Running the Reference
+
+ ```bash
+ npm run dev          # open /examples/todo-app/
+ npm run test         # contract + validation tests
+ npm run test:smoke   # DOM smoke test covering create/toggle/delete
+ ```
+
+ Smoke test operates headlessly (LightningCSS DOM shim) so it keeps dependencies light.
+
+ ---
+
+ ## 8. When to Use This Example
+
+ - Need to validate a new EventBus contract pattern before rolling it into your app.
+ - Want a working example of ThreadManager + worker communication.
+ - Need a template for structured logging + DevTools integration.
+
+ Duplicate the `examples/todo-app/` folder, rename contracts, and update copy—most teams can build a bespoke MVP in <2 days by following this reference.
