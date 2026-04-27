# Auth UI Module

`auth-ui` is a module-scoped UI pattern for account flows. It composes existing
CSMA primitives (`.button`, `.field`, `.input`, `.badge`) and delegates behavior
to `auth` plus form preflight to `form-management`.

Load it with `FEATURES.AUTH_UI_MODULE` alongside `AUTH_MODULE` and
`FORM_MANAGEMENT`. The runtime exposes `window.csma.authUI`.

Supported views: `login`, `register`, `forgot-password`, `reset-password`,
`verify-email`, and `status`.

CAPTCHA is opt-in through `runtimeConfig.authUi.captcha`. Defaults stay disabled:

```js
authUi: {
  captcha: {
    register: { required: true },
    forgotPassword: { required: true },
    resetPassword: { required: false },
    resendVerification: { required: true },
    login: { required: false }
  }
}
```

Public apps should enable CAPTCHA for registration, forgot password, and resend
verification flows.
