---
name: csma-observability
description: CSMA observability covering LogAccumulator, analytics, diagnostic snapshots, SEO audit, consent gating, and runtime/public seams. Use when changing logging, telemetry, snapshot export, or observability tests.
---

<!-- version: 1.0.0 | tags: observability, logaccumulator, analytics, telemetry, consent, diagnostics -->

# CSMA Observability Skill

How CSMA handles runtime diagnostics, outbound telemetry, SEO analytics, and
consent after the LogAccumulator refactor.

## Mental Model

Treat observability as two separate subsystems:

- local diagnostics
  - owned by `LogAccumulator`
  - never depends on consent to keep the app debuggable
  - powers structured export and `window.csma.diagnose()`
- outbound telemetry / website analytics
  - owned by `AnalyticsService`
  - consent-gated
  - responsible for page views, custom events, classification, batching, and shipping

`LogAccumulator` may feed `AnalyticsService` only through the explicit
analytics runtime-log bridge. The bridge is off by default and must be enabled
with `runtimeConfig.analytics.collectRuntimeLogs` or
`runtimeConfig.analytics.runtimeLogs.enabled`.

If a change tries to merge these again, that is usually a regression.

## Ownership Boundaries

### `LogAccumulator`

Owns:
- local `log`, `logError`, `logAttack`
- contract-violation capture
- `ErrorBoundary` integration
- diagnostic snapshot entry source
- structured export source

Does not own:
- `trackPageView`
- `track`
- `flush`
- user/session analytics state
- outbound batching
- outbound network delivery for `LOG_ENTRY`

### `AnalyticsService`

Owns:
- page views and custom analytics events
- optional `LOG_ENTRY` bridge when explicitly configured
- event pipeline classification
- security scanning of analytics payloads
- aggregation and batch payload construction
- immediate send for critical/security telemetry
- SEO-enriched page-view telemetry
- consent-aware outbound gating
- lifecycle-safe delivery using `fetchLater`, `sendBeacon`, then fetch keepalive fallback

### Shared runtime seams

- `diagnosticSnapshot` reads local diagnostics and analytics session summaries
- `seoAudit` is reusable by analytics and runtime inspection
- `window.csma` exposes `logAccumulator`, `analytics`, `consent`, `analyticsConsent`, `diagnose()`, and `seoAudit()`

## Pipeline Expectations

Current outbound pipeline:

`raw event -> sanitize -> classify -> security scan -> aggregate/batch/immediate -> flush`

Expected behavior:
- page views usually aggregate by sanitized path
- critical runtime/security telemetry bypasses normal batch delay
- dev noise is discarded in production
- scanner anomalies may upgrade analytics entries into security telemetry
- lifecycle flushes must not block unload and should prefer browser-native deferred delivery

## Production Observability / Privacy Contract

Outbound telemetry is a production data boundary. Treat every new field as user
or environment data until proven otherwise.

Required contract:
- local diagnostics are always local unless an explicit analytics bridge flag is set
- `LOG_ENTRY` forwarding is off by default
- production bridge defaults redact stacks and raw contract payloads
- URL fields must be stripped of query strings and hashes before shipment
- consent scopes gate outbound UI analytics, performance, error-tracking, and security categories
- security/abuse telemetry may be configured as operationally required, but that policy must be documented by the product
- analytics endpoints receive batches shaped as `{ batchId, sessionId, userId, source, meta, entries }`
- no access tokens, auth cookies, form secrets, file contents, or raw user-generated body text may be added to analytics context
- retention, processor/vendor, and user-rights language belongs in the product privacy/cookie documentation before deployment

Recommended runtime config:

```js
runtimeConfig.analytics = {
  endpoint: '/logs/batch',
  collectRuntimeLogs: false,
  runtimeLogs: {
    enabled: false,
    types: ['error', 'promise-error', 'security', 'contract-violation'],
    includeStack: false,
    includePayloads: false
  }
};
```

## Consent Rules

Consent only gates outbound analytics categories.

It does not disable:
- local error logging
- local security logging
- local contract-violation logging
- local diagnostics

Default scopes are split so operational/security diagnostics can remain on while
UI analytics remains opt-in.

## Diagnostic Snapshot

`LogAccumulator.diagnosticSnapshot()` is the canonical diagnostic export.

Expected snapshot families:
- local runtime/error/security diagnostics
- analytics session summaries where relevant
- SEO issue counts derived from page-view audit data

When changing snapshot shape:
- update `window.csma.diagnose()`
- update snapshot/export callers explicitly
- update snapshot tests explicitly

## Editing Rules

- do not add outbound analytics methods back onto `LogAccumulator`
- keep consent logic in the consent module, not in runtime logging
- keep `ErrorBoundary` isolated from batching/transport concerns
- prefer extending `AnalyticsService` pipeline helpers over embedding classification logic in UI code

## Test Focus

When observability changes, verify the right subsystem:

- local diagnostics and error surfaces: `tests/error-handling.test.js`
- runtime/public seam exposure: `tests/runtime-bootstrap.test.js`
- registry/runtime lifecycle interactions: `tests/runtime-lifecycle.test.js`
- consent persistence/UI: `tests/consent-service.test.js`, `tests/consent-ui.test.js`
- contract and validation boundaries: `tests/contracts.test.js`, `tests/validation.test.js`

There is not yet a dedicated `tests/log-accumulator.test.js` or
`tests/analytics-service.test.js` in this repo. If you change those subsystems,
either add focused coverage or extend the runtime/bootstrap, contracts, and
error-handling suites explicitly.
