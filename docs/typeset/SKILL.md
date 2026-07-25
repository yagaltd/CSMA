---
name: csma-typeset
description: >-
  Style markdown-rendered HTML with a single CSS class. Use when content comes
  from markdown, LLM output, or a rich-text editor and needs consistent
  typography across contexts (docs, blog, chat, slides, video).
---

<!-- version: 1.0.0 | tags: typeset, typography, markdown, prose, streaming -->

# CSMA Typeset Skill

Typeset is a single CSS layer that styles plain HTML inside a `.csma-typeset`
container. Three CSS custom properties control everything: `--ts-size`,
`--ts-leading`, `--ts-flow`. Change one, the entire document reflows
proportionally. Wrap rendered markdown, LLM output, or editor export in one
class and you are done — no per-element styling.

## When to read this skill

Read this skill before styling any of the following:

- Markdown rendered to HTML (blog, docs, README, changelog)
- LLM streaming output (chat bubbles, AI-generated documents)
- MorphEditor HTML export
- Slide body text (the slides module consumes typeset)
- Video scene captions (the video module will consume typeset)

Do **not** read this skill for UI chrome (buttons, forms, sidebars, docks) or
interactive widgets (datepickers, sliders, toggles). Those have their own
component CSS and should opt out of typeset with `.not-typeset`.

## Required reading chain

When this skill is selected, read in this order before composing:

1. `src/style/foundation/typeset.css` — the rhythm engine. Read it; do not edit it.
2. `src/style/foundation/typeset-presets.css` — the available preset classes.
3. `src/generated/tokens.css` — the design tokens typeset consumes.
4. `docs/animation/SKILL.md` — reduced-motion rules that typeset respects.

## The three rhythm controls

```css
.my-typeset {
  --ts-size: 15px;       /* base — heading sizes, code size, list indents derive */
  --ts-leading: 1.75;    /* line height — heading spacing, list gaps derive */
  --ts-flow: 1.25em;     /* space between blocks — paragraphs, lists, rules */
}
```

Heading sizes are derived by fixed ratios from `--ts-size`. The ratios are a
design decision, not a user-facing control — do not expose them as separate
tokens. If you need different heading sizes, change `--ts-size` and let
everything scale.

## How to use

Wrap your content in `.csma-typeset` plus a preset class:

```html
<div class="csma-typeset csma-typeset-docs">
  <h2>Getting Started</h2>
  <p>Install via npm:</p>
  <pre><code>npm install csma</code></pre>
</div>
```

That is the entire API. No per-element styling is needed.

## Preset catalog

| Preset class | Size | Leading | Flow | Use |
|---|---|---|---|---|
| `.csma-typeset-docs` | 15px | 1.75 | 1.25em | Documentation, README |
| `.csma-typeset-blog` | 16px | 1.6 | 1.3em | Articles, long-form prose |
| `.csma-typeset-chat` | 14px | 1.5 | 0.9em | Messaging, LLM chat |
| `.csma-typeset-slides` | clamp(15px, 2vw, 20px) | 1.3 | 1em | Slide decks |
| `.csma-typeset-video` | 18px | 1.4 | 1.2em | 1920×1080 video scenes |
| `.csma-typeset-large` | 18px | 2 | 2em | Accessibility — large type |

Add new presets in `typeset-presets.css` only when a new shared context
emerges (a new module, a new output medium). Do not add a preset for one-off
styling — use a custom class instead.

## Creating a custom preset

```css
.my-app-typeset {
  --ts-size: 16px;
  --ts-leading: 1.6;
  --ts-flow: 1.3em;
  --ts-font-heading: 'Your Heading Font', sans-serif;
}
```

```html
<div class="csma-typeset my-app-typeset">
  <!-- content -->
</div>
```

## Opting out components

Components nested inside prose can opt out to keep their own styles:

```html
<div class="csma-typeset">
  <p>Styled prose.</p>
  <div class="card not-typeset">
    <!-- This card keeps its own component styles -->
  </div>
  <p>Back to prose.</p>
</div>
```

