# Typeset — Implementation Plan

> **Status:** Draft  
> **Location:** `src/style/foundation/typeset.css`  
> **Docs:** `docs/typeset/SKILL.md`  
> **Demo:** `demo/typeset-demo.html`  
> **Depends on:** `src/generated/tokens.css` (consumes tokens, never creates them)  
> **Consumed by:** slides module, video module (future), MorphEditor, any CSMA app rendering markdown

---

## 1. Overview

Typeset is a single CSS file that styles plain HTML inside a `.csma-typeset` container. It solves the problem of having to manually style every markdown-rendered element (h1–h6, p, ul, table, code, blockquote) over and over for each context.

### 1.1 The problem

CSMA has typography tokens (`--font-size-xs` through `--font-size-3xl`, `--line-height-tight` through `--line-height-loose`) and `base.css` maps h1–h6 to specific tokens. This works for a single app. It breaks when:

- A blog, docs site, chat, slide deck, and video export all need **different typography**
- Content comes from **markdown** (MorphEditor export, LLM output, CMS) — unstyled HTML
- Content **streams** (LLM chat, live slide builds) — new blocks shouldn't restyle old ones
- Output **medium changes** (13" laptop → 4K projector → 1920×1080 video)

### 1.2 The solution

Three CSS custom properties control everything:

```css
.csma-typeset-docs {
  --ts-size: 15px;       /* base — heading sizes, code size, list indents derive */
  --ts-leading: 1.75;    /* line height — heading spacing, list gaps derive */
  --ts-flow: 1.25em;     /* space between blocks — paragraphs, lists, rules */
}
```

Heading sizes, list indents, gap under a heading, space around a rule — all computed from these three. Change one, the entire document reflows proportionally.

### 1.3 Prior art

Based on [shadcn/typeset](https://ui.shadcn.com/docs/typeset). Key ideas borrowed:

| Idea | Notes |
|---|---|
| Three rhythm controls (size, leading, flow) | Condensed from a dozen typography variables |
| Container-aware sizing | Adapts to its container, not fixed `rem` scale |
| `:where()` guard pattern | Zero specificity — easy to override with plain CSS |
| `not-typeset` escape hatch | Components inside prose opt out |
| Streaming-safe selectors | No `:last-child`, `:has()`, `:empty` in layout rules |
| `margin-block-start` only | Spacing flows one direction — new blocks don't restyle old ones |
| Theme token consumption | Dark mode: tokens flip, typeset follows — no `prose-invert` |

Differences from shadcn/typeset:

| shadcn/typeset | CSMA typeset |
|---|---|
| Tailwind-dependent (`@import "tailwindcss"`) | Zero dependencies — consumes CSMA tokens only |
| npm package (`@shadcn/typeset`) | Single CSS file in `src/style/foundation/` |
| Framework-agnostic preset builder | Presets are regular CSS classes — no build tool |
| Typography-only | Typography + streaming contract + opt-out |

---

## 2. File structure

```
src/style/
├── foundation/
│   ├── typeset.css           ← NEW: rhythm engine + element styles
│   ├── typeset-presets.css   ← NEW: .csma-typeset-docs, -blog, -chat, -slides
│   ├── typeset-plan.md       ← this file
│   └── ... (layout.css, motion.css, print.css, hardening/)
│
demo/
├── typeset-demo.html         ← NEW: interactive prose preview + control widget
└── typeset-demo.js           ← NEW: Type II control widget

docs/
├── typeset/
│   └── SKILL.md              ← NEW: agent instruction for using typeset
```

### 2.1 Why `foundation/` and not `theme/`

- `foundation/` = CSS that consumes tokens and provides structural styles (layout, motion, print, hardening). Typeset fits here — it's a structural layer for prose, same as `layout.css` is for page composition.
- `theme/` = JavaScript theme management (switching themes, persisting preference). Not CSS.

### 2.2 Why two CSS files

`typeset.css` is the engine — the element selectors, the rhythm math, the streaming contract. It should rarely be edited after initial implementation.

`typeset-presets.css` is the catalog — preset classes that agents and developers use. It's expected to grow as new contexts are added (slides, video, MorphEditor).

Separation means the engine stays stable while presets evolve.

---

## 3. typeset.css — the rhythm engine

### 3.1 Input tokens

```css
.csma-typeset {
  /* All inputs consume CSMA tokens as defaults */
  --ts-font-body:    var(--font-family-base);
  --ts-font-heading: var(--font-family-base);
  --ts-font-mono:    var(--font-family-mono);
  --ts-size:         var(--font-size-base);     /* 1rem */
  --ts-leading:      var(--line-height-base);   /* 1.6 */
  --ts-flow:         1.25em;
  --ts-color:        var(--foreground);
  --ts-color-muted:  var(--fg-muted);
  --ts-color-accent: var(--primary);
  --ts-radius:       var(--radius-md);
  --ts-border:       var(--border);
  --ts-surface:      var(--surface);
}
```

Agents override these in preset classes. The engine reads them with `var()` fallbacks to its own defaults.

### 3.2 Derived heading scale

All heading sizes derive from `--ts-size` multiplied by a ratio:

| Element | Formula | Ratio | Line-height |
|---|---|---|---|
| `h1` | `calc(var(--ts-size) * 2.5)` | 2.5 | 1.1 |
| `h2` | `calc(var(--ts-size) * 2)` | 2.0 | 1.2 |
| `h3` | `calc(var(--ts-size) * 1.5)` | 1.5 | 1.3 |
| `h4` | `calc(var(--ts-size) * 1.15)` | 1.15 | 1.4 |
| `h5` | `var(--ts-size)` | 1.0 | 1.5 |
| `h6` | `calc(var(--ts-size) * 0.85)` | 0.85 | 1.5 |

The ratio is intentionally NOT configurable as a separate token. Shadcn/typeset's key insight: exposing the scale ratio as a variable leads to broken typography. The ratios are a design decision, not a user-facing control.

### 3.3 Streaming-safe spacing contract

All block spacing uses `margin-block-start` only. No `:last-child`, `:has()`, or `:empty` selectors in layout rules:

```css
.csma-typeset {
  /* ✅ CORRECT — streaming-safe */
  & > * + * { margin-block-start: var(--ts-flow); }
  & p + p { margin-block-start: calc(var(--ts-flow) * 0.5); }
  & li + li { margin-block-start: calc(var(--ts-flow) * 0.25); }

  /* ❌ NEVER add these — they restyle earlier blocks when content streams */
  /* &:last-child { ... }     — match changes as content appends */
  /* &:has(+ p) { ... }       — forward-looking, match changes */
  /* &:empty { display: none } — match changes as content fills in */
}
```

Table borders live on the cells being added, not on the row above:

```css
.csma-typeset {
  & th { border-block-end: 2px solid var(--ts-border); }
  & td { border-block-end: 1px solid var(--ts-border); }
  /* NOT on tr — new row would restyle the row above */
}
```

### 3.4 Element styles

```css
.csma-typeset {
  /* ── Base ── */
  font-family: var(--ts-font-body);
  font-size: var(--ts-size);
  line-height: var(--ts-leading);
  color: var(--ts-color);

  /* ── Headings ── */
  & h1, & h2, & h3, & h4, & h5, & h6 {
    font-family: var(--ts-font-heading);
    text-wrap: balance;
  }
  & h1 { font-size: calc(var(--ts-size) * 2.5); line-height: 1.1; font-weight: var(--font-weight-bold); letter-spacing: -0.02em; }
  & h2 { font-size: calc(var(--ts-size) * 2);   line-height: 1.2; font-weight: var(--font-weight-semibold); letter-spacing: -0.015em; }
  & h3 { font-size: calc(var(--ts-size) * 1.5); line-height: 1.3; font-weight: var(--font-weight-semibold); letter-spacing: -0.01em; }
  & h4 { font-size: calc(var(--ts-size) * 1.15); line-height: 1.4; font-weight: var(--font-weight-medium); }
  & h5 { font-size: var(--ts-size); line-height: 1.5; font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: 0.05em; }
  & h6 { font-size: calc(var(--ts-size) * 0.85); line-height: 1.5; font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: 0.05em; color: var(--ts-color-muted); }

  /* ── Paragraphs ── */
  & p { margin: 0; }
  & p + p { margin-block-start: calc(var(--ts-flow) * 0.5); }

  /* ── Lists ── */
  & ul, & ol { padding-inline-start: 1.5em; }
  & li + li { margin-block-start: calc(var(--ts-flow) * 0.25); }

  /* ── Blockquote ── */
  & blockquote {
    margin-inline: 0;
    padding-inline-start: 1em;
    border-inline-start: 3px solid var(--ts-color-accent);
    color: var(--ts-color-muted);
  }

  /* ── Inline code ── */
  & code {
    font-family: var(--ts-font-mono);
    font-size: 0.9em;
    padding: 0.2em 0.4em;
    border-radius: var(--ts-radius);
    background: var(--ts-surface);
  }

  /* ── Code blocks ── */
  & pre {
    padding: var(--space-md);
    border-radius: var(--ts-radius);
    background: var(--ts-surface);
    overflow-x: auto;
  }
  & pre code { padding: 0; background: none; font-size: inherit; }

  /* ── Links ── */
  & a { color: var(--ts-color-accent); text-decoration: underline; }
  & a:hover { text-decoration: none; }

  /* ── Horizontal rule ── */
  & hr {
    border: none;
    border-block-start: 1px solid var(--ts-border);
    margin-block: var(--ts-flow);
  }

  /* ── Tables ── */
  & table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  & th {
    text-align: start;
    font-weight: var(--font-weight-semibold);
    padding: var(--space-sm) var(--space-md);
    border-block-end: 2px solid var(--ts-border);
  }
  & td {
    padding: var(--space-sm) var(--space-md);
    border-block-end: 1px solid var(--ts-border);
  }

  /* ── Images ── */
  & img { max-width: 100%; height: auto; border-radius: var(--ts-radius); }

  /* ── Strong / emphasis ── */
  & strong { font-weight: var(--font-weight-bold); }
  & em { font-style: italic; }

  /* ── Streaming-safe block spacing ── */
  & > * + * { margin-block-start: var(--ts-flow); }

  /* ── Opt-out ── */
  & .not-typeset,
  & [data-not-typeset] { all: revert; }

  /* ── Responsive table wrapper ── */
  & .typeset-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
```

### 3.5 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .csma-typeset {
    /* Typeset has no motion by default — nothing to reduce.
       If animations are added later, disable them here. */
  }
}
```

### 3.6 Accessibility — large type preset

```css
.csma-typeset-large {
  --ts-size: 18px;
  --ts-leading: 2;
  --ts-flow: 2em;
}
```

Exposed as a setting, not a default. Users opt in.

---

## 4. typeset-presets.css — the catalog

```css
/* ============================================
   CSMA Typeset Presets
   Add new presets here as contexts grow.
   ============================================ */

