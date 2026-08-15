# Internationalization Module

## Purpose

Locale and translation management for multi-language apps.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `I18n` |
| Contracts | `LANGUAGE_CHANGED`, `LOCALE_LOADED` |

## Runtime Integration

Loaded with `FEATURES.I18N`; runtime loads `/locales/{locale}.json` based on local storage.
`i18n` owns locale state, translation lookup, and language switching. It does
not own SEO/head-tag rendering. It updates `document.documentElement.lang` and
`document.documentElement.dir`, using locale direction as part of the runtime
source of truth.

## Storage / Side Effects

Reads `localStorage.locale` and fetches locale JSON files.

## Tests

`tests/i18n-rtl.test.js`.
