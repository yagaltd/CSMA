# Optimistic Sync Module

The **Optimistic Sync** module layers a local-first action log and background transport on top of the CSMA EventBus. Enable it via `FEATURES.OPTIMISTIC_SYNC = true` to give your UI instant feedback while the leader tab syncs state to SSMA.

## Architecture

| Component | File | Responsibility |
|-----------|------|----------------|
| `CrossTabLeader` | `src/runtime/CrossTabLeader.js` | Elects a single leader tab (via `navigator.locks` + localStorage fallback). Only the leader opens SSE/WebSocket connections and flushes queued actions. |
| `ActionLogService` | `src/modules/optimistic-sync/services/ActionLogService.js` | Persists intents in localStorage/IndexedDB with metadata (`status`, `attempts`, timestamps) and broadcasts updates across tabs. |
| `OptimisticSyncService` | `src/modules/optimistic-sync/services/OptimisticSyncService.js` | Wraps EventBus intents: applies local updates immediately (`applyLocal`), queues actions, and flushes them when leader+online. Handles ACK/rollback events. |
| DevTools “Optimistic” tab | `src/runtime/devtools/DevPanel.js` | Shows recorded actions, attempts, and errors for debugging. |

## Enabling the Module

```js
// src/config.js
export const FEATURES = {
  // ...
  NETWORK_STATUS_MODULE: true,
  SYNC_QUEUE: true,          // optional but recommended for offline-first flows
  OPTIMISTIC_SYNC: true,
};
```

When `OPTIMISTIC_SYNC` is enabled, `main.js` dynamically loads `optimistic-sync`, initializes the action log and sync service, and exposes them under `window.csma.actionLog` / `window.csma.optimisticSync`.

## Registering Intents

Inside your feature modules, register intents with `OptimisticSyncService` to control optimistic behavior:

```js
const optimisticSync = window.csma.optimisticSync;

optimisticSync.registerIntent('INTENT_TODO_SAVE', {
  applyLocal: (payload) => {
    // immediate UI update (e.g., push into local list)
  },
  flush: async (payload) => {
    await fetch('/api/todos', { method: 'POST', body: JSON.stringify(payload) });
  },
  onAck: () => console.log('Server acknowledged.'),
  onError: (error) => console.warn('Flush failed', error),
  rollback: (payload, entry, error) => {
    // revert UI if terminal failure
  },
  retryDelayMs: 500,
  terminalFailure: (error) => error?.status === 400,
});
```

`applyLocal` runs immediately (even offline), while `flush` executes only on the leader tab when `networkStatus.online === true`. `terminalFailure` lets you define when to stop retrying and trigger `rollback`.

## DevTools Monitoring

Open the DevTools panel in development (`FEATURES.DEVTOOLS = true`) and select the **Optimistic** tab. You can inspect each action’s status, payload, attempts, and errors without attaching a debugger.

- Recent builds add a "Recent Actions" feed and channel telemetry so you can see intents that flushed immediately (no more empty panels when ACKs land within milliseconds).
- Channel snapshots display typed close reasons (`ACCESS_DENIED`, `CLIENT_UNSUBSCRIBED`, etc.) that match the server protocol, which helps debug RBAC or rate-limit issues.

## Authentication & Transport Expectations

The optimistic transport now expects an authenticated SSMA session before it will send writes:

1. **AuthService required** – enable `FEATURES.AUTH_SERVICE = true` so CSMA can call `/auth/me` on load, keep the session cookie fresh, and publish `AUTH_SESSION_UPDATED` when users log in/out.
2. **Cookie-based handshake** – the WebSocket at `/optimistic/ws` reads the `ssma_session` cookie (set by `/auth/login` or `/auth/register`). If the cookie is missing/expired the upgrade fails with `401`, leaving entries in the local `pending` state.
3. **SSE is read-only** – `/optimistic/events` is intentionally laxer (followers can listen without being authenticated), but it never carries ACKs. Writes only drain once the WS handshake succeeds.
4. **Custom endpoints** – if SSMA runs on another origin, set them before boot:

```html
<script>
  window.csma = window.csma || {};
  window.csma.config = {
    apiBaseUrl: 'http://localhost:5050',
    optimisticSync: {
      wsEndpoint: 'ws://localhost:5050/optimistic/ws',
      eventsEndpoint: 'http://localhost:5050/optimistic/events'
    }
  };
</script>
```

## Guest Fallback & `allowGuestOptimistic`

Most public flows (checkout, marketing forms, etc.) should **not** rely on the optimistic transport unless the user is authenticated. The checkout module now mirrors that behavior:

- When the user is logged in (`auth.isAuthenticated() === true`), CSMA registers `INTENT_CHECKOUT_SUBMIT` with `OptimisticSyncService` and the UI shows the optimistic queue widget.
- When the visitor is anonymous, checkout falls back to a direct `checkout.submit` invocation so order numbers still appear instantly and no intents get stuck in `pending`.
- You can override this per build by setting `window.csma.config.optimisticSync.allowGuestCheckout = true` (passed through `main.js` as `allowGuestOptimistic`). Only do this if your SSMA instance issues guest cookies or a separate unauthenticated WS role.

Example guest-friendly configuration:

```js
// Before bootstrapping CSMA (e.g. in checkout.demo.html)
window.csma = {
  ...(window.csma || {}),
  config: {
    ...(window.csma?.config || {}),
    apiBaseUrl: 'http://localhost:5050',
    optimisticSync: {
      wsEndpoint: 'ws://localhost:5050/optimistic/ws',
      eventsEndpoint: 'http://localhost:5050/optimistic/events',
      allowGuestCheckout: false
    }
  }
};
```

If `allowGuestCheckout` is `false` (the default), the optimistic widget hides for guests and the EventBus keeps handling `INTENT_CHECKOUT_SUBMIT` synchronously. Once the user logs in, `AUTH_SESSION_UPDATED` triggers the checkout service to re-register the optimistic intent and the widget springs back to life.

## SSMA Requirements

The backend must:

1. Accept idempotent writes (actions may retry).
2. Return success/failure so the frontend can ACK or rollback entries.
3. Eventually expose SSE/WebSocket invalidation events so hydrated islands know when to refetch.

Until SSE is ready, flush handlers can use REST endpoints; once streaming transport ships, plug it into the same service for faster ACKs. Remember that **ACKs only travel over the authenticated WebSocket**, so either obtain a real SSMA session (recommended) or disable optimistic sync for guests to avoid lingering `pending` entries.
