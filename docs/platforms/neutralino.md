+ # Neutralino (Desktop) Overview
+
+ Quick reference for wrapping the CSMA starter inside a Neutralino desktop bundle.
+
+ ---
+
+ ## 1. Prerequisites
+
+ - Node.js 20+
+ - Neutralino CLI (`npm install -g @neutralinojs/neu` or use the binary from https://neutralino.js.org/)
+ - Platform toolchains (Xcode Command Line Tools for macOS, MinGW for Windows cross-builds, etc.)
+
+ ---
+
+ ## 2. Build & Copy
+
+ ```bash
+ npm run build
+ npm run build:desktop:neutralino   # wraps dist/ into platforms/desktop-neutralino/resources
+ ```
+
+ The script copies the minified bundle into `platforms/desktop-neutralino/resources/` and keeps `neutralino.config.json` untouched.
+
+ To run the desktop shell locally:
+
+ ```bash
+ cd platforms/desktop-neutralino
+ neu run
+ ```
+
+ ---
+
+ ## 3. Configuration Touch Points
+
+ - `platforms/desktop-neutralino/neutralino.config.json`
+   - `applicationId`, `modes`, and `url` already point to `resources/index.html`
+ - `resources/` contains the web build; do not edit files here manually—rebuild/copy instead.
+ - Static assets (icons, preload scripts) live under `platforms/desktop-neutralino/resources/` as well.
+
+ ---
+
+ ## 4. Packaging for Release
+
+ 1. `npm run build:desktop:neutralino`
+ 2. `cd platforms/desktop-neutralino`
+ 3. `neu build --release` (generates binaries per OS)
+ 4. Test the produced executables (Linux AppImage, macOS .app, Windows .exe)
+
+ Keep binaries out of source control; attach them to releases if necessary.
+
+ ---
+
+ ## LLM Guidance
+
+ - When automating changes, instruct the LLM to treat `platforms/desktop-neutralino/resources/` as a build artifact—never hand-edit.
+ - For config edits, quote the JSON path (“Set `neutralino.config.json > applicationId` to ...”).
+ - Remind AIs to re-run `npm run build:desktop:neutralino` after modifying web sources so the desktop shell picks up changes.
