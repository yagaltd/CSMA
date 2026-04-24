# Media Transform Module

## Purpose

Client-side media conversion and transformation using browser canvas/Web APIs.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `mediaTransform` via `MediaTransformService` |
| Contracts | Media transform intent, completed, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.MEDIA_TRANSFORM`; consumed by image optimizer.

## Storage / Side Effects

Processes media in memory and may create blobs/object URLs depending on caller.

## Tests

`tests/contracts.test.js`.
