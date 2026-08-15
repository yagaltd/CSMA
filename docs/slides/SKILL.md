---
name: csma-slides
description: >-
  Build a premium PRESENTED slide deck — classic one-slide-at-a-time slides you
  advance with a clicker — as a CSMA app. Slides are RESPONSIVE (reflow to any
  screen, no fixed canvas) and fully interactive. Use this when the user asks
  for a presentation, pitch deck, slide deck, or any talk you'll PRESENT
  (projector, screen-share). The CSMA runtime IS the app — theme the tokens,
  author slides as JSON, build and present.
---

# CSMA Slides — Agent Authoring Skill

This skill is the agent's entry point for building decks. It contains
everything needed: layout selection rules, JSON config schema, writing
discipline, theme surface, and the build/present loop. Slides are written as a
single `deck.json` config — the agent never writes JS, CSS, or HTML for slides.

## Architecture context (read once)

Slides sit in CSMA's **layered rendering model**:

```
LAYER 3  SlideDeckService   next / prev / build / presenter — owns navigation
LAYER 2  Slide layouts       cover, bento, stat-grid, …  (24 factories)
LAYER 1  aiui composer       mount / unmount / setState   ← rendering pipeline
LAYER 0  CSMA components     button, card, badge, mind-node, …
```

The deck **state machine** (Layer 3) is slide-specific and stays. The
**layouts** (Layer 2) emit spec trees consumed by the **aiui composer**
(Layer 1). Because every layout renders through aiui, any catalog surface
— `comments-thread`, `video-player`, `chart-display`, `mindmap-canvas`,
future modules — can embed inside any slide.

See `docs/architecture/SKILL.md` § *Layered Rendering Architecture* for the
full contract.

## Embedding aiui surfaces inside slides (Phase 2.2)

Any layout that consumes a `media` slot (`split`, `spotlight-card`) accepts
a surface reference:

```json
{
  "type": "split",
  "kicker": "Q&A",
  "title": "Comments inside a slide",
  "body": "The right panel is a live comments thread.",
  "media": {
    "type": "surface",
    "component": "comments-thread",
    "props": { "threadId": "slide-3-q-and-a" }
  }
}
```

When the composer mounts the slide, it resolves `component: 'comments-thread'`
via `serviceManager.get('comments').mountSurface(...)`. The owning module
owns the rendering inside the slot; the slide just provides the slot.

**Catalog of embeddable surfaces:** `comments-thread`, `chart-display`,
`mindmap-canvas`, `video-player` (forward-declared). Run
`npm run generate-ai-ui-catalog` to see the live list, or read
`src/modules/ai-ui/catalog/componentCatalog.js`.

**Dock UX:** the dock includes a 💬 button that publishes
`INTENT_SLIDE_TOGGLE_COMMENTS`. `SlideDeckService.toggleComments()` adds
or removes the surface on the current slide's media slot and re-renders.
Agents can publish the same intent to drive embedding programmatically.

**Wiring requirement:** for an embedded surface to render, the host app
must register the owning module's service with `ServiceManager` AND pass
the composer to `mountDeck(container, service, eventBus, { composer })`.
See `demo/slides.html` for the wiring pattern. Without it, the dock button
still toggles the spec, but the composer throws "module not loaded" when
trying to mount.

## 0. Required reading chain

Load these CSMA docs before authoring:

