# Release Checklist

Use this whenever tagging a CSMA template release. Copy the list into your PR/issue and check items as you complete them.

## 1. Version & Metadata
- [ ] Update `package.json` version
- [ ] Update template manifest versions under `templates/*/template.manifest.json`
- [ ] Update changelog / release notes
- [ ] Update `CSMA_extension_roadmap.md` status if roadmap items changed
- [ ] Regenerate `ai-system-map.json` (`npm run generate-map`)

## 2. Validation
- [ ] `npm run test`
- [ ] `npm run test:smoke`
- [ ] `npm run check:hybrid:perf` (performance budget guard)
- [ ] `npm run validate:templates`
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
- [ ] Ensure `docs/guides/building-modules.md` matches current manifest/registry contracts
- [ ] Update `docs/examples/todo-app.md` if contracts/services changed
- [ ] Confirm `docs/platforms/*.md` reflect current scripts and paths
- [ ] Confirm `README.md`, `AGENTS.md`, and `skills/` match the published extension model
- [ ] Verify changed docs render correctly in your markdown viewer (for example GitHub preview)

## 7. Modules-First Extension Release Checks
- [ ] Confirm `src/runtime/ModuleManifest.js` matches the documented canonical manifest shape
- [ ] Confirm registry services are exposed from runtime boot (`commandRegistry`, `routeRegistry`, `navigationRegistry`, `panelRegistry`, `adapterRegistry`)
- [ ] Verify `ModuleManager.loadModule()` and `unloadModule()` register and remove contributions deterministically
- [ ] Verify deferred plugin work is still clearly marked as out of scope in release notes
## 8. Tag & Publish
- [ ] Commit release artifacts (no `dist/`)
- [ ] Tag `vX.Y.Z`
- [ ] Attach Android/iOS/desktop binaries (optional)
- [ ] Publish release notes with checklist results

Happy shipping.
