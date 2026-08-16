# WebMCP Module

> **Catalog-only module:** not wired into any demo; not yet certified. Run
> `npm run certify:module` before relying on it.

## Purpose

Adapter between the CSMA intent registry and the browser's WebMCP API
(W3C Web Machine Learning CG draft; Chrome early preview). Exposes selected
`INTENT_*` contracts as browser-agent tools: name, description, JSON schema,
and a handler that publishes the intent on the EventBus.

## Public Surface

| Surface | Details |
|---------|---------|
| Service | `webmcp` (`WebmcpService`) — init/destroy, `exposeTools(filter, reason, override)` |
| Contracts | `INTENT_WEBMCP_EXPOSE_TOOLS` (rate-limited), `WEBMCP_TOOLS_REGISTERED` |
| Exports | `WebmcpService`, `WebmcpContracts` |

## Design rules

- **Explicit allowlist only.** Only intents passed to `exposeTools()` (via
  injected `contracts` or an `override.intents` map) are registered — never
  the whole registry by default.
- **Translation only.** The service has no behavior of its own beyond
  contract→tool mapping and publish-on-invoke.
- **Every invocation is contract-mediated.** Agent calls go through
  `eventBus.publish` → schema validation → rate limits. The adapter cannot
  bypass them, which exceeds the draft spec's own security recommendations.
- **Feature-detected, draft-tolerant.** `init({ api })` accepts an explicit
  registration surface; default detection walks known global entry points
  and becomes an inert no-op when none exist. The browser API is unstable —
  hosts pin it via `api` injection.

## Runtime Integration

Loaded via ModuleManager from the manifest when a host wants agent tool
exposure; no dependencies on other modules. Authorization for any tool's
effects stays with companions/SSMA (see `docs/backend_for_modules.md`,
"Agent tool exposure").

## Tests

`tests/webmcp-module.test.js` — mocked-API registration shape,
invocation→publish round trip, no-op without API, explicit-allowlist
enforcement, rate-limit mediation intact.