Use either the `.not-typeset` class or the `[data-not-typeset]` attribute.

## Streaming contract (rules for agents)

When adding CSS that targets `.csma-typeset` children, **never** use:

- `:last-child` — match changes as content appends
- `:has()` — forward-looking, match changes
- `:empty` — match changes as content fills in
- `margin-block-end` or `margin-bottom` on block elements — use
  `margin-block-start` on the element that follows instead

These rules ensure that as new content streams in (LLM chat, live slide
builds), earlier blocks do not get restyled. Spacing flows one direction only.

Table borders live on the cells being added (`th` / `td`), never on the row
above (`tr`). A new row must not restyle the row above it.

## Token consumption policy

Typeset reads CSMA design tokens via `var(--…)`. It never writes to `:root`
and never creates new design tokens. The full mapping:

| Typeset variable | CSMA token consumed as default |
|---|---|
| `--ts-font-body` | `var(--font-family-base)` |
| `--ts-font-heading` | `var(--font-family-base)` |
| `--ts-font-mono` | `var(--font-family-mono)` |
| `--ts-size` | `var(--font-size-base)` |
| `--ts-leading` | `var(--line-height-base)` |
| `--ts-color` | `var(--foreground)` |
| `--ts-color-muted` | `var(--foreground-muted)` |
| `--ts-color-accent` | `var(--primary)` |
| `--ts-radius` | `var(--radius-md)` |
| `--ts-border` | `var(--border)` |
| `--ts-surface` | `var(--surface)` |

To change typography across an entire app, edit tokens through the normal
CSMA token pipeline (`token-overrides.json` → `tokens:patch`). Do not edit
`typeset.css` to change values — change the tokens it reads.

## Relationship to `base.css`

`base.css` provides **global defaults** (body reset, h1–h6, p). It styles
elements that are **not** inside a `.csma-typeset` container. Typeset provides
**scoped prose styling** — elements inside `.csma-typeset` get typeset's
rhythm instead of `base.css`'s fixed token mapping.

They coexist without conflict because typeset uses the `:where()` guard
pattern for zero specificity. `base.css` rules win outside `.csma-typeset`;
typeset rules win inside. Plain CSS overrides always win over both because
`:where()` contributes zero specificity.

## Dark mode

Typeset reads theme tokens. When the theme flips (via `[data-theme]` on the
root), the tokens flip and typeset follows automatically. There is no
`prose-invert` class to add — unlike some other typography systems.

## Accessibility

- `prefers-reduced-motion: reduce` is respected. Typeset ships no animations
  by default; the media query is reserved for future motion additions.
- `.csma-typeset-large` preset is available as an explicit setting for users
  who need larger type. It is opt-in, not a default.
- Focus remains visible on links inside prose — typeset does not remove the
  default focus ring.
- Tables are real `<table>` elements. Do not replace them with div-soup.
- Code blocks scroll horizontally on overflow (`overflow-x: auto`).

## Definition of done

Before declaring a typeset-using surface complete, verify:

- [ ] Content is wrapped in `.csma-typeset` plus a preset class
- [ ] No per-element typography styles — typeset handles everything
- [ ] Components inside prose carry `.not-typeset` or `[data-not-typeset]`
- [ ] No `:last-child`, `:has()`, or `:empty` in custom typeset overrides
- [ ] Dark mode works — typeset reads theme tokens, no `prose-invert` needed
- [ ] `prefers-reduced-motion: reduce` is respected
- [ ] Tested at narrow (480px) and wide (1280px) viewports

## References

- `src/style/foundation/typeset.css` — the engine (read-only in normal use)
- `src/style/foundation/typeset-presets.css` — preset catalog
- `src/style/foundation/typeset-plan.md` — full implementation plan
- `demo/typeset-demo.html` — interactive demo with rhythm controls
- `https://ui.shadcn.com/docs/typeset` — shadcn/typeset prior art
