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

## Tests

Add dedicated optimistic-sync tests before changing reducer, log, or transport behavior.
