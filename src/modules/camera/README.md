# Camera Module

## Purpose

Photo and video capture with file-system persistence.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `camera` via `CameraService` |
| Contracts | Camera capture intents, completion, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.CAMERA_MODULE`; requires `FEATURES.FILE_SYSTEM` in runtime feature loading.

## Storage / Side Effects

Uses camera/media browser APIs and persists outputs through the file-system module.

## Tests

`tests/contracts.test.js`; add browser/API tests when capture behavior changes.
