---
name: csma-frontend-design
description: >
  Design and build websites and apps using CSMA's token pipeline, primitives,
  and runtime. Integrates the register system (brand vs product), Three Dials
  configuration, color strategy model, and quality checks from impeccable,
  Hallmark, and Taste Skill — all through CSMA's own tooling.
---

# CSMA Frontend Design Skill

> Build sites and apps the CSMA way. This skill knows CSMA's token pipeline,
> component model, and build scripts — and applies design discipline from
> impeccable (register system, color strategy, anti-patterns), Hallmark
> (pre-emit critique, 8-state components, mobile floor), and Taste Skill
> (Three Dials, content density rules, production-tested tells) through
> CSMA's own tooling. No external skills needed.

---

## How this skill relates to CSMA's existing docs

This is the **design decision layer** that sits above CSMA's infrastructure.
It answers "what should I build?" — CSMA's existing docs answer "how do I
implement it?"

| When to use | Instead of |
|-------------|------------|
| `csma-frontend-design` (this skill) | Installing Hallmark, Taste Skill, or impeccable separately |
| `docs/design/SKILL.md` | Standard CSMA design workflow (no register/dials system) |
| `docs/design-import/SKILL.md` | Importing an external DESIGN.md |
| `docs/css/SKILL.md` + `npx modern-web-guidance` | Modern CSS API reference |

Start here for **any new page or app surface**. Only drop to the other docs
for specialized needs (importing an external brief, looking up a CSS API).

---

## Setup

### 1. Read CSMA context

Before making any design decisions, read these files in order:

1. `DESIGN.md` — existing design brief and token intent
2. `src/style/token-overrides.json` — current token patches
3. `src/generated/tokens.css` — the generated CSS variables in use
4. `docs/design/agent-map.md` — agent workflow reference

If `DESIGN.md` already has a `register` field, use it. Otherwise infer from
the brief (see Section 2).

### 2. Read the brief

Infer these from the user's request. Only ask if genuinely ambiguous (one
question max):

| Signal | If yes → |
|--------|----------|
| "dashboard, settings, admin, tool, app" | `register: product` |
| "landing page, portfolio, brand site, marketing" | `register: brand` |
| User names a brand color / font → | Preserve it, don't override |
| User attached a screenshot / URL → | Extract DNA (structure, not pixels) |

### 3. Declare the design read

One sentence before any code:

> *"Reading this as: a [brand|product] surface for [audience], with [vibe]
> language, [color_strategy] palette, variance [N], motion [N], density [N]."*

Example reads:
- *"Reading this as: a **product** UI for B2B ops teams, restrained palette,
  variance 5, motion 3, density 6."*
- *"Reading this as: a **brand** landing page for a design-conscious consumer
  brand, committed palette, variance 7, motion 5, density 3."*

This one-liner is the contract for everything downstream. If the user corrects
it later, re-run phases 2-4 with the corrected values.

---

## 1. Register system (Brand vs Product)

This is the **most consequential decision** in the skill. It changes typography,
color, motion, layout, and component defaults across the entire output.

### Decision tree

```
What is being built?
        │
    ┌───┴───┐
    │       │
 brand    product
    │       │
    │       └── App UI, dashboard, admin panel,
    │           settings, tool, data table,
    │           authenticated surface, form-heavy
    │           → Load references/register-product.md
    │
    └── Landing page, portfolio, marketing site,
        campaign, about page, content site,
        brand showcase
        → Load references/register-brand.md
```

### Quick cheat sheet

| Dimension | Brand | Product |
|-----------|-------|---------|
| **Typography** | Display + body pairing, fluid `clamp()` scale | One sans family, fixed rem scale |
| **Color** | Committed / Full palette / Drenched — color IS the voice | Restrained — accent for actions + state only |
| **Motion** | One well-rehearsed entrance, scroll-reveal, choreography | 150-250ms transitions, state feedback only, no page-load sequences |
| **Layout** | Asymmetric grids, generous whitespace, imagery-led | Standard navigation (top bar + sidebar, tabs), denser data layouts |
| **Imagery** | Required for image-led briefs (restaurant, hotel, fashion, product) | Screen-driven — components IS the imagery |
| **Cards** | Use deliberately — not the default grouping mechanism | Use for data displays, lists, dashboards |
| **Font attitude** | Distinctive, voice-driven, avoid reflex-reject list | Familiar sans, system fonts OK, one family often right |
| **Anti-patterns** | Brand bans load additionally | Product bans load additionally |

### Applicable bans per register

**Universal bans** (apply to both): See Section 6.

