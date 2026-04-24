# Notifications Module

Browser notification permission, push subscription, and local notification center.

## Purpose

`notifications` owns explicit permission requests, optional push subscription, an in-app queue, unread state, and notification center actions. It uses toast intents for feedback and does not prompt at boot.

## Runtime

Loaded with `FEATURES.NOTIFICATIONS_MODULE`. Exposes `window.csma.notifications` and `serviceManager.get('notifications')`.

## Config

Use `runtimeConfig.notifications` for consent category, push settings, VAPID public key, storage policy, copy, and center defaults. Push delivery is gated by the consent module when available.

