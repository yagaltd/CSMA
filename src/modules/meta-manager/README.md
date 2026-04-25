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
When `FEATURES.I18N` is enabled, the runtime auto-loads `meta-manager` and
initializes it with the active `I18n` service for localized SEO helpers.

## Localized SEO

`meta-manager` owns head-tag output. Page/app code still owns route-specific SEO
composition.

- `applySeoPage(payload)` accepts localized SEO fields including `locale`,
  `canonical`, and `alternates`.
- `bindLocalizedPage(resolvePageMeta)` re-applies localized SEO when
  `LANGUAGE_CHANGED` fires, using `i18n` as the locale source of truth.
- `alternates` uses `{ locale, href }` objects and renders
  `link[rel="alternate"][hreflang]` plus locale Open Graph tags.

## Storage / Side Effects

No direct DOM side effects unless called by host code to generate/apply metadata.

## Tests

Covered indirectly by runtime/meta tests; add dedicated schema tests when schema output changes.
