# CSMA Template Catalog

This folder is the template discovery root for `csma-ssma-cli`.

## Available Templates

- `base-web` (`templateId: csma-base-web`)
  - Lean CSMA web starter with runtime, modules, UI primitives, and docs.
- `web-plus-ssma-client` (`templateId: csma-web-plus-ssma-client`)
  - Web starter intended for SSMA-backed optimistic sync flows.

## Manifest Contract

Each template directory must provide `template.manifest.json` with at least:

- `templateId`
- `engine`
- `runtime`
- `version`
- `schemaVersion`
- `requiredFiles`

The CLI should read manifests from this folder and render template choices dynamically.

## Validation

Run:

```bash
npm run validate:templates
```