/* ── Documentation ── */
.csma-typeset-docs {
  --ts-size: 15px;
  --ts-leading: 1.75;
  --ts-flow: 1.25em;
}

/* ── Blog / article ── */
.csma-typeset-blog {
  --ts-size: 16px;
  --ts-leading: 1.6;
  --ts-flow: 1.3em;
}

/* ── Chat / messaging ── */
.csma-typeset-chat {
  --ts-size: 14px;
  --ts-leading: 1.5;
  --ts-flow: 0.9em;
}

/* ── Slide deck (consumed by slides module) ── */
.csma-typeset-slides {
  --ts-size: clamp(15px, 2vw, 20px);
  --ts-leading: 1.3;
  --ts-flow: 1em;
}

/* ── Video output (consumed by video module, 1920×1080) ── */
.csma-typeset-video {
  --ts-size: 18px;
  --ts-leading: 1.4;
  --ts-flow: 1.2em;
}

/* ── Accessibility — larger type ── */
.csma-typeset-large {
  --ts-size: 18px;
  --ts-leading: 2;
  --ts-flow: 2em;
}
```

### 4.1 When to add a new preset

- A new CSMA module needs prose styling (slides → `.csma-typeset-slides`)
- A new output medium needs different rhythm (video → `.csma-typeset-video`)
- User feedback shows a missing context (newsletter, legal, academic)

Do NOT add a preset for one-off styling — that's what custom classes are for. Presets are shared across projects.

---

## 5. Integration with CSMA style system

### 5.1 Import chain

```
src/style/main.css
  @import './foundation/layout.css'
  @import './foundation/motion.css'
  @import './foundation/typeset.css'        ← NEW
  @import './foundation/typeset-presets.css' ← NEW
  @import './foundation/print.css'
  @import './foundation/hardening/*.css'