**Additional brand bans** (from `references/register-brand.md`):
- Monospace as lazy "technical" shorthand
- Large rounded-corner icons above every heading
- Zero imagery on brief that implies imagery
- Defaulting to editorial-magazine aesthetics (italic serif drop caps) on non-editorial briefs
- Timid palettes + average layouts ("safe = invisible")

**Additional product bans** (from `references/register-product.md`):
- Decorative motion that doesn't convey state
- Display fonts in UI labels, buttons, data
- Reinventing standard affordances (custom scrollbars, weird form controls)
- Modal as first thought
- Heavy color on inactive states
- Inconsistent component vocabulary across screens

---

## 2. Configuration model

### 2.1 Three Dials

Set these after the register is chosen. Default baseline for most briefs:
**variance 6, motion 4, density 4.**

| Dial | Range | Low (1-3) | Mid (4-7) | High (8-10) |
|------|-------|-----------|-----------|-------------|
| **Variance** | 1-10 | Symmetric, centered, equal columns | Asymmetric splits, offset grids, varied aspect ratios | Masonry, fractional units (`2fr 1fr 1fr`), intentional empty zones |
| **Motion** | 1-10 | CSS transitions only (hover/active) | Entry animations on scroll, `--motion-duration-fast/normal` | Scroll-driven, sticky stacks, horizontal pan, `--motion-duration-slow` |
| **Density** | 1-10 | Art gallery: `--space-4xl` gaps, generous padding | Balanced: `--space-2xl/3xl` gaps | Cockpit: `--space-lg/xl` gaps, compact |

### 2.2 Color strategy

Pick one before picking colors:

| Strategy | What it means | Best for |
|----------|---------------|----------|
| **Restrained** | Tinted neutrals + one accent ≤10% of surface | Product UI default |
| **Committed** | One saturated color carries 30-60% of surface | Brand identity pages |
| **Full palette** | 3-4 named roles, each used deliberately | Brand campaigns, data viz |
| **Drenched** | The surface IS the color | Brand heroes, campaign pages |

### 2.3 DESIGN.md front matter

Update `DESIGN.md` with the chosen values:

```yaml
register: brand | product
color_strategy: restrained | committed | full_palette | drenched
variance: 6
motion: 4
density: 4
```

---

## 3. Token mapping — Design decisions → CSMA tokens

This is the CSMA-specific step. Write `src/style/token-overrides.json` based
on the register and dials, then run `npm run tokens:patch`.

### 3.1 Register → token defaults

```jsonc
// If register is "product":
{
  "primitives.typography.fontFamily.base.$value": "Geist",
  // One family, no display pairing. Fixed rem scale.
  "primitives.typography.fontSize.xs.$value": "0.75rem",
  "primitives.typography.fontSize.base.$value": "0.875rem",
  "primitives.typography.fontSize.lg.$value": "1rem",
  // Tighter spacing for data density
  "primitives.spacing.md.$value": "0.75rem",
  "primitives.spacing.lg.$value": "1rem",
  // Accent for actions + state only
  "themes.light.colors.accent.$value": "oklch(55% 0.15 260)",  // cool blue
  "themes.light.colors.accentForeground.$value": "oklch(98% 0 0)",
  // Motion: 150-250ms, state feedback only
  "primitives.motion.duration.fast.$value": "150ms",
  "primitives.motion.duration.normal.$value": "200ms",
}

// If register is "brand":
{
  // Display + body pairing (avoid reflex-reject list)
  "primitives.typography.fontFamily.base.$value": "Satoshi, sans-serif",
  "primitives.typography.fontFamily.display.$value": "Sentient, serif",
  // Fluid clamp scale for headings
  "primitives.typography.fontSize.xl.$value": "clamp(1.5rem, 3vw, 2rem)",
  // Generous spacing
  "primitives.spacing.md.$value": "1rem",
  "primitives.spacing.lg.$value": "1.5rem",
  // Committed color — accent carries the brand
  "themes.light.colors.accent.$value": "oklch(65% 0.2 30)",   // warm orange
  "themes.light.colors.accentForeground.$value": "oklch(98% 0 0)",
  // Slower, more expressive motion
  "primitives.motion.duration.normal.$value": "400ms",
  "primitives.motion.duration.slow.$value": "600ms",
}
```

### 3.2 Dials → token values

