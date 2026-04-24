# Network Status Module

## Purpose

Online/offline detection and latency sampling.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `networkStatus` via `NetworkStatusService` |
| Contracts | Network refresh intent, status changed, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.NETWORK_STATUS_MODULE`; required by sync queue.

## Storage / Side Effects

Listens to browser online/offline events and may perform latency checks.

## Tests

`tests/contracts.test.js`.
