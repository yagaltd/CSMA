# Release Checklist

Use this whenever tagging a CSMA template release. Copy the list into your PR/issue and check items as you complete them.

## 1. Version & Metadata
- [ ] Update `package.json` version
- [ ] Update changelog / release notes
- [ ] Regenerate `ai-system-map.json` (`npm run generate-map`)

## 2. Validation
- [ ] `npm run test`
- [ ] `npm run test:smoke`
- [ ] `npm run check:hybrid:perf` (performance budget guard)
- [ ] Review `dist/` size (< 25 KB gzip target) via `npm run analyze:bundle`

## 3. Cross-Browser Matrix
Record pass/fail + notes for each target (Chrome, Firefox, Safari, iOS Safari, Android Chrome). Store results in release notes or `docs/testing/browser-matrix.md`.
- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] iOS Safari
- [ ] Android Chrome

## 4. Platform Builds
- [ ] `npm run build:mobile:capacitor` and run on device/emulator
- [ ] `npm run build:desktop:neutralino` and smoke test with `neu run`

## 5. Security Review
- [ ] Confirm CSP still `script-src 'self'`
- [ ] Spot-check LogAccumulator sanitization
- [ ] Verify dev-only DevTools excluded from production build

## 6. Documentation
- [ ] Ensure `docs/guides/getting-started.md` matches current workflow
- [ ] Update `docs/examples/todo-app.md` if contracts/services changed
- [ ] Confirm `docs/platforms/*.md` reflect current scripts and paths
- [ ] Verify changed docs render correctly in your markdown viewer (for example GitHub preview)

## 7. Tag & Publish
- [ ] Commit release artifacts (no `dist/`)
- [ ] Tag `vX.Y.Z`
- [ ] Attach Android/iOS/desktop binaries (optional)
- [ ] Publish release notes with checklist results

Happy shipping.