| Dial | Low (1-3) | Mid (4-7) | High (8-10) |
|------|-----------|-----------|-------------|
| **Density → spacing** | `--space-4xl` gaps, `py-24` sections | `--space-2xl/3xl` gaps, `py-16` sections | `--space-lg/xl` gaps, `py-8` sections |
| **Motion → duration** | `fast: 100ms`, `normal: 200ms` | `fast: 150ms`, `normal: 300ms` | `fast: 200ms`, `normal: 500ms` |
| **Variance → layout** | 12-col equal grid, centered | Asymmetric splits (`2fr 1fr`), offset | Masonry, fractional units, empty zones |

The agent applies layout variance in the composed CSS/HTML (not in tokens),
using grid column ratios, alignment choices, and whitespace distribution that
match the variance dial value.

### 3.3 Color strategy → token palette

| Strategy | Token pattern |
|----------|---------------|
| **Restrained** | High-chroma neutrals (zinc/slate), 1 accent ≤10% saturation |
| **Committed** | One saturated carrier color on 30-60% of surface (hero, nav, primary surfaces) |
| **Full palette** | 3-4 distinct roles: primary accent, secondary, success, warning — each deliberate |
| **Drenched** | Background IS the brand color; foreground reversed; minimal neutrals |

### 3.4 After writing overrides

```bash
npm run tokens:patch
npm run lint:styles
```

Open `http://localhost:5173/showcase/token-showcase.html` and inspect the
palette in light, dark, and contrast themes before composing pages.

---

## 4. Component discipline

### 4.1 Type I / Type II (CSMA architecture)

| Type | When | Implementation |
|------|------|---------------|
| **Type I** | Static visual variants, form field styling | CSS only. `data-*` attributes control state. No JavaScript. |
| **Type II** | User action changes app state, async operations | EventBus + Contracts. `init[Component]System(eventBus)` returning cleanup. |

### 4.2 Eight states for every interactive component

Every interactive element (buttons, inputs, links, cards with actions, toggles)
must ship styling for all 8 states:

1. **Default** — resting appearance
2. **Hover** — `:hover`, also `.is-hover` for demo wrappers
3. **Focus** — `:focus-visible` with ≥3:1 visible ring
4. **Active** — `:active`, tactile feedback (`scale(0.98)` or `translateY(1px)`)
5. **Disabled** — `[disabled]`, reduced opacity + no pointer events
6. **Loading** — `[data-state="loading"]`, spinner or pulse
7. **Error** — `[data-state="error"]`, red border, error message below
8. **Success** — `[data-state="success"]`, green check or brief confirmation

```css
.btn:hover, .btn.is-hover { background: var(--color-surface-muted); }
.btn:focus-visible, .btn.is-focus { outline: 2px solid var(--color-focus); }
.btn:active, .btn.is-active { transform: scale(0.98); }
.btn[disabled] { opacity: 0.5; pointer-events: none; }
.btn[data-state="loading"] { /* pulse animation */ }
.btn[data-state="error"] { border-color: var(--color-destructive); }
.btn[data-state="success"] { border-color: var(--color-success); }
```

### 4.3 Enhanced `create-component`

Use `npm run create-component` — it now generates:

```
src/ui/components/Button/
  Button.css           ← 8 states styled
  Button.js            ← Type I/II skeleton
  Button.preview.html  ← Standalone 8-state demo page (delete after review)
```

The preview.html renders all 8 states simultaneously using `.is-hover`,
`.is-focus`, `.is-active` classes alongside real pseudo-classes.

---

## 5. Quality checks

Run these before shipping any page. Sections 5.1-5.3 are **automated**
(npm scripts). Section 5.4 is **agent review**.

### 5.1 Automated: `npm run check:design`

```bash
npm run check:design
```

Checks for all rules in `references/anti-patterns.md`. Key categories:

- Text patterns: no em-dashes, no scroll cues, no section-number eyebrows,
  no generic step labels, no locale strips, no decoration text strips,
  no version labels in hero
- Layout patterns: no side-stripe borders, no gradient text, no ghost-card
  (border + large box-shadow), no 32px+ border-radius on cards,
  no hand-drawn SVG illustrations, no repeating-linear-gradient stripes,
  no `border-t` + `border-b` on every list row
- Hero patterns: fits viewport, ≤4 text elements, subtext ≤20 words,
  top padding ≤ `pt-24`, no trust micro-strip inside, no logo wall inside
- Typography: no italic headers (h1-h3), eyebrow count ≤ ceil(sections/3),
  no Fraunces/Instrument Serif as defaults, 2+1 font cap
- Color: no AI-purple/blue glow default, premium-consumer palette not in
  banned hex ranges, no gray text on colored backgrounds
- Mobile: no horizontal scroll, `overflow-x: clip` not `hidden`,
  no two-line buttons at 320px
