# Consent Module

## Purpose

Generic consent preferences for optional app capabilities with analytics compatibility.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `consent` via `ConsentService` |
| Contracts | Consent intents, update, acknowledgement, reset, and legacy analytics consent update event. |

## Runtime Integration

Loaded with `FEATURES.CONSENT_MODULE`; legacy `FEATURES.ANALYTICS_CONSENT` also loads it. Exposes `window.csma.consent` and `window.csma.analyticsConsent` alias.

## Storage / Side Effects

Persists to `localStorage` key `csma.consent.v1` and migrates from `csma.analyticsConsent.v1`.

## Tests

`tests/consent-service.test.js`, `tests/consent-ui.test.js`, `tests/runtime-bootstrap.test.js`, `tests/contracts.test.js`.
