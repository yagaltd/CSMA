# Internationalization Module

## Purpose

Locale and translation management for multi-language apps.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `I18n` |
| Contracts | None. |

## Runtime Integration

Loaded with `FEATURES.I18N`; runtime loads `/locales/{locale}.json` based on local storage.

## Storage / Side Effects

Reads `localStorage.locale` and fetches locale JSON files.

## Tests

`tests/i18n-rtl.test.js`.
