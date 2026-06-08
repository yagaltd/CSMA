# CSMA Evolution

> Design quality and API awareness improvements absorbed from `hallmark`,
> `taste-skill`, and `modern-web-guidance` — integrated directly into CSMA's
> own docs, tooling, and agent workflow. No external skill dependencies.

**Philosophy:** CSMA absorbs the best rules internally. The user installs
nothing beyond CSMA itself, the agent reads CSMA's own docs, and `npm run check`
scripts enforce the quality floor.

---

## Table of Contents

1. [What to absorb and why](#1-what-to-absorb-and-why)
2. [Three Dials — Page configuration model](#2-three-dials--page-configuration-model)
3. [Quality checks — `npm run check:design`](#3-quality-checks--npm-run-checkdesign)
4. [Design workflow — Updated agent process](#4-design-workflow--updated-agent-process)
5. [create-component — Enhanced scaffolding](#5-create-component--enhanced-scaffolding)
6. [Modern API awareness](#6-modern-api-awareness)
7. [Adoption roadmap](#7-adoption-roadmap)
8. [What changes and where](#8-what-changes-and-where)

---

## 1. What to absorb and why

### 1.1 From `hallmark`

| Absorb | Why | How |
|--------|-----|-----|
| Pre-emit self-critique (P5/H4/E5/S4/R5/V5) | Forces the agent to review before showing the user. Single highest-leverage practice. | Agent step in `docs/design/SKILL.md` |
| Mobile responsiveness floor — 320/375/414/768 px, no horizontal scroll, no two-line buttons | Most visible quality gap in agent-built sites. | `npm run check:responsive` script |
| 8-state interaction discipline — default/hover/focus/active/disabled/loading/error/success | Makes components feel production-grade. | Enhanced `create-component` + `docs/architecture/SKILL.md` |
| Diversification — no two consecutive pages with same layout fingerprint | Prevents the "same template every time" problem. | Track in agent workflow (`docs/design/SKILL.md`) + optional `project-manifest.json` field |

### 1.2 From `taste-skill`

| Absorb | Why | How |
|--------|-----|-----|
| **Three Dials system** — `VARIANCE` (1-10), `MOTION` (1-10), `DENSITY` (1-10) | Replaces Hallmark's 20-theme approach. Dials map directly to CSMA tokens: VARIANCE → grid asymmetry, MOTION → duration tokens, DENSITY → spacing scale. Cleaner than named themes. | Add to `DESIGN.md` front matter + `docs/design/SKILL.md` as the primary page configuration model |
| **40+ production-tested anti-patterns** — specific, named tells (no em-dashes, no section-number eyebrows, no scroll cues, no decoration text strips, no locale strips, no version labels in hero, no middle-dot proliferation, no pills on images, no border-t+border-b on every row, no micro-meta-sentences, no generic step labels, etc.) | The most concrete, testable rules from any skill. Most can be regex-checked programmatically. | Bulk of `npm run check:design` rule set |
| **Em-dash ban** | #1 AI tell in production tests. Binary, enforceable, near-zero false positives. | Rule #1 in `check:design` |
| **Brief inference** — "Design Read" one-liner before any code | Lightweight protocol: declare the page kind, audience, and vibe in one sentence before building. Zero cost, high impact. | Agent step in `docs/design/SKILL.md` |
| **Content density rules** — hero subtext ≤ 20 words, sub-paragraphs ≤ 25 words, long lists need non-default UI, spec sheet alternatives (grouped chunks / card grids / scroll-snap pills) | Prevent the most common content-quality failures in agent-built sites. | Rules in `check:design` + guidance in `docs/design/SKILL.md` |
| **Eyebrow formula** — max 1 eyebrow per 3 sections, mechanically checkable | `count(upper tracking labels) ≤ ceil(sectionCount / 3)` — a formula, not a guideline. | Rule in `check:design` |
| **Hero discipline** — 4-element max in hero, top padding cap `pt-24`, no trust micro-strip or logo wall inside hero | Concrete constraints for the most visible page section. | Rules in `check:design` + guidance |
| **Copy self-audit** — re-read every visible string, flag broken grammar, unclear referents, AI-hallucinated phrases, fake-precise numbers | "AI-generated cute copy is worse than boring copy." | Agent step in `docs/design/SKILL.md` |
| **Page Theme Lock** — one mode per page, no light/dark section flipping | Prevents a common CSMA mistake (mixing themes mid-page). | Rule in `check:design` |
| **Premium-consumer palette ban** — concrete hex ranges for the AI-default warm-beige+brass+oxblood family, with alternative palettes | CSMA's token system already uses OKLCH, but these named "don't do this" rules are gold. | Rules in `check:design` |
| **Serif discipline** — Fraunces and Instrument_Serif banned as defaults, specific allowed rotation | Most over-used LLM serifs, named explicitly. | Anti-pattern in `DESIGN.md` + `check:design` |

### 1.3 From `modern-web-guidance`

| Absorb | Why | How |
|--------|-----|-----|
| Cutting-edge API lookup for View Transitions, anchor positioning, popover, scroll-driven animations, `content-visibility`, `@scope`, `:user-valid` | CSMA's `docs/css/SKILL.md` covers stable APIs but newer ones go stale tracking manually. | One section added to `docs/css/SKILL.md` — agent runs `npx modern-web-guidance search/retrieve` when needed |

The key difference: modern-web-guidance is a **CLI lookup tool** (not a skill
the user installs or maintains). The agent runs `npx` on demand. Zero setup,
zero config, zero file changes to CSMA itself.

---

## 2. Three Dials — Page configuration model

Replaces both Hallmark's 20-theme catalog and Taste Skill's ad-hoc preset system
with one unified model that maps directly to CSMA tokens.

### 2.1 The model

Every page gets three dials set during design briefing:

| Dial | Range | Default | What it controls |
|------|-------|---------|------------------|
| `VARIANCE` | 1-10 | 6 | Layout asymmetry — grid column ratios, alignment choices, whitespace distribution |
| `MOTION` | 1-10 | 4 | Animation intensity — CSS transitions → scroll-driven → GSAP choreography |
| `DENSITY` | 1-10 | 4 | Spacing scale — `--space-*` selection, padding, section gaps, font scale |

### 2.2 Dial → CSMA token mapping

| Dial value | VARIANCE → Layout | MOTION → Motion tokens | DENSITY → Space tokens |
|------------|-------------------|------------------------|------------------------|
| 1-3 (low) | Symmetric grids, centered, equal columns | Static — CSS transitions only | `--space-4xl` section gaps, generous padding |
| 4-7 (mid) | Asymmetric splits, offset grids, varied aspect ratios | `--motion-duration-fast/normal`, entry animations on scroll | `--space-2xl/3xl` gaps, balanced |
| 8-10 (high) | Masonry, fractional units (`2fr 1fr 1fr`), empty zones | `--motion-duration-slow`, scroll-driven, GSAP sticky stacks | `--space-lg/xl` gaps, compact cockpit |

### 2.3 How it flows into CSMA

```
DESIGN.md front matter:
  register: product
  color_strategy: restrained
  variance: 6
  motion: 4
  density: 4

        ▼
Agent reads docs/design/SKILL.md for dial → token mapping

        ▼
Agent sets token-overrides.json:
  primitives.motion.duration.*  ← gated by motion dial
  primitives.spacing.*           ← gated by density dial
  (layout rules enforced in composed CSS) ← gated by variance dial

        ▼
npm run tokens:patch
```

Dial values live in `DESIGN.md` front matter. The agent references them during
page composition via `docs/design/SKILL.md` (the canonical design skill that
ships with CSMA). No new token files, no external theme system.

### 2.4 Why this beats Hallmark's 20 themes

| Approach | Problem |
|----------|---------|
| Hallmark's 20 named themes | Must be memorized by agent, don't map to CSMA's token structure, require diversification logic across 3 axes |
| Three Dials | 3 numbers → cascade into specific CSS/token decisions. Any combination is valid. Maps directly to CSMA's `--space-*`, `--motion-*`, and layout tokens. No memorization needed. |

---

## 3. Quality checks — `npm run check:design`

A single script that encodes the best rules from all sources. Every rule is
either:
- **Programmatic** (regex/parsing — runs in CI or pre-commit), or
- **Manual** (the agent checks before shipping — documented in workflow)

### 3.1 Automated checks (in `tooling/scripts/check-design.js`)

| Rule | Source | Check method |
|------|--------|-------------|
| No em-dashes (`—` or `–`) in any visible text | Taste Skill | Regex scan of HTML/text output |
| No re-drawn chrome (fake browser bars, phone frames, IDE windows) | Hallmark | DOM structure check |
| No italic headers (`h1`-`h3` with `font-style: italic`) | Hallmark | CSS/selector check |
| No section-numbering eyebrows (`01 / INDEX`, `002 · Features`) | Taste Skill | Regex on section headings |
| No scroll cues (`Scroll`, `↓ scroll`, `Scroll to explore`) | Taste Skill | Text scan |
| No version labels in hero (`V0.6`, `BETA`, `INVITE-ONLY`) | Taste Skill | Text scan |
| No decoration text strips (`BRAND. MOTION. SPATIAL.`) | Taste Skill | Text scan |
| No locale/time strips (`Lisbon 14:23 · 18°C`) | Taste Skill | Regex |
| No pills/labels overlaid on images | Taste Skill | DOM structure check |
| No micro-meta-sentences under eyebrows | Taste Skill | Position + length heuristic |
| No generic step labels (`Stage 1 / Stage 2`, `Step 01`) | Taste Skill | Regex |
| No `border-t` + `border-b` on every row of long lists | Taste Skill | CSS selector count per container |
| No fake-precise invented numbers (`92%`, `4.1×`, `48k` without source) | Hallmark + Taste | Heuristic scan of visible numbers not in source data |
| No italic descender clipping (`y g j p q` in italic headlines) | Taste Skill | Font + text scan |
| Eyebrow count ≤ `ceil(sectionCount / 3)` | Taste Skill | Regex count per page |
| Hero subtext ≤ 20 words | Taste Skill | Word count on hero section |
| Hero ≤ 4 text elements | Taste Skill | DOM count |
| Hero top padding ≤ `pt-24` | Taste Skill | CSS check |
| No trust micro-strip / logo wall inside hero | Taste Skill | Section position check |
| No two CTAs with same intent on one page | Taste Skill | Text similarity + position |
| No duplicate layout family > 1 use per page | Taste Skill | Layout fingerprint heuristic |
| No zigzag (image+text split) 3+ sections in a row | Taste Skill | Layout sequence check |
| Page Theme Lock — no light/dark section flip | Taste Skill | CSS variable consistency |
| Premium-consumer palette not in banned hex ranges | Taste Skill | Color value check |
| No Fraunces or Instrument_Serif as default serif | Taste Skill | Font-family scan |
| Mobile: no horizontal scroll, `overflow-x: clip` not `hidden` | Hallmark | CSS check |
| Mobile: no two-line buttons/links at 320px | Hallmark | Viewport simulation |
| No invented metrics without source annotation | Hallmark | Text scan + data-source check |

### 3.2 Manual checks (agent verifies before shipping)

| Rule | Source |
|------|--------|
| Pre-emit self-critique — score P5/H4/E5/S4/R5/V5, redesign if < 3 on any axis | Hallmark |
| Copy self-audit — re-read every visible string, flag broken grammar, unclear referents, AI-hallucinated phrases | Taste Skill |
| Motion must be motivated — every animation needs a one-sentence justification | Taste Skill |
| Content density — long lists use a non-default UI component, spec sheets use grouped chunks | Taste Skill |
| "Quietly in use at" / "Quietly trusted by" / "From the field" / performative-craftsman labels | Taste Skill |
| No "Jane Doe" / "Acme Corp" / startup-slop brand names | Taste Skill |
| Review structure for consecutive project repetition (diversification) | Hallmark |

### 3.3 Usage

```bash
# Automated checks
npm run check:design       # runs all programmatic rules, exits with score
npm run check:responsive   # mobile floor validation

# Both combined
npm run check:all

# With pre-commit hook (optional)
# package.json:
#   "lint-staged": { "*.html": ["npm run check:design"] }
```

---

## 4. Design workflow — Updated agent process

### 4.1 Current vs. Proposed

```
CURRENT CSMA WORKFLOW:
  Brief → Fill DESIGN.md → Patch tokens → tokens:patch → Compose page → Done

PROPOSED WORKFLOW:

  Phase A — Brief inference
    1. Read the brief
    2. Declare a one-line "Design Read": 
       "Reading this as: <page kind> for <audience>, leaning <vibe>."
    3. Set Three Dials (VARIANCE / MOTION / DENSITY) based on design read
    4. Only ask the user if genuinely ambiguous — otherwise proceed

  Phase B — Configure
    5. Fill DESIGN.md front matter with dials + audience + tone
    6. Write token-overrides.json (dials guide spacing/motion scale)
    7. npm run tokens:patch
    8. Inspect showcase/token-showcase.html

  Phase C — Compose
    9. Compose page from primitives + custom components
    10. Run pre-emit self-critique:
        Score P5 H4 E5 S4 R5 V5
        Any axis < 3 → redesign before shipping

  Phase D — Verify
    11. npm run check:design
    12. npm run check:responsive
    13. Copy self-audit — re-read every visible string
    14. Open page at 320, 375, 414, 768 px — no horizontal scroll,
        no two-line buttons
```

### 4.2 Changes to `docs/design/SKILL.md`

These changes are already applied in v3.0.0 of the file:

- ✅ **Design Read** step (one-line declaration before any code)
- ✅ **Register system** (brand vs product) as the primary design fork
- ✅ **Three Dials** (variance / motion / density) as the page configuration model
- ✅ **Color strategy** (restrained / committed / full_palette / drenched)
- ✅ **Pre-emit self-critique** step (P5/H4/E5/S4/R5/V5 scoring)
- ✅ **Copy self-audit** step
- ✅ **Anti-pattern reference** (universal bans from Hallmark + Taste Skill)
- ✅ **State attribute naming** (normalized to `data-state="loading"` etc.)
- ✅ **8-state component discipline**
- ✅ **Phased workflow** (Phase 0–4)

### 4.3 Changes to `docs/architecture/SKILL.md`

- Document **8-state interaction discipline** for all Type I/II components
- Document the state CSS pattern (`.is-hover`, `.is-focus` classes in addition
  to real pseudo-classes, for demo wrapper use)

### 4.4 Changes to `DESIGN.md`

Front matter updated to the 5-field schema:

```yaml
register: brand | product
color_strategy: restrained | committed | full_palette | drenched
variance: 6
motion: 4
density: 4
```

The old `visual_direction` and `primary_user` fields are replaced by
`register` + `color_strategy` + dials.

Anti-pattern rules added to `App Anti-Patterns` table:
  - No em-dashes in visible text
  - No italic headers (`h1`-`h3`)
  - No re-drawn chrome (fake browser bars, phone frames)
  - No invented metrics without source label
  - No Fraunces or Instrument_Serif as default serif
  - No section-numbering eyebrows
  - No scroll cues
  - No decoration text strips
  - No locale/time strips
  - No pills over image content
  - No generic step labels
  - No "Jane Doe" / "Acme Corp" / startup-slop names
  - No "Quietly in use at" / performative-craftsman copy
  - No fake-perfect numbers without source
  - Max 2 display faces + 1 body face
  - Eyebrow limit: 1 per 3 sections (mechanical)
  - Page Theme Lock: one light/dark mode per page, no flipping

---

## 5. `create-component` — Enhanced scaffolding

Current `npm run create-component` creates `Component.css` + `Component.js`.

Enhanced version adds an **8-state demo wrapper** directly from Hallmark's
component-scope mode:

```
npm run create-component Button

  src/ui/components/Button/
    Button.css           ← Token-driven CSS with ALL 8 states styled
    Button.js            ← Type I/II skeleton
    Button.preview.html  ← 8-state demo wrapper (standalone HTML)
```

### 5.1 Preview.html format

```html
┌──── Button — 8 states ────────────────────────┐
│                                                │
│ default     [ Click me                    ]    │
│ hover       [ Click me                    ]    │  ← .is-hover forces :hover
│ focus       [ Click me                    ]    │  ← .is-focus forces :focus-visible
│ active      [ Click me                    ]    │  ← .is-active forces :active
│ disabled    [ Click me                    ]    │  ← disabled attr
│ loading     [ Working…                    ]    │  ← data-state="loading"
│ error       [ Try again                   ]    │  ← data-state="error"
│ success     [ Saved ✓                     ]    │  ← data-state="success"
│                                                │
└────────────────────────────────────────────────┘
```

The preview.html uses `.is-hover` / `.is-focus` / `.is-active` classes so all
8 states render simultaneously on the demo page. The file is standalone,
deletable after review.

### 5.2 CSS pattern generated

```css
.btn:hover, .btn.is-hover { background: var(--color-surface-muted); }
.btn:focus-visible, .btn.is-focus { outline: 2px solid var(--color-focus); }
.btn:active, .btn.is-active { transform: translateY(1px); }
```

---

## 6. Modern API awareness

### 6.1 What to add to `docs/css/SKILL.md`

A single section at the end. No new files, no installs, no dependencies.

```markdown
## Modern Web APIs — Secondary Lookup

For cutting-edge browser APIs not covered in this guide, refer to the
[modern-web-guidance](https://www.npmjs.com/package/modern-web-guidance)
database. It maintains implementation patterns with Baseline browser data:

```sh
npm run api:guide -- search "view transitions anchor positioning"
npm run api:guide -- retrieve "view-transitions-spa"
```

CSMA targets modern browsers (ES2020+). Baseline Widely available features
are safe without fallbacks. Baseline Newly Available features should use
`@supports` progressive enhancement.
```

With a `package.json` script entry:
```json
"api:guide": "npx -y modern-web-guidance@latest"
```

### 6.2 When to use this

| User says | Run |
|-----------|-----|
| "smooth page transitions" | `npm run api:guide -- search "view transitions"` |
| "scroll-based animations" | `npm run api:guide -- search "scroll-driven animations"` |
| "tooltip that follows anchor" | `npm run api:guide -- search "anchor positioning"` |
| "popup menu without JS" | `npm run api:guide -- search "popover api"` |
| "lazy load offscreen content" | `npm run api:guide -- search "content-visibility"` |
| "optimize LCP image loading" | `npm run api:guide -- search "fetch priority"` |
| "scoped CSS without shadow DOM" | `npm run api:guide -- search "scope css rule"` |
| "form validation after interaction" | `npm run api:guide -- search "user-valid"` |

---

## 7. Adoption roadmap

### Phase 1 — Documentation (week 1, no tooling)

| Task | File | Effort |
|:-----|:-----|:-------|
| Add Three Dials + Design Read to agent workflow | `docs/design/SKILL.md` | 1 hour |
| Add anti-pattern rules (all sources) to DESIGN.md | `DESIGN.md` | 30 min |
| Add 8-state interaction discipline | `docs/architecture/SKILL.md` | 30 min |
| Add modern-web-guidance reference + `api:guide` script | `docs/css/SKILL.md` + `package.json` | 15 min |
| Add pre-emit self-critique step | `docs/design/SKILL.md` | 15 min |
| Add copy self-audit step | `docs/design/SKILL.md` | 15 min |

### Phase 2 — Tooling (week 2-3)

| Task | File | Effort |
|:-----|:-----|:-------|
| Create `check-design.js` — programmatic rules from Sections 3.1 + 6a | `tooling/scripts/check-design.js` → `npm run check:design` | 2-3 days |
| Create `check-responsive.js` — mobile floor validation | `tooling/scripts/check-responsive.js` → `npm run check:responsive` | 1 day |
| Update `create-component` — add 8-state preview.html | `tooling/scripts/create-component.js` | 1 day |

### Phase 3 — Workflow hardening (week 4)

| Task | Effort |
|:-----|:-------|
| Document full workflow in `docs/design/SKILL.md` (Phases A-D) | 1 day |
| Add diversification tracking in agent workflow (check last N pages) | 2 hours |
| Document in `AGENTS.md` the quality workflow + `check:design` usage | 15 min |

### Phase 4 — Optional CI (future)

| Task | Value |
|:-----|:-------|
| `npm run check:design` fails build on P0 violations | CI enforcement |
| Pre-commit hook for `check:design` + `check:responsive` | Catch issues before commit |
| Generate 8-state preview pages for all components in `showcase/` | Component QA surface |

---

## 8. What changes and where

### Files to create

| File | Content |
|:-----|:--------|
| `tooling/scripts/check-design.js` | All programmatic rules from Section 3.1 merged into one script |
| `tooling/scripts/check-responsive.js` | Mobile floor validation (320/375/414/768) |

### Files to modify

| File | What to add |
|:-----|:------------|
| `DESIGN.md` | ✅ `register`/`color_strategy`/`variance`/`motion`/`density` in front matter; anti-pattern rules in App Anti-Patterns section |
| `docs/design/SKILL.md` | ✅ Design Read step, Register system, Three Dials model, color strategy, pre-emit self-critique, copy self-audit, anti-pattern reference, 8-state discipline, full Phases 0-4 workflow |
| `docs/css/SKILL.md` | modern-web-guidance reference section at end |
| `docs/architecture/SKILL.md` | 8-state interaction discipline with CSS patterns |
| `AGENTS.md` | Document the quality workflow (no external skill installs needed) |
| `package.json` | `check:design`, `check:responsive`, `check:all`, `api:guide` scripts |
| `tooling/scripts/create-component.js` | Generate 8-state `.preview.html` with `.is-hover`/`.is-focus`/`.is-active` classes |

### Files to not touch

| File | Reason |
|:-----|:-------|
| `src/style/design-tokens.json` | Base seed — never edit directly |
| `src/generated/tokens.css` | Generated — never edit directly |
| `src/runtime/` | No runtime changes needed |
| `src/ui/components/` | Existing primitives stay unchanged |
| `vite.config.js` | No build changes needed |

---

## Summary — What the user installs

| Component | Install method |
|-----------|---------------|
| CSMA core | `git clone` — unchanged |
| Three Dials model | Absorbed into CSMA docs — **zero install** |
| 40+ anti-pattern rules | Absorbed into `check:design` — **zero install** |
| 8-state component scaffolding | Absorbed into `create-component` — **zero install** |
| modern-web-guidance | `npx` on demand — **zero setup, no config** |
| Mobile floor check | Absorbed into `check:responsive` — **zero install** |

**Total external dependencies for the user: zero.**

No Hallmark install. No Taste Skill install. No modern-web-guidance config.
Everything lives in CSMA's own files.
