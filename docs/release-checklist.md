+ # Release Checklist
+
+Use this whenever tagging a CSMA template release. Copy the list into your PR/issue and check items as you complete them.
+
+## 1. Version & Metadata
+- [ ] Update `package.json` version
+- [ ] Update changelog / release notes
+- [ ] Regenerate `ai-system-map.json` (`npm run generate-map`)
+
+## 2. Validation
+- [ ] `npm run test`
+- [ ] `npm run test:smoke`
+- [ ] `npm run qa:perf` (Lighthouse + bundle report)
+- [ ] Review `dist/` size (< 25 KB gzip) via `npm run analyze:bundle`
+
+## 3. Cross-Browser Matrix
+Record “pass/fail + notes” for each target (Chrome, Firefox, Safari, iOS Safari, Android Chrome). Store results in `/docs/testing/browser-matrix.md`.
+- [ ] Chrome (desktop)
+- [ ] Firefox (desktop)
+- [ ] Safari (desktop)
+- [ ] iOS Safari
+- [ ] Android Chrome
+
+## 4. Platform Builds
+- [ ] `npm run build:mobile:capacitor` → run on device/emulator
+- [ ] `npm run build:desktop:neutralino` → smoke run `neu run`
+
+## 5. Security Review
+- [ ] Confirm CSP still `script-src 'self'`
+- [ ] Spot-check LogAccumulator sanitization
+- [ ] Verify dev-only DevTools excluded from `dist/`
+
+## 6. Documentation
+- [ ] Ensure `docs/guides/getting-started.md` matches latest workflow
+- [ ] Update `docs/examples/todo-app.md` if contracts/services changed
+- [ ] Confirm `docs/platforms/*.md` reflect newest scripts
+
+## 7. Tag & Publish
+- [ ] Commit release artifacts (no `dist/`)
+- [ ] Tag `vX.Y.Z`
+- [ ] Attach Android/iOS/desktop binaries (optional)
+- [ ] Publish release notes referencing checklist results
+
+Happy shipping!
