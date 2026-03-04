# Capacitor (Android/iOS) Overview

Minimal instructions for packaging the CSMA starter into a Capacitor shell. Refer to the official Capacitor docs for advanced native configuration.

This flow packages the main CSMA app build (`index.html` + `src/main.js`), not `examples/todo-app`.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Matches template dev target |
| Android Studio | Latest stable | Includes SDK + emulator |
| Xcode (macOS) | 15+ | Needed for iOS builds |
| Capacitor CLI | `npm install -g @capacitor/cli` (optional) | Scripts can also use local binaries |

Ensure `ANDROID_HOME` is set and Android SDK tools are installed if you plan to ship APK/AAB builds.

---

## 2. Build & Sync

```bash
npm run build                   # standard web build
npx cap copy                    # sync dist/ into platforms/mobile-capacitor/www
npx cap open android            # or ios
```

Shortcut script:

```bash
npm run build:mobile:capacitor
```

This script runs the web build and sync flow for the Capacitor shell.
It does not rewrite `capacitor.config.json` and does not auto-add native platforms.

---

## 3. App IDs & Assets

- Update `platforms/mobile-capacitor/capacitor.config.json` (`appId`, `appName`).
- Update web icons/manifest under `public/` (for example `public/icons/` and `public/manifest.json`) and rebuild.
- Keep CSP identical to web build; Capacitor reuses `index.html` from `www/`.

---

## 4. Storage & APIs

The runtime `PlatformService` autodetects Capacitor and can enable:
- Filesystem (`@capacitor/filesystem`)
- Camera (`@capacitor/camera`)
- Local notifications (`@capacitor/local-notifications`)

Enable or gate related features from `src/config.js` and service registration.

---

## 5. Release Build Checklist

1. `npm run build:mobile:capacitor`
2. `npx cap open android` (or `ios`)
3. Build signed artifacts in Android Studio / Xcode
4. Test on real devices (offline, workers, and permissions)

Keep keystore paths, credentials, and Apple account details outside this repository.

---

## LLM Guidance

When prompting an AI to modify Capacitor setup, provide exact file paths (for example `platforms/mobile-capacitor/capacitor.config.json`) and exact keys to change.
