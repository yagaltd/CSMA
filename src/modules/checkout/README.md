# Checkout Module

## Purpose

Cart and payment orchestration around checkout state, submit, reset, completion, and errors.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `checkout` via `CheckoutService` |
| Contracts | Checkout intent, state, completion, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.CHECKOUT_MODULE`; runtime requires `FORM_MANAGEMENT` before loading checkout.

## Storage / Side Effects

May call configured checkout/payment endpoints through host-provided services.

## Tests

`tests/contracts.test.js`; add service tests before expanding payment provider behavior.
