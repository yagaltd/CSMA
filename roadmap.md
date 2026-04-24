# CSMA Roadmap

## Current State

CSMA is a design-token-first vanilla JS template with a modular runtime.

**Runtime (stable):**
- EventBus, Contracts, ServiceManager, ModuleManager
- Router, RateLimiter, ErrorBoundary, CrossTabLeader
- 26 feature modules

**UI (starter set):**
- Badge, Button, Toast
- Example primitives: Card, Field, Input, Theme-toggle

**Demo:**
- Todo app using real EventBus, token-driven CSS

## Scope Boundary

CSMA targets **web and mobile web** (responsive browser). All modules use standard Web APIs available in every modern browser and webview.

Native mobile capabilities (biometric, QR scan, native camera UI, native file system) require platform-specific adapters (Capacitor plugins, Tauri APIs). CSMA does not ship these adapters. The module shell supports adapter injection, but adapters are user-provided.

SSR and SSG are out of scope. CSMA is CSR by design.

## Phase 1 — Core Platform (Q2)

Modules every web app needs.

| Module | Status | What it does | Key APIs |
|--------|--------|-------------|----------|
| **Auth** | Done: v1 module implemented | JWT login, register, refresh, logout. Backend-mediated OAuth. Session persistence. | `fetch`, Web Storage, EventBus |
| **Notifications** | Done: v1 module implemented | Web push notifications. Permission handling. In-app notification center. | Push API, Notification API |
| **Offline / Cache** | Done: v1 composed stack implemented | Cache strategies (cache-first, network-first). Background sync fallback. Offline indicator. | Service Worker, Cache API, Background Sync |
| **Share** | Done: v1 module implemented | Web Share API. Copy-to-clipboard fallback. | Web Share API, Clipboard API |
| **File Upload** | Done: v1 module implemented | Resumable uploads, progress tracking, drag-drop. Chunked upload for large files. | `fetch`, `Blob`, `FormData` |
| **Consent** | Done: v1 implemented | Cookie, terms, privacy, analytics, and preference consent with banner/modal UI patterns. Coordinates with analytics gating without owning legal copy. | `localStorage`, EventBus, Contracts |

### Phase 1 Coverage Audit

| Area | Existing coverage | Gap before implementation |
|------|-------------------|---------------------------|
| Auth | `src/modules/auth/` now owns hybrid cookie/session, JWT access-token, and backend-mediated OAuth flows. Legacy `src/services/core/AuthService.js` delegates to the module. | Optional future work: app-specific OAuth provider examples and login form templates. |
| Notifications | `src/modules/notifications/` now owns explicit permission requests, push subscription, in-app notification center state, and consent gating. | Optional future work: app-specific center layouts and service-worker push event examples. |
| Offline / Cache | `network-status`, `sync-queue`, `storage`, `CacheManager`, `FEATURES.OFFLINE_CACHE`, and `public/sw.js` form the composed offline/cache stack. | Optional future work: browser-level offline smoke tests and app-specific precache recipes. |
| Share | `src/modules/share/` now owns Web Share API calls, clipboard fallback, safe URL validation, and share contracts. | Optional future work: toolbar/menu share button examples. |
| File Upload | `src/modules/file-upload/` now owns validation, chunked/resumable upload policy, progress events, pause/resume/cancel/retry, and thin UI helpers. Legacy upload service delegates to the module. | Optional future work: backend adapter examples for chunk commit/finalize protocols. |
| Consent | `src/modules/consent/` now owns generic consent categories, banner/modal UI, storage migration, analytics compatibility, and tests. | Optional future work: sticky/banner variants and app-specific legal copy examples. |

### Phase 1 Additional
1. Add demo examples for login form, notification center trigger, share button, and upload
   drop zone.
2. Add browser-level smoke coverage for /sw.js registration and offline shell behavior.
3. Commit this in two chunks: existing consent/module README work first, then Phase 1
   modules.


## Phase 2 — Engagement (Q3)

Research Airwallexjs to add another option for payments below: https://www.airwallex.com/docs/developer-tools/sdks/airwallex.js.md

| Module | What it does | Key APIs |
|--------|-------------|----------|
| **Payments** | Stripe Elements checkout. Payment intent flow. | Stripe.js, Payment Request API |
| **Real-time Presence** | Who's online, typing indicators, last-seen. Built on optimistic-sync WebSocket. | WebSocket, `navigator.sendBeacon` |
| **Voice / Speech** | Speech-to-text input. Voice commands. Text-to-speech for accessibility. | Web Speech API |
| **Media Capture** | Camera/mic via `getUserMedia`. Photo capture, screen recording. | `MediaDevices`, `MediaRecorder` |

## Phase 3 — Polish (Q4)

| Module | What it does | Key APIs |
|--------|-------------|----------|
| **Command Palette** | Keyboard-driven command search. Shortcut registry. | KeyboardEvent, `flexsearch` (already in deps) |
| **Onboarding** | Tour steps, feature highlights, empty states. | DOM, CSS transitions |
| **Feedback / NPS** | In-app feedback form, rating prompt, bug reporter with screenshot. | `html2canvas` or `dom-to-image` |

## Forms

Forms are **both module and UI**.

- **UI** (`input/`, `field/`, `button/`): visual state, focus rings, error styling
- **Module** (`form-management/`): validation schema, honeypot detection, submission retry, auto-save, dirty tracking

The existing `form-management` module already handles email regex, required fields, cross-field rules, honeypot injection, offline queuing, and localStorage auto-save.

**What's missing:** Pre-built form templates (login, newsletter, contact). These belong in `demo/` as reference implementations, not in the core template.

## Native Mobile (Not in Roadmap)

The following require platform-specific adapters and are **not planned**:

- Biometric unlock (Face ID / fingerprint)
- QR/Barcode scanning via native camera
- Native file system access
- Native push notifications (APNs/FCM direct)
- Apple Pay / Google Pay native sheets

Users who need these can write a platform adapter matching the `platformAdapter` interface already present in modules like `CameraService` and `FileSystemService`.