```

### 5.2 Token consumption policy

Typeset **reads** these CSMA tokens. It **never writes** to `:root` or creates new design tokens:

| Typeset variable | CSMA token consumed as default |
|---|---|
| `--ts-font-body` | `var(--font-family-base)` |
| `--ts-font-heading` | `var(--font-family-base)` |
| `--ts-font-mono` | `var(--font-family-mono)` |
| `--ts-size` | `var(--font-size-base)` |
| `--ts-leading` | `var(--line-height-base)` |
| `--ts-color` | `var(--foreground)` |
| `--ts-color-muted` | `var(--fg-muted)` |
| `--ts-color-accent` | `var(--primary)` |
| `--ts-radius` | `var(--radius-md)` |
| `--ts-border` | `var(--border)` |
| `--ts-surface` | `var(--surface)` |

If a token doesn't exist yet (e.g., `--fg-muted` was added later), typeset uses its own hardcoded fallback. Tokens are added to `design-tokens.json` and `token-overrides.json` through the normal CSMA token pipeline — not through typeset.

### 5.3 Relationship to base.css

`base.css` provides **global defaults** (body reset, h1–h6, p). It styles elements that are NOT inside a `.csma-typeset` container. Typeset provides **scoped prose styling** — elements inside `.csma-typeset` get typeset's rhythm instead of base.css's fixed token mapping.

They coexist. No conflicts because typeset uses `:where()` guard pattern for zero specificity — base.css rules win outside `.csma-typeset`, typeset rules win inside.

---

## 6. Demo: typeset-demo.html

### 6.1 Purpose

- Show humans what the three rhythm controls do
- Validate that the typeset engine works across presets
- Give agents a living reference for the `docs/typeset/SKILL.md`

### 6.2 Structure

```
demo/typeset-demo.html    ← static HTML: prose content + control panel
demo/typeset-demo.js      ← Type II control widget (EventBus-driven)
```

### 6.3 HTML layout

```html
<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <title>CSMA Typeset — Rhythm Demo</title>
  <link rel="stylesheet" href="../src/style/main.css">
  <link rel="stylesheet" href="../src/style/foundation/typeset.css">
  <link rel="stylesheet" href="../src/style/foundation/typeset-presets.css">
  <link rel="stylesheet" href="typeset-demo.css">
