# Anti-patterns — Full rule reference

Used by `npm run check:design` and agent pre-flight review. Every rule is
either **programmatic** (can be checked by CI script) or **manual** (agent
reviews visually).

---

## Text patterns (all programmatic)

| Rule | Check method | Severity |
|------|-------------|----------|
| No em-dash `—` or en-dash `–` in any visible text | Regex | P0 |
| No scroll cues: "Scroll", "↓ scroll", "Scroll to explore" | Regex | P0 |
| No section-number eyebrows: `00 / INDEX`, `001 · Features` | Regex on section headings | P0 |
| No generic step labels: `Stage 1`, `Step 01`, `Phase 01` | Regex | P1 |
| No version labels in hero: `v0.6`, `BETA`, `INVITE-ONLY` | Regex on hero position | P0 |
| No locale/time strips: "Lisbon 14:23 · 18°C" | Regex | P1 |
| No decoration text strips: `BRAND. MOTION. SPATIAL.` | Regex at hero bottom | P0 |
| No "X theater" / "actually X" copy | Regex | P1 |
| No "Quietly in use at" / "Quietly trusted by" | Regex | P0 |
| No micro-meta-sentences under headings | Position + length heuristic | P1 |
| No "Jane Doe" / "Acme Corp" / generic names | Heuristic scan | P1 |
| No invented metrics without source label | Heuristic + data-source check | P0 |
| Eyehrow count ≤ `ceil(sectionCount / 3)` | Regex count per page | P0 |
| No duplicate CTA intent — same label for same action | Text similarity | P1 |
| No emoji in code, markup, headings, or alt text (unless playful register explicitly requested) | Regex | P2 |
| No "Empower" / "Seamless" / "Unleash" / "Next-Gen" / "Game-changer" marketing buzzwords | Regex | P1 |

## Layout patterns (programmatic)

| Rule | Check method | Severity |
|------|-------------|----------|
| No side-stripe borders (`border-left`/`right` > 1px as accent) | CSS selector check | P1 |
| No gradient text (`background-clip: text` + gradient) | CSS property check | P0 |
| No ghost-card (`border` + `box-shadow` ≥16px blur on same element) | CSS property check | P1 |
| No border-radius 32px+ on cards/sections | CSS property check | P1 |
| No hand-drawn SVG illustrations (`feTurbulence`, sketchy paths) | SVG content check | P1 |
| No `repeating-linear-gradient` stripe backgrounds | CSS property check | P1 |
| No re-drawn chrome (fake browser bars, phone frames, IDE windows) | DOM structure check | P0 |
| No pills/labels overlaid on images | DOM structure | P1 |
| No `border-t` + `border-b` on every row of long lists | CSS selector count per container | P1 |
| No three identical feature cards in a row | Layout fingerprint heuristic | P1 |
| No cards as default grouping (use spacing first) | Heuristic | P2 |
| Mobile: no horizontal scroll at any breakpoint | Viewport simulation | P0 |
| Mobile: `overflow-x: clip` not `hidden` on html/body | CSS check | P1 |
| Mobile: no two-line buttons/links at 320px | Viewport simulation | P0 |
| Mobile: touch targets ≥44×44px | Element size check | P1 |
| Mobile: multi-column collapses below 768px | Layout check | P1 |

## Hero patterns (programmatic)

| Rule | Check method | Severity |
|------|-------------|----------|
| Hero fits initial viewport (headline ≤2 lines, subtext ≤20 words, CTA visible) | Layout + word count | P0 |
| Hero ≤4 text elements total | DOM count | P0 |
| Hero top padding ≤ `pt-24` at desktop | CSS check | P1 |
| No trust micro-strip / logo wall inside hero | Section position check | P1 |
| No hero-metric template (big number + small label + stats + gradient) | Pattern match | P1 |

## Color patterns (programmatic)

| Rule | Check method | Severity |
|------|-------------|----------|
| No AI-purple/blue glow as default accent | Color value check | P1 |
| No warm-neutral body bg (`#f5f1ea`-`#fbf8f1` range) as default | Color value check | P1 |
| No gray text on colored backgrounds | Contrast analysis | P0 |
| No hard-coded colors — all via `var(--color-*)` | CSS property check | P0 |
| No pure black `#000000` — use off-black | Color value check | P2 |
| Contrast: body text ≥4.5:1 against background | Contrast analysis | P0 |
| Contrast: large text ≥3:1 against background | Contrast analysis | P0 |

## Typography patterns (programmatic)

| Rule | Check method | Severity |
|------|-------------|----------|
| No italic headers (`h1`-`h3` with `font-style: italic`) | CSS check | P0 |
| No Inter as default font (accept if brand uses it) | Font-family check | P1 |
| No Fraunces or Instrument Serif as default | Font-family check | P1 |
| No fonts from reflex-reject list as default | Font-family check | P2 |
| No all-caps body copy — reserved for short labels only | CSS + text length | P1 |
| Display letter-spacing not tighter than -0.04em | CSS check | P2 |
| No re-drawn chrome (fake browser bars, phone frames, IDE windows) | DOM structure check | P0 |

## Motion patterns (programmatic)

| Rule | Check method | Severity |
|------|-------------|----------|
| No `window.addEventListener('scroll')` — hard ban | JS source scan | P0 |
| Animations use `transform` and `opacity` only, not layout properties | CSS check | P1 |
| `prefers-reduced-motion` support present for motion > 3 | CSS/media query check | P0 |
| Motion claimed = motion shown — if MOTION > 4, page actually animates | Manual | P1 |

## Brand-specific (when `register: brand`)

| Rule | Severity |
|------|----------|
| Has imagery when brief implies imagery (restaurant, hotel, food, travel, fashion, product, photography) | P0 |
| No monospace as lazy "technical" shorthand | P1 |
| No large rounded-corner icons above every heading | P1 |
| No editorial-magazine defaults on non-editorial brief | P1 |
| Not timid palette (safe = invisible on brand) | P1 |

## Product-specific (when `register: product`)

| Rule | Severity |
|------|----------|
| No display fonts in UI labels, buttons, or data | P0 |
| No decorative motion that doesn't convey state | P1 |
| No modal as first thought — inline alternatives first | P1 |
| No reinventing standard affordances (custom scrollbars, weird form controls) | P1 |
| Consistent component vocabulary across screens | P1 |
| Heavy color not used on inactive states | P1 |

---

## Agent manual review checks (not programmatic)

These require the agent to visually inspect the page:

1. **Pre-emit self-critique** — Score P5/H4/E5/S4/R5/V5. Any < 3 → redesign.
2. **Copy self-audit** — Re-read every visible string. Flag broken grammar,
   unclear referents, AI-hallucinated phrases, fake-precise numbers.
3. **Motion motivation** — Every animation justifiable in one sentence.
4. **Diversification** — Different layout fingerprint from previous pages
   (not same macrostructure in a row).
5. **Category-reflex check** — Could someone guess the aesthetic family from
   the category alone? If yes, rework. First-order: obvious from domain.
   Second-order: obvious from category-plus-anti-reference.
