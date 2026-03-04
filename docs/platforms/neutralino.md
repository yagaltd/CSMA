# Neutralino (Desktop) Overview

Quick reference for wrapping the CSMA starter inside a Neutralino desktop bundle.

---

## 1. Prerequisites

- Node.js 20+
- Neutralino CLI (`npm install -g @neutralinojs/neu` or use the binary from https://neutralino.js.org/)
- Platform toolchains (for example Xcode Command Line Tools on macOS, MinGW for Windows cross-builds)

---

## 2. Build & Copy

```bash
npm run build
npm run build:desktop:neutralino   # wraps dist/ into platforms/desktop-neutralino/resources
```

The script copies the web build into `platforms/desktop-neutralino/resources/` and leaves `neutralino.config.json` intact.

Run the desktop shell locally:

```bash
cd platforms/desktop-neutralino
neu run
```

---

## 3. Configuration Touch Points

- `platforms/desktop-neutralino/neutralino.config.json`
  - `applicationId`, `modes`, and `url` should target `resources/index.html`
- `platforms/desktop-neutralino/resources/` is a build artifact; do not hand-edit generated web files.
- Static shell assets (icons, preload files) also live under `platforms/desktop-neutralino/resources/`.

---

## 4. Packaging for Release

1. `npm run build:desktop:neutralino`
2. `cd platforms/desktop-neutralino`
3. `neu build --release`
4. Test generated binaries (Linux AppImage, macOS `.app`, Windows `.exe`)

Keep binaries out of git; attach them to release artifacts as needed.

---

## LLM Guidance

- Treat `platforms/desktop-neutralino/resources/` as generated output.
- For config edits, specify exact JSON keys (for example `neutralino.config.json > applicationId`).
- Re-run `npm run build:desktop:neutralino` after web source changes so the shell uses current assets.
