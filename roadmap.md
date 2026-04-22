# CSMA Roadmap

## Current State

CSMA is a design-token-first vanilla JS template with a modular runtime.

**Runtime (stable):**
- EventBus, Contracts, ServiceManager, ModuleManager
- Router, RateLimiter, ErrorBoundary, CrossTabLeader
- 20 feature modules

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

| Module | What it does | Key APIs |
|--------|-------------|----------|
| **Auth** | JWT login, register, refresh, logout. Social OAuth (Google, GitHub). Session persistence. | `fetch`, `localStorage`, Web Crypto |
| **Notifications** | Web push notifications. Permission handling. In-app notification center. | Push API, Notification API |
| **Offline / Cache** | Cache strategies (cache-first, network-first). Background sync. Offline indicator. | Service Worker, Cache API, Background Sync |
| **Share** | Web Share API. Copy-to-clipboard fallback. | Web Share API, Clipboard API |
| **File Upload** | Resumable uploads, progress tracking, drag-drop. Chunked upload for large files. | `fetch`, `FileReader`, `FormData` |

## Phase 2 — Engagement (Q3)

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
