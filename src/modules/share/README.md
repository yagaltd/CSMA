# Share Module

Web Share API with clipboard fallback.

## Purpose

`share` normalizes share payloads, validates safe URLs, tries `navigator.share`, and falls back to plain-text clipboard writes.

## Runtime

Loaded with `FEATURES.SHARE_MODULE`. Exposes `window.csma.share` and `serviceManager.get('share')`.

## Config

Use `runtimeConfig.share` for defaults, limits, and optional toast intent feedback.

