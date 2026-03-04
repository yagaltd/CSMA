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
| `src/css/foundation/tokens.css` + `src/css/foundation/themes/*.css` | Semantic color tokens (`--fx-color-*`). Changing these recolors every component. |
| `src/css/base.css` | Global typography, layout resets, scrollbar + selection styling. |

### Step-by-step

1. Open `src/css/foundation/tokens.css` (shared scales) and the matching file in `src/css/foundation/themes/` (light/dark overrides).
2. Update semantic tokens only (example below). Avoid hardcoding colors inside components.

```css
:root {
  --surface-primary: #f6f4ff;
  --text-strong: #130c2f;
  --accent: #684cf4;
}
```

3. For typography or spacing tweaks, edit `src/css/base.css` → `body` + utility sections. Keep variable names consistent (e.g., `--font-body`).
4. Save files—Vite hot reload will refresh instantly.

LLM hint: When instructing an AI to “update the theme,” include the exact variable names and desired values so it patches the foundation token/theme files (not component styles).

---

## 5. Optional: Verify Contracts & Smoke Test

Before branching, run the lightweight suites:

```bash
npm run test        # Contract + validation unit tests
npm run test:smoke  # (Added in v1.0) Todo app DOM smoke test
```

This catches contract regressions and ensures the example app still works.

---

## 6. Next Steps

- Read `docs/guides/building-components.md` to learn Type I–III patterns.
- Check `docs/examples/todo-app.md` (new) for a full reference implementation with ThreadManager + LogAccumulator.
- When ready for mobile/desktop, see `docs/platforms/capacitor.md` & `docs/platforms/neutralino.md`.

With these steps, any contributor can stand up the kit, restyle it, and run the reference app without digging through multiple guides.
