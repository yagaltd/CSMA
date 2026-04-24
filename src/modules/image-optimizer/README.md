# Image Optimizer Module

## Purpose

High-level image optimization powered by media transforms.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `imageOptimizer` via `ImageOptimizerService` |
| Contracts | Image optimize intent, completed, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.IMAGE_OPTIMIZER`; runtime requires media-transform and file-system.

## Storage / Side Effects

Reads/writes image files through file-system and transforms image data in browser APIs.

## Tests

`tests/contracts.test.js`.
