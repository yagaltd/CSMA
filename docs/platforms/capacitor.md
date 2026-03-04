+ # Capacitor (Android/iOS) Overview
+
+ Minimal instructions for packaging the CSMA starter into a Capacitor shell. Refer to the official Capacitor docs for anything beyond this quick path.
+
+ ---
+
+ ## 1. Prerequisites
+
+ | Tool | Version | Notes |
+ |------|---------|-------|
+ | Node.js | 20+ | Matches template dev target |
+ | Android Studio | Latest stable | Includes SDK + emulator |
+ | Xcode (macOS) | 15+ | Only needed for iOS |
+ | Capacitor CLI | `npm install -g @capacitor/cli` (optional) | The scripts call local binaries |
+
+ Ensure `ANDROID_HOME` is set and `sdkmanager` installed if you plan to build release APKs.
+
+ ---
+
+ ## 2. Build & Sync
+
+ ```bash
+ npm run build           # standard web build
+ npx cap copy            # sync dist/ into platforms/mobile-capacitor/www
+ npx cap open android    # or ios
+ ```
+
+ Inside Android Studio / Xcode you can run on emulator or device.
+
+ Shortcut script:
+
+ ```bash
+ npm run build:mobile:capacitor
+ ```
+
+ This runs `npm run build` and `npx cap sync` automatically; open the native IDE afterward.
+
+ ---
+
+ ## 3. App IDs & Icons
+
+ - Update `platforms/mobile-capacitor/capacitor.config.ts` → `appId`, `appName`.
+ - Replace icons/splash assets in `platforms/mobile-capacitor/resources/`. Use `npx cap sync` after changes.
+ - Keep CSP identical to web build; Capacitor uses the same `index.html` from `www/`.
+
+ ---
+
+ ## 4. Storage & APIs
+
+ The runtime’s `PlatformService` autodetects Capacitor and unlocks:
+ - Filesystem (`@capacitor/filesystem`)
+ - Camera (`@capacitor/camera`)
+ - Local notifications (`@capacitor/local-notifications`)
+
+ To opt in, import PlatformService in your app/service and check `features`. No additional configuration needed for this template.
+
+ ---
+
+ ## 5. Release Build Checklist
+
+ 1. `npm run build`
+ 2. `npx cap sync android`
+ 3. From Android Studio: Build > Generate Signed Bundle/APK → follow wizard
+ 4. Test on real device (focus on offline + worker flows)
+ 5. Repeat for iOS via Xcode Archive if needed
+
+ Keep Android/iOS specific instructions out of the repo (keystore paths, Apple ID) to preserve template neutrality.
+
+ ---
+
+ ## LLM Guidance
+
+ When prompting an AI to modify the mobile shell, specify exact file paths (e.g., “Edit `platforms/mobile-capacitor/capacitor.config.ts` and change `appId`”). Avoid vague instructions like “update Capacitor config”. This prevents AI agents from editing the wrong environment.
