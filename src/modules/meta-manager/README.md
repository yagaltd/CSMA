# Meta Manager Module

## Purpose

Schema.org and SEO helpers layered on the runtime MetaManager.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `metaManagerModule` via `MetaManagerModuleService` |
| Contracts | None. |

## Runtime Integration

Exports starter, content, commerce, local, and core schema helpers for page metadata work.

## Storage / Side Effects

No direct DOM side effects unless called by host code to generate/apply metadata.

## Tests

Covered indirectly by runtime/meta tests; add dedicated schema tests when schema output changes.
