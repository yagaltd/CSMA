# CSMA Desktop Deployment Instructions

This shell packages the main CSMA app build (`index.html` + `src/main.js`) from `dist/`.
It does not package `examples/todo-app`.

## Build + Sync

```bash
npm run build:desktop:neutralino
```

Notes:
- The build script does not rewrite `neutralino.config.json`.
- The build script preserves `resources/js/neutralino.js` when present.

## Development

```bash
cd platforms/desktop-neutralino
neu run
```

## Distribution

```bash
cd platforms/desktop-neutralino
neu build --release
```