</head>
<body>

<div class="ts-demo-shell">
  <!-- Control panel -->
  <aside class="ts-controls" data-ts-controls>
    <h2 class="ts-controls__title">Rhythm Controls</h2>

    <label class="ts-control">
      <span>Size: <output data-ts-output="size">15</output>px</span>
      <input type="range" data-ts-control="size"
             min="12" max="24" step="0.5" value="15">
    </label>

    <label class="ts-control">
      <span>Leading: <output data-ts-output="leading">1.75</output></span>
      <input type="range" data-ts-control="leading"
             min="1.1" max="2.5" step="0.05" value="1.75">
    </label>

    <label class="ts-control">
      <span>Flow: <output data-ts-output="flow">1.25</output>em</span>
      <input type="range" data-ts-control="flow"
             min="0.5" max="3" step="0.05" value="1.25">
    </label>

    <fieldset class="ts-presets">
      <legend>Presets</legend>
      <button class="button" data-variant="outline" data-ts-preset="docs">Docs</button>
      <button class="button" data-variant="outline" data-ts-preset="blog">Blog</button>
      <button class="button" data-variant="outline" data-ts-preset="chat">Chat</button>
      <button class="button" data-variant="outline" data-ts-preset="slides">Slides</button>
    </fieldset>

    <label class="ts-control">
      <span>Font</span>
      <select data-ts-control="font">
        <option value="var(--font-family-base)">System (default)</option>
        <option value="'Georgia', 'Times New Roman', serif">Serif</option>
        <option value="var(--font-family-mono)">Mono</option>
      </select>
    </label>

    <label class="ts-control">
      <span>Theme</span>
      <select data-ts-control="theme">
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </label>
  </aside>

  <!-- Prose preview -->
  <main class="ts-preview">
    <div class="csma-typeset csma-typeset-docs" data-ts-prose>
      <!-- Prose content: headings, paragraphs, lists, code, table, blockquote -->
      <!-- Content is static HTML — same output MorphEditor / markdown produces -->
      <h1>Architecture Overview</h1>
      <p>CSMA separates concerns: <strong>JavaScript manages state via events, CSS handles rendering.</strong> This achieves fast DOM updates and a minimal bundle size.</p>
      <p>CSMA is <em>modules-first</em>. Prefer trusted modules under <code>src/modules/*</code>, Contracts for validation and security, and lifecycle-safe load/unload through ModuleManager.</p>

      <h2>The 6 Rules</h2>
      <ol>
        <li><strong>State Changes = CSS Classes Only</strong> — no inline styles for UI state</li>
        <li><strong>Define All States in CSS</strong> — use <code>data-*</code> attributes</li>
        <li><strong>JavaScript Publishes Events, CSS Handles Rendering</strong></li>
      </ol>

      <blockquote>
        <p>CSMA is modules-first. Prefer trusted modules under <code>src/modules/*</code>.</p>
      </blockquote>

      <h3>Token Reference</h3>
      <table>
        <thead>
          <tr><th>Token</th><th>Value</th><th>Use</th></tr>
        </thead>
        <tbody>
          <tr><td><code>--space-xs</code></td><td>0.25rem</td><td>Tight gaps</td></tr>
          <tr><td><code>--space-md</code></td><td>0.75rem</td><td>Standard gap</td></tr>
          <tr><td><code>--space-xl</code></td><td>1.5rem</td><td>Section gaps</td></tr>
        </tbody>
      </table>

      <pre><code>const el = document.querySelector('.card');
el.className = 'card completed';
el.dataset.state = 'loading';</code></pre>

      <hr>

      <p>A component inside prose can opt out:</p>
      <div class="card not-typeset">
        <p>This card keeps its own styles — typeset leaves it alone.</p>
      </div>
    </div>
  </main>
</div>

<script type="module" src="typeset-demo.js"></script>
</body>
</html>
```

### 6.4 Control widget (typeset-demo.js)

```js
/**
 * Typeset Demo — interactive rhythm controls.
 * Type II component: reads/writes CSS custom properties on the prose container.
 * No EventBus needed for this demo (single-element, no cross-component state).
 */

