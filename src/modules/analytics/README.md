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

## Storage / Side Effects

Writes local analytics batches to `localStorage` and posts batches to the configured endpoint.

## Tests

`tests/contracts.test.js`, `tests/runtime-bootstrap.test.js`, plus consent tests for gating integration.
