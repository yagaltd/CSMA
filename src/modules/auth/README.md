# Auth Module

Hybrid browser authentication for cookie sessions, JWT access tokens, and backend-mediated OAuth.

## Purpose

`auth` owns client session state, role checks, and auth EventBus contracts. OAuth flows are mediated by backend endpoints; CSMA never stores client secrets or refresh tokens in browser storage.

## Runtime

Loaded with `FEATURES.AUTH_MODULE`; legacy `FEATURES.AUTH_SERVICE` also loads the module. Exposes `window.csma.auth` and `serviceManager.get('auth')`.

## Config

Use `runtimeConfig.auth` for `baseUrl`, endpoint overrides, `strategy`, storage policy, and OAuth redirect/provider settings.

Default endpoints:

| Flow | Method | Endpoint |
|:--|:--|:--|
| Register | `register(values)` | `/auth/register` |
| Login | `login(values)` | `/auth/login` |
| Logout | `logout(values)` | `/auth/logout` |
| Session status | `refreshSession()` | `/auth/me` |
| Forgot password | `forgotPassword(values)` | `/auth/forgot-password` |
| Reset password | `resetPassword(values)` | `/auth/reset-password` |
| Verify email | `verifyEmail(values)` | `/auth/verify-email` |
| Resend verification | `resendVerification(values)` | `/auth/resend-verification` |
| OAuth start/callback | `startOAuth`, `handleOAuthCallback` | `/auth/oauth/start`, `/auth/oauth/callback` |

`auth-ui` is the approved module-scoped UI layer for these flows. It lives under
`src/modules/auth-ui/`, composes existing primitives, registers forms with
`form-management`, and calls this service for auth behavior. Do not add
auth-specific primitives under `src/ui/components/`.

For SSMA backends, prefer HttpOnly Secure SameSite cookie sessions and keep
refresh tokens server-side. Browser access-token storage is rejected in
production unless it stays in memory.

Production is the default security profile. In production, access tokens must
stay in memory, cookie sessions are the preferred strategy, OAuth state is
cryptographically random, callback state is compared strictly, and redirect
URIs must be same-origin or listed in `security.auth.allowedRedirectOrigins` /
`security.auth.allowedRedirectUris`. Use `securityProfile: "development"` only
for demo storage modes such as `sessionStorage` access tokens.