- Content: no invented metrics without source, no duplicate CTA intent
- Copy patterns: no "Quietly in use at", no "X theater" / "actually X",
  no em-dashes anywhere
- Brand-specific (if register is brand): has imagery when brief implies it,
  no editorial-magazine default on non-editorial brief
- Product-specific (if register is product): no display fonts in labels,
  no decorative motion, no modal as first thought

### 5.2 Automated: `npm run check:responsive`

```bash
npm run check:responsive
```

- Page renders at 320, 375, 414, 768 px widths
- No horizontal scroll at any width
- Touch targets ≥44×44px on mobile
- No two-line clickable text (buttons, nav links, CTAs)
- Multi-column layouts collapse to single-column below 768px
- Text does not overflow containers at any breakpoint

### 5.3 Agent review: pre-emit self-critique

Before showing any output, score it 1-5 on six axes:

| Axis | Score | Pass if |
|------|-------|---------|
| **P**hilosophy — Does the design fit the brief and register? | 1-5 | ≥3 |
| **H**ierarchy — Is the visual priority clear? | 1-5 | ≥3 |
| **E**xecution — Is the code clean, responsive, accessible? | 1-5 | ≥3 |
| **S**pecificity — Is every choice intentional, not default? | 1-5 | ≥3 |
| **R**estraint — Is there nothing unnecessary? | 1-5 | ≥3 |
| **V**ariety — Is this visually different from the last page? | 1-5 | ≥3 |

If any score < 3, redesign before shipping. Stamp the result:
```css
/* csma-frontend-design · register: brand · variance: 7 · motion: 5 · density: 3
 * critique: P5 H4 E5 S4 R5 V5 */
```

### 5.4 Agent review: copy self-audit

Re-read every visible string on the page. Flag and rewrite any that is:
- Grammatically broken or has unclear referents
- AI-hallucinated (cute-but-wrong wordplay, forced metaphors)
- "X theater" / "actually X" / "Quietly in use at"
- Invented metric without a source (`92%`, `4.1×`, `48k`)
- "Jane Doe" / "Acme Corp" / startup-slop brand names
- Cute-but-wrong em-dash use (banned — use hyphen, comma, or period)
- Performative-craftsman labels ("From the field", "Field notes", "Currently on the bench")
- Scroll cues ("Scroll to explore", bouncing chevrons)
- Version labels in hero (`v0.6`, `BETA`, `INVITE-ONLY`)

Rewrite: pull the dial down if needed. "AI-generated cute copy is worse than
boring copy."

---

## 6. Anti-pattern reference (Universal bans)

These apply to **every** build regardless of register. They are drawn from
the combined rulesets of Hallmark, Taste Skill, and impeccable.

### 6.1 Typography

| Anti-pattern | Rule |
|-------------|------|
| Italic headers | `h1`-`h3` are always `font-style: normal` |
| Inter as default | Pick Geist, Satoshi, Cabinet Grotesk, Outfit, or a brand font |
| Fraunces / Instrument Serif as defaults | Banned. Pick a different serif if one is justified. |
| Reflex-reject fonts | Fraunces, Newsreader, Lora, Crimson, Playfair, Cormorant, Syne, IBM Plex (all), Space Grotesk/Mono, Inter, DM Sans/Serif/Text, Outfit, Plus Jakarta Sans, Instrument Sans/Serif — do not reach for these by default |
| More than 2 display + 1 body family | Cap at 3 total. One well-tuned family beats three timid ones. |
| All-caps body copy | Reserve for short labels ≤4 words |
| Display letter-spacing tighter than -0.04em | Text must not look cramped |

### 6.2 Color

| Anti-pattern | Rule |
|-------------|------|
| AI-purple/blue glow as default | No automatic purple gradients, no neon glows |
| Premium-consumer default palette | Banned hex ranges: `#f5f1ea`-`#fbf8f1` backgrounds, `#b08947`-`#9c6e2a` accents, `#1a1714` text |
| Warm-neutral body bg as "warm brand" | The AI default. Pick a true brand color or chroma-0 off-white. |
| Gradient text | `background-clip: text` + gradient = banned. Use solid color. |
| Gray text on colored background | Use a darker shade of the background hue, or a transparency. |
| Hard-coded colors instead of tokens | Every color must use `var(--color-*)`. Inline OKLCH is banned. |
| Pure black `#000000` | Use off-black (zinc-950, charcoal). |

### 6.3 Layout

