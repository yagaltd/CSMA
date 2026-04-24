# Example Module

## Purpose

Canonical sample for CSMA module manifests, services, contracts, and contribution registries.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `ExampleModuleService` |
| Contracts | `EXAMPLE_MODULE_EVENT` and `EXAMPLE_MODULE_VIEW_RENDERED`. |

## Runtime Integration

Used by registry tests to demonstrate commands, navigation, panels, adapters, and views.

## Storage / Side Effects

No persistent storage or network side effects.

## Tests

`tests/extension-registries.test.js`, `tests/contracts.test.js`.
