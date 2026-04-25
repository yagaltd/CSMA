# Optimistic Sync Module

## Purpose

Local-first action log, CRDT reducer registry, and sync transport for SSMA-backed optimistic updates.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `actionLog`, `optimisticSync`, `optimisticTransport` |
| Contracts | Optimistic action recorded, acked, and failed contracts. |

## Runtime Integration

Loaded with `FEATURES.OPTIMISTIC_SYNC`; runtime wires leader, network status, channel manager, and transport endpoints.

## Storage / Side Effects

Persists/queues local actions and may use WebSocket/HTTP transport endpoints.
Production transport requires same-origin or allowlisted WS/SSE origins and
secure protocols under HTTPS. Incoming server messages pass through
`TransportMessageGuard` before reaching `ChannelManager` or EventBus; invalid
types, oversized payloads, deep JSON, large arrays, forbidden keys, and cursor
replay anomalies publish redacted security violations and fail pending intents.

## Tests

`tests/transport-message-guard.test.js`; add dedicated optimistic-sync tests
before changing reducer, log, or transport behavior.