| Anti-pattern | Rule |
|-------------|------|
| Side-stripe borders | `border-left`/`border-right` > 1px as colored accent on cards/list items = banned |
| Ghost-card pattern | `border: 1px solid X` + `box-shadow` with ≥16px blur on same element = banned |
| Border-radius 32px+ on cards | Cards max at 12-16px. Full-pill is for tags/buttons only. |
| Hand-drawn SVG illustrations | `feTurbulence`/`feDisplacementMap` grain, sketchy paths, doodle class names = banned |
| `repeating-linear-gradient` stripe backgrounds | Banned as decoration |
| Re-drawn chrome | Fake browser bars, phone frames, IDE windows = banned |
| Three identical feature cards | The equal-card row = banned. Use asymmetric grid, zigzag, or scroll. |
| Eyebrow on every section | Count ≤ `ceil(sectionCount / 3)`. Mechanical limit. |
| Numbered section markers (01/02/03) | Only when the section genuinely IS a sequence. |
| Glassmorphism as default | Blurs and glass cards used decoratively = banned. |
| Hero-metric template | Big number + small label + stats + gradient = SaaS cliché. |
| Cards as default grouping | Use spacing and alignment first. Cards only when hierarchy demands them. |

### 6.4 Content

| Anti-pattern | Rule |
|-------------|------|
| Invented metrics | Every number must come from real data or be labeled as mock |
| Em-dash anywhere | Use hyphen `-`, comma, colon, or period |
| "X theater" / "actually X" copy | "Productivity theater", "engagement theater" = banned |
| "Quietly in use at" / "Quietly trusted by" | Banned. Use natural language or skip the heading. |
| Scroll cues | "Scroll", "↓ scroll", "Scroll to explore" = banned |
| Version labels in hero | `v0.6`, `BETA`, `INVITE-ONLY` = banned unless brief is a launch |
| Locale/time strips | "Lisbon 14:23 · 18°C" = banned unless globally-distributed studio |
| Decoration text strips | "BRAND. MOTION. SPATIAL." at hero bottom = banned |
| Section-number eyebrows | `00 / INDEX`, `001 · Capabilities` = banned |
| Generic step labels | `Stage 1 / Stage 2 / Stage 3` = banned. Use verbs. |
| Pills/labels overlaid on images | Let images speak, or caption below |
| Micro-meta-sentences under headings | "Each of these is a feature we ship today…" = clutter |
| "Jane Doe" / "Acme Corp" | Use creative, realistic, locale-appropriate names |
| Button text wrapping at desktop | Must fit on one line. Shorten label or widen button. |
| Duplicate CTA intent | Same intent ("contact", "signup") → same label everywhere |

### 6.5 Motion

| Anti-pattern | Rule |
|-------------|------|
| Motion without motivation | Every animation must be justifiable in one sentence |
| `window.addEventListener('scroll')` | Hard ban. Use IntersectionObserver, ScrollTrigger, or `useScroll()`. |
| Layout property animation | Animate `transform` and `opacity` only |
| No `prefers-reduced-motion` support | Required for any `motion > 3` |
| Stagger whole sections identically | Each section's reveal should fit its content. Not the same fade-up everywhere. |
| Decorating content that is still loading | Entrance animations before content loads = blank page with motion |

---

## 7. Full workflow summary

```
Phase 0 — Pre-flight
  Read DESIGN.md, token-overrides.json, tokens.css
  Read the brief
  Declare one-line Design Read

Phase 1 — Configure
  Set register (brand | product)
  Set Three Dials (variance / motion / density)
  Set color strategy (restrained | committed | full_palette | drenched)
  Update DESIGN.md front matter

Phase 2 — Patch tokens
  Write token-overrides.json (register + dials → token paths)
  npm run tokens:patch
  npm run lint:styles
  Inspect showcase/token-showcase.html

Phase 3 — Compose
  Compose page from CSMA primitives (Type I / Type II)
  Use enhanced create-component for new components (8 states)
  Reference CSS via var(--color-*), var(--space-*), var(--font-*)

Phase 4 — Verify
  npm run check:design
  npm run check:responsive
  Pre-emit self-critique (P5/H4/E5/S4/R5/V5 — any <3 → redesign)
  Copy self-audit — re-read every visible string
  Stamp output with critique scores
```

---

## 8. Reference files

| File | When to load |
|------|-------------|
| `references/register-brand.md` | When `register` is `brand` |
| `references/register-product.md` | When `register` is `product` |
| `references/anti-patterns.md` | During Phase 4 (check:design) for full rule details |

---

*CSMA Frontend Design Skill v1.0. Integrates rules from impeccable (register
system, color strategy, anti-patterns), Hallmark (pre-emit critique, 8-state,
mobile floor), and Taste Skill (Three Dials, content density, tells) into
CSMA's token pipeline and component model. No external skills required.*
