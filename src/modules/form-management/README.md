# Form Management Module

## Purpose

Form state, validation, submission, reset, field updates, honeypot handling, offline queueing, and auto-save orchestration.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `formManager` via `FormManagementService` |
| Contracts | Form register, update, submit, reset, state, field, submitted, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.FORM_MANAGEMENT`; runtime can pass storage and sync queue services.

## Storage / Side Effects

Can persist form state to configured storage and queue submissions through sync queue.
Autosave defaults to off. Sensitive fields are redacted from emitted events and
omitted from persisted drafts. Forms can declare `fieldPolicies`,
`sensitiveFields`, `persist`, `redact`, `maxLength`, `trim`, and `emit`.
Network submissions must use `trustLevel: "authenticated-network"` or
`"public-network"`; public-network submissions fail closed unless a backend
integrity service with `prepareSubmission(...)` is available.

## Tests

`tests/contracts.test.js`, `tests/form-management-security.test.js`; add
service tests before adding new form templates.
