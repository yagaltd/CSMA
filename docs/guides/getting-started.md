# Getting Started with the CSMA Kit

> Goal: Go from `git clone` to a themed, running dev server in under five minutes. These steps are written so humans **and** LLM contributors can follow the exact same workflow.

---

## 1. Prerequisites

- Node.js 20+ (LTS) and npm 10+
- Git
- Optional: Android Studio / Neutralino CLI (for platform builds later)

Verify setup:

```bash
node -v
npm -v
git --version
```

If any command fails, fix your environment before proceeding.

---

## 2. Clone & Install

```bash
git clone <your-repo-url> csma
cd csma
npm install
```

What happens:
- Installs Vite + runtime deps (<10 MB)
- Runs `postinstall` to generate `ai-system-map.json` (`npm run generate-map`)

LLM hint: when asking an AI to run commands, give the full block above so it never forgets to `cd` into the repo.

---

## 3. Run the Dev Server

```bash
npm run dev
```

Visit `http://localhost:5173` and open the DevTools badge to verify logs are flowing. Hot reload is enabled by default.

For the UI library itself, open `src/ui/components/index.html`. The explorer is the canonical component entrypoint and every registered component links to its own standalone demo page.

Want a production build?

```bash
npm run build:prod
```

Outputs go to `dist/` with terser minification and dev-only code removed.

---

## 4. Customize Theme & Base Styles

Most teams tweak two files immediately:

| File | Purpose |
|------|---------|
| `src/css/theme.css` + `src/css/foundation/themes/*.css` | Shared theme contract plus light/dark values. Changing these updates every component. |
| `src/css/base.css` | Global typography, layout resets, scrollbar + selection styling. |

### Step-by-step

1. Open `src/css/theme.css` for shared scales and recipe defaults, plus the matching file in `src/css/foundation/themes/` for light/dark color values.
2. Update semantic tokens only for broad visual changes. Avoid hardcoding colors inside components.

```css
:root {
  --background: #fffdf8;
  --foreground: #201a12;
  --primary: #8b5cf6;
}
```

3. For typography, spacing, or component recipe tweaks, edit `src/css/theme.css` first and `src/css/base.css` second.
4. Save files—Vite hot reload will refresh instantly.

LLM hint: When instructing an AI to "update the theme," point it at `src/css/theme.css` and `src/css/foundation/themes/*.css`, not component styles.

---

## 5. Optional: Verify Contracts & Smoke Test

Before branching, run the lightweight suites:

```bash
npm run test        # Contract + validation unit tests
npm run test:smoke  # (Added in v1.0) Todo app DOM smoke test
npm run check:ui-library
```

This catches contract regressions, missing demo coverage, stale library references, and ensures the example app still works.

---

## 6. Next Steps

- Read `docs/guides/building-components.md` to learn Type I–III patterns.
- Read `docs/guides/integrating-components.md` if you want to copy CSMA components into an existing app instead of running the full repo.
- Check `docs/examples/todo-app.md` (new) for a full reference implementation with ThreadManager + LogAccumulator.
- When ready for mobile/desktop, see `docs/platforms/capacitor.md` & `docs/platforms/neutralino.md`.

With these steps, any contributor can stand up the kit, restyle it, and run the reference app without digging through multiple guides.