1. `docs/architecture/SKILL.md` — CSMA rules (textContent, data-*, CSS state)
2. `docs/animation/SKILL.md` — CSS-first motion, reduced-motion, GSAP escalation
3. `docs/patterns/SKILL.md` — layout recipes, Type I/II, token reference
4. `docs/security/SKILL.md` — input sanitization, contract validation
5. `src/style/generated/tokens.css` — available tokens (read, don't edit)

## 1. Grounding the deck (Step 0)

Use the user's real topic, brand, document, facts. **Never fabricate a
placeholder company, logo, or quote for a real subject.** If a brand is given,
the theme comes from that brand — fetch the page for real colors/font, or use
the brand's known palette, or STOP and ask. Report which colors/fonts you used
and where from.

## 2. Theme surface

All color, type, radius, depth, and motion live in `--*` tokens in
`src/style/generated/tokens.css`. The slides module **consumes** these tokens —
never creates new ones. Edit `src/style/token-overrides.json` then run
`npm run tokens:patch` for app-specific overrides. Set fonts in
`--font-family-base` / `--font-family-heading`. Dark vs light:

```js
document.documentElement.dataset.theme = 'light' | 'dark';
```

**Tab title + icon — always, unprompted.** Set `<title>` to the deck's real
title (e.g. "Acme — Series A") and swap the favicon emoji for one that fits
the topic. Do this for every deck without being asked.

## 3. Layout selection rules

The core decision table. Use this to match content to layout.

| Layout | Use when | Do NOT use when |
|---|---|---|
| `cover` | Opening slide. Always the first slide. | Never reuse mid-deck. |
| `big-number` | One real, defensible, sourced figure. Cite it in `foot`. | At most one per deck. Two giant numbers cancel. |
| `contrast` | Genuine before/after exists. Problem → solution. | Don't build a strawman. |
| `split` | Text + side visual (image, chart, BrowserFrame, Globe). `flip: true` swaps sides. | Don't use without a real visual in `media`. Text-only Split reads as broken. |
| `bento` | 3–5 proof points with figures, titles, short bodies. | Don't use for text-heavy content — use `stat-grid` instead. |
| `stat-grid` | 2–4 headline metrics with labels + captions. | Don't exceed 4 stats — reflow chaos. |
| `globe` | Story is genuinely geographic (users/revenue by country, market entry, global footprint). Markers are REAL locations. | Never as generic "we're global" flourish. |
| `chat` | Product genuinely has conversational/AI interface. Exchange shown is a real, plausible use. | Never decoration for non-chat products. |
| `pricing` | Pricing is actually part of this deck's ask. | Skip in launch, teaching, report decks. |
| `team` | Pitch and agency decks. | Skip in launches, reports, teaching. |
| `section` | Decks long enough to have real chapters (~12+ slides). | An 8-slide pitch needs no chapter dividers. |
| `agenda` | Formal or long presentations. | An 8-slide pitch needs no TOC. |
| `quote` | Real quote from real person. Attribution required. | Never fabricate quotes for real brands. |
| `comparison` | Us-vs-them feature matrix. One column highlighted in accent. | Don't use for pricing — use `pricing`. |
| `table` | Actual data with ≤5 columns and ≤7 rows. `caption` for the source. | Don't use for pricing tiers or feature ticks. |
| `steps` | "How it works" — 3–5 sequential steps. | Don't use for unordered features — use `bento`. |
| `timeline` | Roadmap with past → now → future. | Don't use for process — use `steps`. |
| `tabs` | 3–5 parallel perspectives on one topic. | Don't use for sequential content — use `steps`. |
| `accordion` | FAQ, feature detail, expandable sections. | Don't use for primary content — audience can't click. |
| `code-window` | Code snippet with line highlight and macOS chrome. | Don't use for non-code content. |
| `browser-frame` | App/product screenshot in browser chrome. | Don't use without a real screenshot or mock. |
| `spotlight-card` | 3 principles/values with cursor-follow glow. | Don't exceed 3 cards. |
| `marquee` | Logo strip, trust marks, partner names. | Don't use for content that must be read. |
| `cta` | Closing slide. Always the last slide. | Never reuse earlier. |

### 3.1 The centering rule (hard rule)

**Center what stands alone.** Ask of every slide: *does it have a side visual*
(a `split` media panel, an image, a `browser-frame`, a chart beside text)?

- **No side visual** (only text, or one structured block like `comparison` /
  `tabs` / `timeline` / `accordion` / `stat-grid`) → the slide MUST be centered:
  set `center: true` on the slide, or center the heading with
  `textAlign: 'center'` + `marginInline: 'auto'` on every block below it.
- **Yes** → left-aligned/asymmetric is allowed; the visual balances the text.

A lone left-anchored block floating in empty space is the #1 alignment bug —
never ship one.

### 3.2 Layout discipline (entry conditions)

Every specialty layout has an **entry condition**. If the content doesn't meet
it, the layout does not appear:

- **`chat`** — ONLY if the product genuinely has a conversational / AI
  interface, and the exchange shown is a real, plausible use of it. Never
  decoration for a non-chat product.
- **`pricing`** — only when pricing is actually part of this deck's ask.
- **`team`** — pitch and agency decks; skip in launches, reports, teaching.
- **`section`** — only in decks long enough to have real chapters (~12+ slides).
- **`big-number`** — needs one real, defensible figure (cite it in `foot`). At
  most one per deck — two giant numbers cancel each other out.
- **`contrast`** — when a genuine before/after exists; don't build a strawman.
- **`agenda`** — formal or long presentations; an 8-slide pitch needs no TOC.
- **`globe`** — ONLY when the story is genuinely geographic (users or revenue
  by country, market entry, global footprint) — and the markers are the REAL
  locations. Never as a generic "we're global" flourish.

The workhorses are `cover`, `split`, `bento`, `stat-grid`, `quote`,
`big-number`, `steps`, `cta` and the text atoms; specialty layouts appear
**at most once each**, when the content calls for them. If you can't say in
one sentence why a layout serves *this* deck, cut it.

## 4. Slide writing rules

- **Headline is a complete-sentence claim, not a label.** Write "SMBs spend 14
  hours/week on manual scheduling" not "Scheduling problem".
- **One idea + one visual per slide.** If tempted to add a second bullet cluster
  or second chart, split the slide.
- **Lead with the punchline.** The strongest point goes first — on the slide
  and in the deck order.
- **1–3 word kickers.** Sentence case. Short, declarative.
- **Body 1–3 tight sentences.** No paragraphs. No lorem ipsum.
- **Use the user's real numbers.** Never invent numbers for a real brand.
- **Add `notes` for talking points.** One sentence per slide is enough.

## 5. The JSON config

The agent's only deliverable is a JSON config. Write it to `deck.json`.

### 5.1 Top-level structure

```json
{
  "title": "Acme — Series A",
  "theme": {
    "primary": "#7C3AED",
    "mode": "dark",
    "headingFont": "Inter",
    "bodyFont": "Inter"
  },
  "slides": [
    { "type": "cover", ... },
    { "type": "big-number", ... },
    { "type": "cta", ... }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Sets `<title>` and presenter tab title. |
| `theme.primary` | no | Accent color hex. Default: CSMA default primary. |
| `theme.mode` | no | `"dark"` or `"light"`. Default: `"dark"`. |
| `theme.headingFont` | no | Font family for headings. Must be available or imported. |
| `theme.bodyFont` | no | Font family for body. Default: `--font-family-base`. |
| `slides` | yes | Array of slide configs. Minimum: 2 (cover + cta). |

### 5.2 Per-type schemas

See the slide plans `§12.9` for the complete per-type JSON shape. Every layout
has required and optional fields documented there. Key required fields per
type:

- `cover`: `kicker`, `title`, `subtitle`
- `big-number`: `value.number`, `caption`
- `contrast`: `left.{label,title,points[]}`, `right.{...}`
- `split`: `body`, `media`
- `bento`: `tiles[].k`
- `stat-grid`: `stats[].value`, `stats[].label`
- `quote`: `text`, `name`
- `comparison`: `cols[]`, `rows[].values[]`
- `table`: `columns[]`, `rows[][]`
- `steps` / `timeline`: `items[]`
- `chat`: `messages[]`
- `pricing`: `tiers[]`
- `accordion`: `items[].title`, `items[].body`
- `tabs`: `tabs[].label`
- `team`: `people[].name`
- `code-window`: `code`
- `browser-frame`: `url` (or `screenshot`)
- `spotlight-card`: `cards[]`
- `agenda`: `items[]`
- `section`: `n`
- `marquee`: `items[]`
- `cta`: `title`
- `globe`: `markers[]`

## 6. Interactivity: Build, Reveal, CountUp

**Build** — content reveals on click-advance. The factory wraps each
progressive element in a `.build` div; the service tracks the slide's
click-count and toggles `data-visible` on each build element. For `chat`
slides, each message auto-wraps in `Build at={n}`.

**Reveal** — on-enter entrance (no click needed). Slides enter via the
`slide-enter-left` / `slide-enter-right` keyframes (see `slides.css`). Respects
`prefers-reduced-motion`.

**CountUp** — animated number counter. Pass
`{ "number": 4.2, "decimals": 1, "suffix": "M" }` as a `value` or `fig` field.
Animates on enter via `IntersectionObserver` + `requestAnimationFrame`. Falls
back to the final value under `prefers-reduced-motion`.

## 7. Text atoms (CSS classes)

| Class | Use |
|---|---|
| `.display` | Hero text (cover title). |
| `.headline` | Slide heading. |
| `.lead` | Body emphasis. Larger, muted color. |
| `.subhead` | Secondary line under a display or headline. |
| `.kicker` | ALL CAPS small pre-title. `letter-spacing: 0.08em`. |
| `.accent-text` | Span wrapper — colors text with `--primary`. |
| `.foot` | Source line, date, context. Smallest legible size. |

## 8. Responsive rules

Each slide is a **full-viewport responsive layout**, not a fixed canvas — it
reflows to the screen, so nothing scales-and-clips. Use `%`, `vw`, `rem`,
`max-width` containers — not fixed pixel widths. One idea per slide, sized to
fill ~one screen with deliberate negative space. A paged slide CANNOT scroll.

All layouts stack/reflow below `--breakpoint-sm` (480px).

## 9. Visuals and imagery

Data/SaaS → app mock (`browser-frame`), code window, chart. Brand/product →
generated images in `public/`, one consistent style, used as `split` media or
full-bleed slide backgrounds under a gradient scrim. **No text in images.** An
image in a `split` or as a full-bleed background beats a floating card.

## 10. GSAP — optional escalation

GSAP is **not included** in the slides module. If a specific slide needs
animation that CSS cannot express (complex SVG morphing, multi-stage
choreography, physics), GSAP is available as an optional resource. Read
`docs/animation/SKILL.md` § "GSAP Escalation" before using it. All GSAP
timelines must be scoped to the slide's DOM tree and killed in the slide's
cleanup function. **Do not add GSAP just because a slide "feels plain" — fix
hierarchy, spacing, typography first.**

## 11. Build and present (CLI — separate package, deferred)

```bash
npx csma-slides build deck.json      # → public/index.html + assets
npx csma-slides present              # → opens browser with presenter mode
npx csma-slides export png --output slides/
npx csma-slides deploy --target cloudflare-pages
```

For v1, decks run directly inside a CSMA app — set `window.__DECK_CONFIG__`
and call `mountDeck(container, service, eventBus)`.

## 12. Definition of done

Self-check before declaring a deck complete:

- [ ] Deck title set in `"title"` field — no placeholder left behind.
- [ ] Theme colors match the brand (fetched or confirmed).
- [ ] Only the `theme` object was edited for theming — no token files touched.
- [ ] Slides compose like web sections (full-bleed/asymmetric/bento/split),
      not centered card rows.
- [ ] Alignment audit: every slide without a side visual is fully centered.
- [ ] No showcase decks: every specialty layout meets its entry condition.
- [ ] Layouts vary — no two adjacent slides share the same shape.
- [ ] One idea per slide. Headlines are claims, not labels.
- [ ] Real numbers. Zero lorem. Zero placeholder names.
- [ ] Notes added to slides for talking points.
- [ ] `window.__DECK_CONFIG__` parses with no errors.
- [ ] Deck is 8–16 slides (shorter for micro-decks, longer for keynotes).
