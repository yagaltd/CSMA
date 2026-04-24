# Media Capture Module

## Purpose

Audio recording with MediaRecorder and file-system integration.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `mediaCapture` via `MediaCaptureService` |
| Contracts | Media capture start, stop, cancel, started, stopped, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.MEDIA_CAPTURE`; runtime requires file-system.

## Storage / Side Effects

Uses MediaDevices/MediaRecorder and persists captured media through file-system.

## Tests

`tests/contracts.test.js`.
