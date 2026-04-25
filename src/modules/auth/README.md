# Auth Module

Hybrid browser authentication for cookie sessions, JWT access tokens, and backend-mediated OAuth.

## Purpose

`auth` owns client session state, role checks, and auth EventBus contracts. OAuth flows are mediated by backend endpoints; CSMA never stores client secrets or refresh tokens in browser storage.

## Runtime

Loaded with `FEATURES.AUTH_MODULE`; legacy `FEATURES.AUTH_SERVICE` also loads the module. Exposes `window.csma.auth` and `serviceManager.get('auth')`.

## Config

Use `runtimeConfig.auth` for `baseUrl`, endpoint overrides, `strategy`, storage policy, and OAuth redirect/provider settings.

Production is the default security profile. In production, access tokens must
stay in memory, cookie sessions are the preferred strategy, OAuth state is
cryptographically random, callback state is compared strictly, and redirect
URIs must be same-origin or listed in `security.auth.allowedRedirectOrigins` /
`security.auth.allowedRedirectUris`. Use `securityProfile: "development"` only
for demo storage modes such as `sessionStorage` access tokens.
