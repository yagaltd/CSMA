# Legacy — quarantined runtime files

Files in this directory were moved out of `src/` during the audit remediation
(plan 3.4, decision D1). They are **not imported by any `src/` runtime path or
demo**; they are kept as documentation of the SSMA-era full-runtime surface.

## features.js

- **Moved from:** `src/runtime/features.js`
- **What it was:** the SSMA-era full-runtime feature matrix
  (`loadOptionalFeatures` — PWA registration, network-status monitoring,
  auth/session wiring, modals, captcha, import/export, i18n `/locales` fetch,
  thread manager, cache/api wrappers, and the repo's largest `console.log`
  cluster).
- **Why quarantined:** imported only by test files; contained its own
  localStorage adapters and runtime assumptions that no demo uses.
- **Canonical bootstrap today:** `src/runtime/bootstrap.js`. Demos do not
  import it either — demo pages hand-roll their EventBus/service wiring on
  purpose (teaching material).
- **Tests:** the wave/`runtime-bootstrap`/`search-module`/`router-module`/
  `module-gateway-seams` tests import `loadOptionalFeatures` from here purely as
  a setup helper for legacy wiring scenarios.
- **If the full-runtime feature matrix returns:** recover this file from git
  history or the SSMA repo and re-wire it deliberately — do not copy it back
  silently.
