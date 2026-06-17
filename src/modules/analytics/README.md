# Analytics Module

## Purpose

Web analytics tracking, event classification, batching, aggregation, security scanning, and flushing.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `analytics` via `AnalyticsService` |
| Contracts | `ANALYTICS_PAGE_VIEW`, `ANALYTICS_EVENT`, `ANALYTICS_BATCH_FLUSH`, `ANALYTICS_FLUSH_ERROR`. |

## Runtime Integration

Loaded with `FEATURES.ANALYTICS_MODULE`; consumes `window.csma.consent` when the consent module is enabled.

Runtime diagnostics stay local by default. To forward selected `LogAccumulator`
entries, explicitly opt in through analytics config:

```js
runtimeConfig.analytics = {
  endpoint: '/logs/batch',
  collectRuntimeLogs: true
  // or: runtimeLogs: { enabled: true, types: ['error', 'security'], includeStack: false }
};
```

The bridge subscribes to `LOG_ENTRY` only when enabled. It defaults to error,
promise-error, security, and contract-violation entries, and redacts stacks and
raw payloads unless `runtimeLogs.includeStack` / `runtimeLogs.includePayloads`
are explicitly set.

## Storage / Side Effects

Writes local analytics batches to `localStorage` and posts batches to the configured endpoint.
Lifecycle flushes prefer `fetchLater` when available, fall back to
`navigator.sendBeacon`, then to `fetch(..., { keepalive: true })`.

## Tests

`tests/contracts.test.js`, `tests/runtime-bootstrap.test.js`, plus consent tests for gating integration.
