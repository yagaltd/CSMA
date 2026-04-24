# File Upload Module

Resumable file uploads with progress, chunking, and optional checkpoint persistence.

## Purpose

`fileUpload` owns validation, upload state, chunk progress, pause/resume/cancel/retry, and compatibility with legacy upload imports.

## Runtime

Loaded with `FEATURES.FILE_UPLOAD`. Exposes `window.csma.fileUpload` and `serviceManager.get('fileUpload')`.

## Config

Use `runtimeConfig.fileUpload` for endpoint/transport, chunk size, retry limits, file size/type policy, resumable mode, and preview behavior. It integrates with `file-system`, `sync-queue`, and `network-status` when those modules are enabled.