export function initTypesetDemo() {
  const prose = document.querySelector('[data-ts-prose]');
  if (!prose) return () => {};

  const controls = {
    size:    document.querySelector('[data-ts-control="size"]'),
    leading: document.querySelector('[data-ts-control="leading"]'),
    flow:    document.querySelector('[data-ts-control="flow"]'),
    presets: document.querySelectorAll('[data-ts-preset]'),
    font:    document.querySelector('[data-ts-control="font"]'),
    theme:   document.querySelector('[data-ts-control="theme"]'),
  };

  const outputs = {
    size:    document.querySelector('[data-ts-output="size"]'),
    leading: document.querySelector('[data-ts-output="leading"]'),
    flow:    document.querySelector('[data-ts-output="flow"]'),
  };

  const PRESETS = {
    docs:    { size: 15, leading: 1.75, flow: 1.25 },
    blog:    { size: 16, leading: 1.6,  flow: 1.3 },
    chat:    { size: 14, leading: 1.5,  flow: 0.9 },
    slides:  { size: 18, leading: 1.3,  flow: 1 },
  };

  function apply(prop, value, unit = '') {
    prose.style.setProperty(prop, value + unit);
  }

  function syncSliders(size, leading, flow) {
    controls.size.value = size;
    controls.leading.value = leading;
    controls.flow.value = flow;
    outputs.size.textContent = size;
    outputs.leading.textContent = leading;
    outputs.flow.textContent = flow;
  }

  // Read initial values from computed style
  const style = getComputedStyle(prose);
  syncSliders(
    parseFloat(style.getPropertyValue('--ts-size')),
    parseFloat(style.getPropertyValue('--ts-leading')),
    parseFloat(style.getPropertyValue('--ts-flow'))
  );

  // Slider handlers — instant reflow
  controls.size.addEventListener('input', () => {
    const v = controls.size.value;
    apply('--ts-size', v, 'px');
    outputs.size.textContent = v;
  });

  controls.leading.addEventListener('input', () => {
    const v = controls.leading.value;
    apply('--ts-leading', v);
    outputs.leading.textContent = v;
  });

  controls.flow.addEventListener('input', () => {
    const v = controls.flow.value;
    apply('--ts-flow', v, 'em');
    outputs.flow.textContent = v;
  });

  // Preset buttons
  controls.presets.forEach(btn => {
    btn.addEventListener('click', () => {
      const p = PRESETS[btn.dataset.tsPreset];
      if (!p) return;
      apply('--ts-size', p.size, 'px');
      apply('--ts-leading', p.leading);
      apply('--ts-flow', p.flow, 'em');
      syncSliders(p.size, p.leading, p.flow);
    });
  });

  // Font switcher
  controls.font?.addEventListener('change', () => {
    prose.style.setProperty('--ts-font-body', controls.font.value);
    prose.style.setProperty('--ts-font-heading', controls.font.value);
  });

  // Theme switcher
  controls.theme?.addEventListener('change', () => {
    document.documentElement.dataset.theme = controls.theme.value;
  });

  return () => {}; // nothing to clean up — all event listeners on the DOM tree
}

