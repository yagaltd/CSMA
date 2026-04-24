# Modal System Module

## Purpose

Global modal stack controller for open, close, close-all, stack state, and errors.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `modal` via `ModalService` |
| Contracts | Modal open, close, close-all, stack updated, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.MODAL_SYSTEM`; other modules may consume the modal service.

## Storage / Side Effects

Controls modal state; UI rendering depends on host/modal implementation.

## Tests

`tests/contracts.test.js`.
