# CSMA Mobile Deployment Instructions

This shell packages the main CSMA app build (`index.html` + `src/main.js`) from `dist/`.
It does not package `examples/todo-app`.

## Build + Sync

```bash
npm run build:mobile:capacitor
```

Notes:
- The build script does not rewrite `capacitor.config.json`.
- The build script does not auto-add `android`/`ios` platforms.

## Open Native IDE

```bash
cd platforms/mobile-capacitor
npx cap open android
# or
npx cap open ios
```

## One-time Platform Add (if needed)

```bash
cd platforms/mobile-capacitor
npx cap add android
npx cap add ios
```