// Auto-init when loaded as standalone demo
if (document.querySelector('[data-ts-prose]')) {
  initTypesetDemo();
}
```

### 6.5 Demo CSS (typeset-demo.css)

```css
/* ── Typeset Demo Layout ── */

.ts-demo-shell {
  display: grid;
  grid-template-columns: 300px 1fr;
  min-height: 100vh;
}

.ts-controls {
  padding: var(--space-xl);
  background: var(--surface);
  border-inline-end: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  overflow-y: auto;
}

.ts-controls__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.ts-control {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--foreground-muted);
}

.ts-control input[type="range"] {
  width: 100%;
  accent-color: var(--primary);
}

.ts-control output {
  font-weight: var(--font-weight-semibold);
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
}

.ts-presets {
  border: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.ts-presets legend {
  font-size: var(--font-size-sm);
  color: var(--foreground-muted);
  margin-block-end: var(--space-sm);
}

.ts-preview {
  padding: var(--space-3xl);
  overflow-y: auto;
  background: var(--background);
}

/* Responsive: controls move above preview */
@media (max-width: 768px) {
  .ts-demo-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .ts-controls {
    border-inline-end: none;
    border-block-end: 1px solid var(--border);
    max-height: 40vh;
  }

  .ts-preview {
    padding: var(--space-lg);
  }
}
```

---

## 7. Agent skill: docs/typeset/SKILL.md

### 7.1 Frontmatter

```yaml
---
name: csma-typeset
description: >-
  Style markdown-rendered HTML with a single CSS class. Use when content comes
  from markdown, LLM output, or a rich-text editor and needs consistent
  typography across contexts (docs, blog, chat, slides, video).
---
```

### 7.2 Required reading chain

```
1. src/style/foundation/typeset.css       — the rhythm engine (read, don't edit)
2. src/style/foundation/typeset-presets.css — available presets
3. src/generated/tokens.css               — tokens consumed by typeset
4. docs/animation/SKILL.md                — reduced-motion rules
```

### 7.3 When to use

| Content source | Use typeset? |
|---|---|
| Markdown rendered to HTML (blog, docs, readme) | **Yes** — wrap in `.csma-typeset` |
| LLM streaming output (chat, AI-generated docs) | **Yes** — streaming-safe by design |
| MorphEditor HTML export | **Yes** — wrap exported HTML |
| Slide body text (slides module) | **Yes** — `.slide-typeset` consumes `--ts-size` |
| Video scene text (video module) | **Yes** — `.video-typeset` adapts for resolution |
| UI chrome (buttons, forms, sidebars, docks) | **No** — these have their own component CSS |
| Interactive widgets (datepickers, sliders, toggles) | **No** — opt out with `.not-typeset` |

### 7.4 How to use

```html
<div class="csma-typeset csma-typeset-docs">
  <!-- Rendered markdown HTML goes here -->
  <h2>Getting Started</h2>
  <p>Install via npm...</p>
  <pre><code>npm install csma</code></pre>
</div>
```

That's it. No per-element styling needed.

### 7.5 Creating a custom preset

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

### 7.6 Opting out components

```html
<div class="csma-typeset">
  <p>Styled prose.</p>
  <div class="card not-typeset">
    <!-- This card keeps its own component styles -->
  </div>
  <p>Back to prose.</p>
</div>
```

### 7.7 Streaming contract (rules for agents)

When adding CSS that targets `.csma-typeset` children, never use:

- `:last-child` — match changes as content appends
- `:has()` — forward-looking, match changes
- `:empty` — match changes as content fills in
- `margin-block-end` or `margin-bottom` on block elements — use `margin-block-start` on the element that follows

These rules ensure that as new content streams in (LLM chat, live slide builds), earlier blocks don't restyle.

### 7.8 Definition of done

- [ ] Content wrapped in `.csma-typeset` + a preset class
- [ ] No per-element typography styles — typeset handles everything
- [ ] Components inside prose have `.not-typeset` or `data-not-typeset`
- [ ] No `:last-child`, `:has()`, or `:empty` in custom typeset overrides
- [ ] Dark mode works — typeset reads theme tokens, no `prose-invert` needed
- [ ] `prefers-reduced-motion: reduce` respected
- [ ] Tested at narrow (480px) and wide (1280px) viewports

---

## 8. Integration with slides module

### 8.1 How slides consume typeset

The slides module imports `typeset.css` and overrides `--ts-size` for slides:

```css
/* slides.css — imports typeset, tunes rhythm for slides */
@import '../../style/foundation/typeset.css';

.slide-typeset {
  --ts-size: clamp(15px, 2vw, 20px);
  --ts-leading: 1.3;
  --ts-flow: 1em;
}
```

### 8.2 Type atom derivation

Instead of hardcoded `clamp()` values for `.display`, `.headline`, `.lead`, etc., slide type atoms derive from `--ts-size`:

```css
.slide-typeset {
  & .display  { font-size: calc(var(--ts-size) * 4.5); line-height: 1.05; }
  & .headline { font-size: calc(var(--ts-size) * 2.7); line-height: 1.15; }
  & .lead     { font-size: calc(var(--ts-size) * 1.2); line-height: 1.4; }
  & .kicker   { font-size: calc(var(--ts-size) * 0.65); letter-spacing: 0.08em; text-transform: uppercase; }
  & .foot     { font-size: calc(var(--ts-size) * 0.7); }
}
```

Agent sets one variable per deck instead of five.

### 8.3 Video module (future)

Same `.slide-typeset`, different `--ts-size` tuned for 1920×1080:

```css
.video-typeset {
  --ts-size: 18px;       /* fixed — video has known resolution */
  --ts-leading: 1.4;
}
```

---

## 9. Implementation phases

### Phase 1: Engine

**Files:** `src/style/foundation/typeset.css`

**Content:** All element styles, heading scale, streaming-safe spacing, opt-out.

**Verification:** Wrap any markdown-rendered HTML in `.csma-typeset`. Headings scale. Spacing is consistent. Dark mode works. No `:last-child`/`:has()` in the source.

### Phase 2: Presets

**Files:** `src/style/foundation/typeset-presets.css`

**Content:** `.csma-typeset-docs`, `.csma-typeset-blog`, `.csma-typeset-chat`, `.csma-typeset-slides`, `.csma-typeset-large`.

**Verification:** Each preset class changes `--ts-size`/`--ts-leading`/`--ts-flow` — all headings and spacing reflow correctly.

### Phase 3: Import chain

**Files:** `src/style/main.css` (add `@import` lines)

**Verification:** Any CSMA app that imports `main.css` gets typeset. No conflicts with `base.css`.

### Phase 4: Demo

**Files:** `demo/typeset-demo.html`, `demo/typeset-demo.js`, `demo/typeset-demo.css`

**Verification:** Sliders change rhythm in real time. Preset buttons set all three. Font and theme switchers work. Responsive at 480px.

### Phase 5: Agent skill

**Files:** `docs/typeset/SKILL.md`

**Content:** Full agent instruction set — when to use, how to use, preset catalog, streaming contract, opt-out, definition of done.

**Verification:** Agent given a markdown file → wraps output in `.csma-typeset.csma-typeset-docs` → no per-element styling.

### Phase 6: Slides module integration

**Files:** `src/modules/slides/slides.css` (add type atom derivation), `src/modules/slides/SKILL.md` (add typeset reference)

**Verification:** Slide type atoms derive from `--ts-size`. Agent sets one variable in deck theme.

---

## 10. Safety checklist

### 10.1 Token compliance

- [ ] Typeset reads CSMA tokens (`var(--...)`) — never writes to `:root`
- [ ] All visual values reference `var(--ts-*)` variables — no raw values in element selectors
- [ ] No new design tokens created — typeset variables are scoped to `.csma-typeset`

### 10.2 CSMA architecture compliance

- [ ] Typeset is a CSS-only layer — no JavaScript in the engine
- [ ] All states expressed as `data-*` attributes or CSS classes
- [ ] No inline styles from typeset
- [ ] Demo widget uses `textContent` for all user-visible strings

### 10.3 Streaming contract

- [ ] No `:last-child` in layout rules
- [ ] No `:has()` in layout rules
- [ ] No `:empty` in layout rules
- [ ] Spacing uses `margin-block-start` only
- [ ] Table borders live on `th`/`td`, not `tr`

### 10.4 Accessibility

- [ ] `prefers-reduced-motion: reduce` disables any typeset motion
- [ ] `.csma-typeset-large` preset available for larger type
- [ ] Focus visible on links inside prose
- [ ] Tables are real `<table>` elements — no div-soup
- [ ] Code blocks scroll horizontally on overflow

### 10.5 Performance

- [ ] No JavaScript in the typeset engine — pure CSS, zero runtime cost
- [ ] No `@import` inside typeset — only `var()` references
- [ ] Demo widget is < 2KB unminified
- [ ] Typeset CSS is < 5KB unminified (~1.5KB gzipped)

---

## 11. References

- `../generated/tokens.css` — design tokens consumed by typeset
- `../../docs/animation/SKILL.md` — reduced-motion rules
- `../../docs/patterns/SKILL.md` — Type I/II component patterns
- `../../docs/css/SKILL.md` — CSS conventions for CSMA
- `../../docs/architecture/SKILL.md` — CSMA architecture rules
- `../../demo/index.html` — existing CSMA demo (UI chrome, not prose)
- `../../../vibe/hyperframes/` — HyperFrames reference (slideshow mode)
- `../../modules/slides/plan.md` — slides module plan (consumes typeset)
- `../../modules/video/plan.md` — video module plan (future, consumes typeset)
- `https://ui.shadcn.com/docs/typeset` — shadcn/typeset (prior art)
