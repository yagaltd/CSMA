# Slides Module — Implementation Plan

> **Status:** Draft  
> **Module ID:** `slides`  
> **CSMA wave:** Wave 5 — Presentation & Media Output  
> **Depends on:** `media` (capture/transform), `file-system` (persist exports)  
> **Optionally consumes:** `ai` (slide generation), `visual-editor` (collaborative editing), `cross-tab-leader` (presenter sync)

---

## 1. Overview

The slides module adds a presentation deck engine to CSMA. It mirrors the bolt-slides component set but is rebuilt as vanilla JS DOM factories, CSS-driven state, and EventBus contracts — respecting every CSMA architecture rule.

### 1.1 What it replaces from bolt-slides / Slidev

| bolt-slides / Slidev | CSMA slides module |
|---|---|
| React component tree | Vanilla JS DOM factories |
| React context (`DeckCtx`) | `SlideDeckService` state via EventBus |
| `framer-motion` animation | CSS transitions + `data-*` toggles |
| Custom `BroadcastChannel` sync | `CrossTabLeader` + ChannelManager |
| Hardcoded theming | CSMA token system (`--transition-*`, `--space-*`) |
| Vite dev server required | CSMA bootstrap (runs in any CSMA app) |
| JSX authoring | JSON config (`window.__DECK_CONFIG__`) |

### 1.2 What it adds that bolt-slides / Slidev don't have

- **Media capture contracts** — record presentations (webcam + screen + audio) via the `media` module
- **Canvas-based export** — per-slide PNG/WebP via `CanvasCodec` (no Puppeteer needed)
- **AI module integration** — `ai` module can generate slide content from prompts
- **Cross-tab presenter sync** — already built into CSMA via `CrossTabLeader`
- **Security by default** — all navigation events are contract-validated and rate-limited

---

## 2. Module Structure

```
src/modules/slides/
├── index.js                       # manifest + services + contracts + re-exports
├── plan.md                        # this file
├── README.md                      # agent-facing docs
│
├── contracts/
│   └── slides-contracts.js        # all EventBus contracts (intents + events)
│
├── services/
│   └── SlideDeckService.js        # deck state machine + EventBus subscriptions
│
├── engine/
│   ├── deck.js                    # DOM factory: slide stage, keyboard, hash sync
│   ├── build.js                   # click-build state manager (per-slide click counts)
│   ├── transitions.js             # slide enter/exit CSS class orchestrator
│   ├── thumbnails.js              # canvas-based thumbnail renderer for rail/grid
│   └── annotator.js               # SVG overlay for freehand drawing (port from bolt-slides)
│
├── chrome/
│   ├── dock.js                    # floating toolbar (Type II: publishes intents)
│   ├── rail.js                    # thumbnail sidebar
│   ├── grid.js                    # grid overview
│   └── presenter.js               # presenter overlay (notes, timer, next-preview)
│
├── layouts/
│   ├── cover.js                   # kicker → title → subtitle cascade
│   ├── split.js                   # text + media side panel
│   ├── bento.js                   # asymmetric tile grid
│   ├── globe.js                   # canvas 3D globe (ported from bolt-slides)
│   ├── charts.js                  # bar/line/donut (canvas, 0 deps)
│   ├── stat-grid.js               # proof cards with count-up
│   ├── big-number.js              # accent figure + caption
│   ├── contrast.js                # before/after comparison columns
│   ├── quote.js                   # pull-quote + attribution
│   ├── comparison.js              # feature matrix
│   ├── table.js                   # data table
│   ├── steps.js                   # horizontal process
│   ├── timeline.js                # vertical roadmap
│   ├── chat.js                    # message exchange (click-build reveals)
│   ├── pricing.js                 # tier cards
│   ├── accordion.js               # expand/collapse panels
│   ├── tabs.js                    # tabbed content
│   ├── team.js                    # people grid
│   ├── code-window.js             # code block with line highlight
│   ├── browser-frame.js           # browser chrome wrapper
│   ├── spotlight-card.js          # cursor-follow accent glow
│   ├── agenda.js                  # numbered table-of-contents
│   ├── section.js                 # chapter divider
│   └── marquee.js                 # logo strip
│
├── ui/
│   ├── count-up.js                # animated number counter (Type II, self-contained)
│   └── tilt-card.js               # perspective tilt on hover (Type I, CSS transform)
│
├── slides.css                     # slide scaffold + layout CSS
├── dock.css                       # chrome UI CSS
├── layouts.css                    # layout-specific CSS (one block per layout)
└── print.css                      # @media print for PDF export
```

### 2.1 Module size budget

| Layer | Est. lines | Notes |
|---|---|---|
| Contracts | 150 | ~25 contracts, schema + metadata |
| SlideDeckService | 200 | State machine + subscriptions |
| Engine (deck + build + transitions + thumbnails + annotator) | 500 | Core loop, DOM, keyboard |
| Chrome (dock + rail + grid + presenter) | 350 | Type II UI components |
| Layouts (24 factories) | 900 | ~35 lines each on average |
| CSS | 400 | Slide scaffold, chrome, layout states |
| **Total** | **~2,500** | All vanilla JS, zero new dependencies |

---

## 3. Architecture Decisions

### 3.1 State ownership

```
SlideDeckService  ←  single source of truth
  ├── currentSlide: number
  ├── clicks: number                 (per-slide build step)
  ├── maxClicks: Map<slideIdx, max>  (per-slide build ceilings)
  ├── annotations: Map<slideIdx, Stroke[]>
  ├── notes: Map<slideIdx, string>
  └── uiState: { railOpen, gridOpen, drawing, fs, uiHidden }
```

The DOM is a **projection** of service state. No React reconciliation — the service publishes events, the chrome/layouts subscribe and update CSS classes.

### 3.2 CSS-first animation (CSMA rule)

All slide transitions, build reveals, and chrome animations use CSS transitions/keyframes driven by `data-*` attributes. No inline styles for UI state.

```css
/* slide enter */
.slide-stage[data-transition="enter"] .slide {
  animation: slide-enter var(--transition-slow) var(--ease-out);
}

/* build reveal — the bolt-slides signature */
.build[data-visible="false"] {
  opacity: 0;
  transform: translateY(16px);
  filter: blur(3px);
  transition:
    opacity var(--transition-normal) var(--ease-out),
    transform var(--transition-slow) var(--ease-out),
    filter var(--transition-slow) var(--ease-out);
}

.build[data-visible="true"] {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}
```

**Exception for transient animation:** Canvas-based globes, charts, and count-up numbers use `requestAnimationFrame`. These are runtime renderers, not UI state. They clean up on teardown.

### 3.3 textContent only (security rule)

All layout factories build DOM nodes programmatically and set text via `textContent`:

```js
// CORRECT
const title = document.createElement('h1');
title.className = 'display';
title.textContent = props.title;  // ← never innerHTML

// WRONG — would be rejected in code review
el.innerHTML = `<h1 class="display">${props.title}</h1>`;
```

HTML-typed content (e.g., accent spans inside a title) is composed as child elements, not HTML strings.

### 3.4 Contracts for all navigation

Every user interaction that changes deck state goes through a validated contract:

```
INTENT_SLIDE_NEXT     →  SlideDeckService.next()
INTENT_SLIDE_PREV     →  SlideDeckService.prev()
INTENT_SLIDE_GO       →  SlideDeckService.go(index)
INTENT_SLIDE_TOGGLE_RAIL  →  SlideDeckService.toggleRail()
INTENT_SLIDE_TOGGLE_GRID  →  SlideDeckService.toggleGrid()
INTENT_ANNOTATION_STROKE  →  SlideDeckService.addStroke(...)
INTENT_ANNOTATION_CLEAR   →  SlideDeckService.clearAnnotations()
```

This means the agent can drive the deck programmatically by publishing intents — no DOM access needed.

### 3.5 Config injection (agent interface)

The deck reads its configuration from `window.__DECK_CONFIG__`:

```js
window.__DECK_CONFIG__ = {
  title: "Acme Series A",
  theme: { primary: "#7C3AED", mode: "dark" },
  slides: [
    { type: "cover", kicker: "Series A", title: "Acme", subtitle: "..." },
    { type: "stat-grid", stats: [...] },
    { type: "cta", title: "Let's talk" }
  ]
};
```

The CLI (separate package) injects this before bootstrapping CSMA. The agent writes the JSON; the CLI builds the HTML.

---

## 4. Contracts

### 4.1 Navigation intents (user → service)

| Contract | Payload | Rate limit | Notes |
|---|---|---|---|
| `INTENT_SLIDE_NEXT` | `{ timestamp: number() }` | 10/sec session | Keyboard/clicker spam guard |
| `INTENT_SLIDE_PREV` | `{ timestamp: number() }` | 10/sec session | |
| `INTENT_SLIDE_GO` | `{ index: number(), timestamp: number() }` | 5/sec session | |
| `INTENT_SLIDE_FIRST` | `{ timestamp: number() }` | 5/sec session | Home key |
| `INTENT_SLIDE_LAST` | `{ timestamp: number() }` | 5/sec session | End key |
| `INTENT_SLIDE_TOGGLE_RAIL` | `{ timestamp: number() }` | 5/sec session | S key |
| `INTENT_SLIDE_TOGGLE_GRID` | `{ timestamp: number() }` | 5/sec session | G key |
| `INTENT_SLIDE_TOGGLE_FS` | `{ timestamp: number() }` | 3/sec session | F key |
| `INTENT_SLIDE_TOGGLE_DRAWING` | `{ timestamp: number() }` | 5/sec session | A key |
| `INTENT_SLIDE_OPEN_PRESENTER` | `{ timestamp: number() }` | 2/sec session | P key |
| `INTENT_SLIDE_HIDE_UI` | `{ timestamp: number() }` | 5/sec session | H key |

### 4.2 Annotation intents

| Contract | Payload | Rate limit |
|---|---|---|
| `INTENT_ANNOTATION_STROKE` | `{ slide: number(), points: array(), color: string(), width: number() }` | 120/sec session |
| `INTENT_ANNOTATION_CLEAR` | `{ slide: number() }` | 5/sec session |
| `INTENT_ANNOTATION_UNDO` | `{ slide: number() }` | 5/sec session |

### 4.3 Note intents

| Contract | Payload | Rate limit |
|---|---|---|
| `INTENT_SLIDE_NOTE_UPDATE` | `{ slide: number(), text: size(string(), 0, 5000) }` | 10/sec session |

### 4.4 State change events (service → UI)

| Contract | Payload | Notes |
|---|---|---|
| `SLIDE_CHANGED` | `{ slide: number(), total: number(), clicks: number() }` | Chrome + layouts update |
| `BUILD_ADVANCED` | `{ slide: number(), click: number(), maxClicks: number() }` | Build elements toggle visibility |
| `DECK_READY` | `{ total: number(), config: object() }` | Chrome mounts, first render complete |
| `DECK_DESTROYED` | `{}` | Cleanup signal |
| `UI_STATE_CHANGED` | `{ railOpen: boolean(), gridOpen: boolean(), drawing: boolean(), fs: boolean(), uiHidden: boolean() }` | Chrome visibility toggle |
| `PRESENTER_SYNC` | `{ slide: number(), clicks: number() }` | Cross-tab sync via CrossTabLeader |
| `ANNOTATION_UPDATED` | `{ slide: number(), strokes: array() }` | SVG overlay re-render |

### 4.5 Export intents (future, for CLI)

| Contract | Payload | Notes |
|---|---|---|
| `INTENT_DECK_EXPORT_PNG` | `{ slide: number(), width: number(), height: number(), scale: number() }` | Uses CanvasCodec |
| `DECK_EXPORT_COMPLETED` | `{ slide: number(), blob: object(), mimeType: string() }` | |

---

## 5. SlideDeckService

### 5.1 Class skeleton

```js
export class SlideDeckService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.slides = [];           // config slides array
    this.index = 0;             // current slide index
    this.clicks = 0;            // current slide click count
    this.maxClicks = new Map(); // slide index → max build steps
    this.annotations = new Map(); // slide index → Stroke[]
    this.notes = new Map();     // slide index → string
    this.listeners = [];        // EventBus unsubscribe fns

    // UI state
    this.railOpen = false;
    this.gridOpen = false;
    this.drawing = false;
    this.fs = false;
    this.uiHidden = false;

    // Cross-tab
    this.presenterChannel = null;
    this.leaderService = null;

    this.setupSubscriptions();
  }

  init(config = window.__DECK_CONFIG__) {
    if (!config?.slides?.length) {
      console.warn('[SlideDeck] No slides configured');
      return;
    }
    this.slides = config.slides;
    this.eventBus.publish('DECK_READY', {
      total: this.slides.length,
      config
    });
    this._syncHash(this.index);
  }

  setupSubscriptions() { /* subscribe to all INTENT_SLIDE_* events */ }
  next() { /* advance click → advance slide logic */ }
  prev() { /* reverse click → reverse slide logic */ }
  go(index) { /* jump to slide, reset clicks */ }
  toggleRail() { /* toggle + publish UI_STATE_CHANGED */ }
  // ... etc

  destroy() {
    this.listeners.forEach(fn => fn());
    this.listeners = [];
    this.maxClicks.clear();
    this.annotations.clear();
    this.notes.clear();
    this.eventBus.publish('DECK_DESTROYED', {});
  }
}
```

### 5.2 The next() algorithm (core loop)

```
next():
  1. if clicks < maxClicks.get(index):
       clicks++
       publish BUILD_ADVANCED({ slide: index, click: clicks, maxClicks })
       return
  2. if index < slides.length - 1:
       index++
       clicks = 0
       publish SLIDE_CHANGED({ slide: index, total: slides.length, clicks: 0 })
       syncHash(index)
       return
  3. // at end — no-op
```

### 5.3 registerMax (called by Build elements)

Every `<Build at={n}>` calls `registerMax(n)` on mount. The service tracks `maxClicks.set(index, Math.max(current, n))`. This is the same pattern as bolt-slides' `DeckContext.registerMax`.

### 5.4 Cross-tab sync

```js
// In init(), if CrossTabLeader is available:
const leader = this.eventBus.serviceManager?.get?.('leader');
if (leader) {
  this.leaderService = leader;
  leader.onMessage('slides-sync', (msg) => {
    if (msg.type === 'state') {
      this.index = msg.slide;
      this.clicks = msg.clicks;
      this.eventBus.publish('PRESENTER_SYNC', { slide: msg.slide, clicks: msg.clicks });
    }
  });
}
```

---

## 6. Engine

### 6.1 deck.js — DOM factory

```
export function mountDeck(container, service, eventBus) → cleanup()

Responsibilities:
  - Creates .deck > .slide-stage container
  - Renders current slide using layout factory from config
  - Binds keyboard shortcuts → publishes intents
  - Syncs URL hash from SLIDE_CHANGED events
  - Mounts chrome (dock, rail, grid, presenter)
  - Mounts annotator overlay
  - Returns cleanup function (removes DOM, unbinds keys)
```

Keyboard dispatch (no React synthetic events — direct `addEventListener`):

```js
function bindKeys(eventBus) {
  const handler = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || document.activeElement?.isContentEditable) return;

    const map = {
      ArrowRight: 'INTENT_SLIDE_NEXT',
      ArrowDown:  'INTENT_SLIDE_NEXT',
      ' ':        'INTENT_SLIDE_NEXT',
      PageDown:   'INTENT_SLIDE_NEXT',
      ArrowLeft:  'INTENT_SLIDE_PREV',
      ArrowUp:    'INTENT_SLIDE_PREV',
      PageUp:     'INTENT_SLIDE_PREV',
      Home:       'INTENT_SLIDE_FIRST',
      End:        'INTENT_SLIDE_LAST',
      s: 'INTENT_SLIDE_TOGGLE_RAIL',
      S: 'INTENT_SLIDE_TOGGLE_RAIL',
      g: 'INTENT_SLIDE_TOGGLE_GRID',
      G: 'INTENT_SLIDE_TOGGLE_GRID',
      f: 'INTENT_SLIDE_TOGGLE_FS',
      F: 'INTENT_SLIDE_TOGGLE_FS',
      a: 'INTENT_SLIDE_TOGGLE_DRAWING',
      A: 'INTENT_SLIDE_TOGGLE_DRAWING',
      p: 'INTENT_SLIDE_OPEN_PRESENTER',
      P: 'INTENT_SLIDE_OPEN_PRESENTER',
      h: 'INTENT_SLIDE_HIDE_UI',
      H: 'INTENT_SLIDE_HIDE_UI',
      Escape: 'INTENT_SLIDE_ESCAPE',
    };

    const intent = map[e.key];
    if (intent) {
      e.preventDefault();
      eventBus.publish(intent, { timestamp: Date.now() });
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
```

### 6.2 build.js — click-build state

```
export function createBuildElement(props) → HTMLElement

  Creates a .build wrapper with data-visible="false"
  Calls service.registerMax(props.at) on mount
  Subscribes to BUILD_ADVANCED → toggles data-visible
  CSS transition handles the animation
```

Each layout factory wraps progressive-reveal content in `createBuildElement({ at: n, children: [...] })`.

### 6.3 transitions.js — slide enter/exit

```
export function animateSlideTransition(stage, direction) → Promise<void>

  Sets data-transition="exit direction-left|right"
  Listens for animationend
  Swaps slide content
  Sets data-transition="enter direction-left|right"
  Resolves when enter animation completes
```

Two CSS keyframes: `slide-exit-left`, `slide-exit-right`, `slide-enter-left`, `slide-enter-right`. All use `transform: translateX(...)` + `opacity`. Respects `prefers-reduced-motion`.

### 6.4 thumbnails.js — canvas previews

Uses `html2canvas`-style approach (or a simplified version using CSMA's `CanvasCodec`):

```
export async function renderThumbnail(slideEl, scale = 0.15) → HTMLCanvasElement

  1. Clone slideEl with computed styles
  2. Draw to offscreen canvas at scale
  3. Return canvas element
```

Used by rail and grid chrome. Thumbnails render at true viewport size, scaled down — identical to bolt-slides' `Thumb` component.

### 6.5 annotator.js — SVG drawing overlay

Port of bolt-slides' `Annotator.tsx` to vanilla JS. Creates an SVG overlay on the slide stage. Listens to pointer events when `drawing` is active. Publishes `INTENT_ANNOTATION_STROKE` with point arrays. Reads `ANNOTATION_UPDATED` to render persisted strokes.

---

## 7. Chrome UI

All chrome components are Type II — they subscribe to EventBus events and update their DOM accordingly.

### 7.1 dock.js — floating toolbar

```
export function initDock(container, eventBus) → cleanup()

  Subscribes to: SLIDE_CHANGED, UI_STATE_CHANGED
  Publishes: INTENT_SLIDE_NEXT, INTENT_SLIDE_PREV, INTENT_SLIDE_TOGGLE_RAIL, etc.
  Renders: prev button, counter (slide/total), next button, tool buttons
  Hides when uiHidden=true AND not nearDock (mouse proximity)
```

Two rows on desktop (nav cluster + tools), stacked on mobile. Uses CSMA's `.cluster` layout.

### 7.2 rail.js — thumbnail sidebar

```
export function initRail(container, eventBus) → cleanup()

  Subscribes to: SLIDE_CHANGED, UI_STATE_CHANGED
  Publishes: INTENT_SLIDE_GO
  Renders: slide thumbnails list, click to navigate
  Visible when railOpen=true
```

### 7.3 grid.js — grid overview

```
export function initGrid(container, eventBus) → cleanup()

  Subscribes to: SLIDE_CHANGED, UI_STATE_CHANGED
  Publishes: INTENT_SLIDE_GO
  Renders: responsive grid of thumbnails
  Visible when gridOpen=true
```

### 7.4 presenter.js — presenter overlay

```
export function initPresenter(container, eventBus) → cleanup()

  Subscribes to: SLIDE_CHANGED, PRESENTER_SYNC
  Publishes: INTENT_SLIDE_NOTE_UPDATE
  Renders: current slide + next slide preview + notes textarea + elapsed timer
  Only mounted when ?presenter=1 is in URL
  Persists notes to localStorage (device-scoped, same as bolt-slides)
```

---

## 8. Layout Factories

### 8.1 Factory pattern

Every layout exports a single function:

```js
export function createXxxSlide(props) → HTMLElement
```

Props come from `window.__DECK_CONFIG__.slides[i]`. The function:
1. Creates a `.slide` container
2. Sets `data-layout="xxx"`
3. Builds child DOM nodes with `textContent`
4. Wraps progressive elements in `createBuildElement()`
5. Returns the complete element

No layout factory imports React, uses JSX, or touches the EventBus directly. They are pure DOM constructors.

### 8.2 Layout catalog

| Factory | Config shape | Notes |
|---|---|---|
| `createCoverSlide` | `{ kicker, title, subtitle, foot?, image? }` | Full-viewport cover. If `image`, adds scrimmed background |
| `createSplitSlide` | `{ kicker?, title, body?, media, flip? }` | Two-column. `media` can be `<img>`, canvas chart, BrowserFrame |
| `createBentoSlide` | `{ kicker?, title?, tiles[] }` | Asymmetric grid. Tiles have `{ c, r, variant, ... }` |
| `createGlobeSlide` | `{ kicker?, title?, body?, markers[], arcs[], stats[] }` | Canvas 3D globe, drag-to-spin |
| `createStatGridSlide` | `{ kicker?, title?, stats[] }` | Auto-grid proof cards with CountUp values |
| `createBigNumberSlide` | `{ kicker?, value, caption, foot? }` | One enormous accent number |
| `createContrastSlide` | `{ kicker?, title?, left, right }` | Before/after comparison panels |
| `createQuoteSlide` | `{ text, name, role, image? }` | Pull-quote with accent mark |
| `createComparisonSlide` | `{ kicker?, title?, cols[], rows[], highlight? }` | Feature matrix table |
| `createTableSlide` | `{ kicker?, title?, columns[], rows[], highlightCol?, caption? }` | Data table |
| `createStepsSlide` | `{ kicker?, title?, items[] }` | Horizontal numbered process |
| `createTimelineSlide` | `{ kicker?, title?, items[] }` | Vertical roadmap with connector |
| `createChatSlide` | `{ kicker?, title?, name?, messages[] }` | Message bubbles, each wrapped in Build |
| `createPricingSlide` | `{ kicker?, title?, tiers[] }` | Tier cards, `highlight: true` gets accent badge |
| `createAccordionSlide` | `{ kicker?, title?, items[] }` | Expand/collapse panels (uses `<details>` if possible) |
| `createTabsSlide` | `{ kicker?, title?, tabs[] }` | Tabbed content with sliding pill |
| `createTeamSlide` | `{ kicker?, title?, people[] }` | People grid with initials or img |
| `createCodeWindowSlide` | config passed to layout wrapper | Slide wrapper around CodeWindow |
| `createBrowserFrameSlide` | config passed to layout wrapper | Slide wrapper around BrowserFrame |
| `createSpotlightCardSlide` | config passed to layout wrapper | Cards with cursor-follow glow |
| `createAgendaSlide` | `{ kicker?, title?, items[] }` | Numbered TOC rows |
| `createSectionSlide` | `{ n, kicker?, title? }` | Chapter divider, ghost number |
| `createMarqueeSlide` | `{ items[] }` | Logo strip |

### 8.3 Slide wrapper convention

Layouts that need a full slide wrapper (cover, split, bento, etc.) create their own `.slide` div. Layouts that are content-only (comparison, table, accordion) return content that gets wrapped by the caller:

```js
// In deck.js renderSlide():
const layoutMap = {
  cover: createCoverSlide,
  split: createSplitSlide,
  // ...
  comparison: createComparisonSlide,  // returns content, deck wraps in <Slide center>
  table: createTableSlide,
  // ...
};

export function renderSlide(config) {
  const factory = layoutMap[config.type];
  if (!factory) {
    console.warn(`[Slides] Unknown layout: ${config.type}`);
    return createFallbackSlide(config);
  }
  return factory(config);
}
```

---

## 9. CSS

### 9.1 Slide scaffold (`slides.css`)

```css
/* Full-viewport slide stage */
.deck {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--background);
  color: var(--foreground);
}

.slide-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Individual slide */
.slide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.slide.center {
  align-items: center;
  justify-content: center;
  text-align: center;
}

.slide.full {
  padding: 0;
}

/* Container for non-full slides */
.slide > .container {
  width: 100%;
  max-width: var(--layout-container-wide);
  margin-inline: auto;
  padding: var(--space-xl);
}

/* Build reveal animation — the signature */
.build {
  transition:
    opacity var(--transition-normal) var(--ease-out),
    transform var(--transition-slow) var(--ease-out),
    filter var(--transition-slow) var(--ease-out);
}

.build[data-visible="false"] {
  opacity: 0;
  transform: translateY(16px);
  filter: blur(3px);
  pointer-events: none;
}

.build[data-visible="true"] {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

/* Slide transitions */
@keyframes slide-enter-right {
  from { transform: translateX(40px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes slide-exit-left {
  from { transform: translateX(0);     opacity: 1; }
  to   { transform: translateX(-40px); opacity: 0; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .build,
  .slide-stage[data-transition] .slide {
    transition: none;
    animation: none;
  }
  .build[data-visible="false"] {
    opacity: 0;
    transform: none;
    filter: none;
  }
  .build[data-visible="true"] {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
```

### 9.2 Chrome CSS (`dock.css`)

The dock is a floating glass bar at the bottom center. Uses CSMA tokens exclusively:

```css
.noir-dock {
  position: fixed;
  bottom: var(--space-lg);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
  z-index: var(--z-tooltip);
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

.noir-dock.hidden {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
  pointer-events: none;
}
```

### 9.3 Token usage policy

The slides module **consumes** tokens, never creates them. It uses:

- `--space-*` for all spacing
- `--radius-*` for all border radii
- `--shadow-*` for depth
- `--transition-*` for animation timing
- `--font-size-*`, `--font-weight-*` for typography
- `--background`, `--surface`, `--foreground`, `--border` for chrome
- `--primary`, `--accent` for highlights

If a slide layout needs a token that doesn't exist (e.g., `--slide-cover-min-height`), it uses a computed value or a closest existing token. No new token creation without reviewing `src/style/token-overrides.json`.

---

## 10. Implementation Phases

### Phase 1: Core engine (skeleton)

**Goal:** A working deck with navigation, keyboard, hash sync.

**Files:**
- `contracts/slides-contracts.js` — nav intents + state events
- `services/SlideDeckService.js` — state machine
- `engine/deck.js` — DOM factory + keyboard bindings
- `slides.css` — slide scaffold + build animation

**Verification:** Load a dummy config with 3 slides. Arrow keys navigate. `#1`, `#2`, `#3` in URL. Builds reveal on click.

### Phase 2: Chrome

**Goal:** Dock, rail, grid, presenter.

**Files:**
- `chrome/dock.js`, `chrome/rail.js`, `chrome/grid.js`, `chrome/presenter.js`
- `engine/thumbnails.js`
- `dock.css`

**Verification:** Dock appears, S opens sidebar, G opens grid, P opens presenter tab with cross-tab sync. H hides UI. F toggles fullscreen.

### Phase 3: First 6 layouts

**Goal:** Cover the most-used layouts.

**Files:**
- `layouts/cover.js`, `layouts/split.js`, `layouts/bento.js`
- `layouts/stat-grid.js`, `layouts/big-number.js`, `layouts/quote.js`
- `ui/count-up.js`
- `layouts.css`

**Verification:** Full config with these 6 types renders correctly. Responsive at 480px, 768px, 1280px.

### Phase 4: Remaining 18 layouts

**Goal:** Complete layout catalog.

**Files:** All remaining `layouts/*.js` files.

**Verification:** Every layout in bolt-slides has a CSMA equivalent. Responsive. Respects `prefers-reduced-motion`.

### Phase 5: Annotator + media export

**Goal:** Drawing overlay + slide → PNG pipeline.

**Files:**
- `engine/annotator.js`
- Export contracts in `slides-contracts.js`
- `print.css`

**Verification:** A key activates drawing. Strokes persist per slide. `media` module can export slides to PNG.

### Phase 6: CLI (separate package)

**Goal:** `csma-slides build deck.json` produces a deployable HTML.

**Package:** `@csma/slides-cli` (or standalone script).

**Commands:**
- `csma-slides init my-deck` — scaffold CSMA project with slides module
- `csma-slides build deck.json` — inject config, build with Vite
- `csma-slides export png` — headless PNG export
- `csma-slides deploy` — upload to CDN

---

## 11. Agent Integration

### 11.1 Agent writes JSON

The agent never writes JS, CSS, or HTML for slides. It writes a single JSON config:

```json
{
  "title": "Acme — Series A",
  "theme": {
    "primary": "#7C3AED",
    "mode": "dark",
    "font": "Inter"
  },
  "slides": [
    { "type": "cover", "kicker": "Series A", "title": "Acme", "subtitle": "The future of widget delivery" },
    { "type": "big-number", "value": "4.2M", "caption": "ARR, up 3× YoY" },
    { "type": "contrast", "kicker": "The shift", "left": { "label": "Before", "points": ["..."] }, "right": { "label": "With Acme", "points": ["..."] } },
    { "type": "cta", "title": "Let's talk", "subtitle": "hello@acme.com" }
  ]
}
```

### 11.2 CLI compiles JSON to HTML

```bash
# Agent runs:
npx csma-slides build deck.json --output dist/
# → produces dist/index.html (CSMA + slides module + injected config)
# → dist/assets/*.js, dist/assets/*.css

npx csma-slides export png --output slides/
# → produces slides/slide-01.png ... slides/slide-NN.png

npx csma-slides deploy --target cloudflare-pages
# → uploads to CDN, returns URL
```

### 11.3 Agent drives live deck

If the agent needs to control a running deck (e.g., for recording), it publishes intents:

```js
// Agent publishes:
eventBus.publish('INTENT_SLIDE_GO', { index: 5, timestamp: Date.now() });
// → deck navigates to slide 6

eventBus.publish('INTENT_SLIDE_NEXT', { timestamp: Date.now() });
// → advances one build step or slide
```

All validated, rate-limited, logged via the observability module.

---

## 12. SKILL.md — Agent Authoring Skill

The file `src/modules/slides/SKILL.md` is the agent's entry point for building decks. It ships as a CSMA skill and is loaded by Pi/Codex/Claude when a user asks for a presentation. It contains everything the agent needs — layout selection rules, config schema, writing discipline, theme surface, and the build/present/deploy loop.

### 12.1 Skill frontmatter

```yaml
---
name: csma-slides
description: >-
  Build a premium PRESENTED slide deck — classic one-slide-at-a-time slides you
  advance with a clicker — as a CSMA app. Slides are RESPONSIVE (reflow to any
  screen, no fixed canvas) and fully interactive. Use this when the user asks for
  a presentation, pitch deck, slide deck, or any talk you'll PRESENT (projector,
  screen-share). The CSMA runtime IS the app — theme the tokens, author slides as
  JSON, build and present.
---
```

### 12.2 Required reading chain

The skill instructs the agent to load these CSMA docs before authoring:

```
1. docs/architecture/SKILL.md     — CSMA rules (textContent, data-*, CSS state)
2. docs/animation/SKILL.md        — CSS-first motion, reduced-motion, GSAP escalation
3. docs/patterns/SKILL.md         — layout recipes, Type I/II, token reference
4. docs/security/SKILL.md         — input sanitization, contract validation
5. src/style/generated/tokens.css — available tokens (read, don't edit)
```

### 12.3 Grounding the deck

The skill's Step 0:

> Use the user's real topic, brand, document, facts. Never fabricate a placeholder
> company, logo, or quote for a real subject. If a brand is given, the theme comes
> from that brand — fetch the page for real colors/font, or use the brand's known
> palette, or STOP and ask. Report which colors/fonts you used and where from.

### 12.4 Theme surface

The skill describes the theme surface:

> All color, type, radius, depth, and motion live in `--*` tokens in
> `src/style/generated/tokens.css`. The slides module consumes these tokens —
> never creates new ones. Edit `src/style/token-overrides.json` then run
> `npm run tokens:patch` for app-specific overrides. Set fonts in
> `--font-family-base` / `--font-family-heading`. Dark vs light:
> `document.documentElement.dataset.theme = 'light' | 'dark'`.
>
> **Tab title + icon — always, unprompted.** Set `<title>` to the deck's real
> title (e.g. "Acme — Series A") and swap the favicon emoji for one that fits
> the topic. Do this for every deck without being asked.

### 12.5 Layout selection rules

This is the core agent guidance — which layout for which content. The skill presents it as a decision table:

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

### 12.6 The centering rule (hard rule)

Ported directly from the bolt-slides skill:

> **Center what stands alone.** Ask of every slide: *does it have a side visual*
> (a `split` media panel, an image, a `browser-frame`, a chart beside text)?
> - **No side visual** (only text, or one structured block like `comparison` /
>   `tabs` / `timeline` / `accordion` / `stat-grid`) → the slide MUST be centered:
>   set `center: true` on the slide, or center the heading with
>   `textAlign: 'center'` + `marginInline: 'auto'` on every block below it.
> - **Yes** → left-aligned/asymmetric is allowed; the visual balances the text.
> A lone left-anchored block floating in empty space is the #1 alignment bug —
> never ship one.

### 12.7 Layout discipline (entry conditions)

Every specialty layout has an **entry condition**. If the content doesn't meet it, the layout does not appear:

- **`chat`** — ONLY if the product genuinely has a conversational / AI interface, and the exchange shown is a real, plausible use of it. Never decoration for a non-chat product.
- **`pricing`** — only when pricing is actually part of this deck's ask.
- **`team`** — pitch and agency decks; skip in launches, reports, teaching.
- **`section`** — only in decks long enough to have real chapters (~12+ slides).
- **`big-number`** — needs one real, defensible figure (cite it in `foot`). At most one per deck — two giant numbers cancel each other out.
- **`contrast`** — when a genuine before/after exists; don't build a strawman.
- **`agenda`** — formal or long presentations; an 8-slide pitch needs no TOC.
- **`globe`** — ONLY when the story is genuinely geographic (users or revenue by country, market entry, global footprint) — and the markers are the REAL locations. Never as a generic "we're global" flourish.

The workhorses are `cover`, `split`, `bento`, `stat-grid`, `quote`, `big-number`, `steps`, `cta` and the text atoms; specialty layouts appear **at most once each**, when the content calls for them. If you can't say in one sentence why a layout serves *this* deck, cut it.

### 12.8 Slide writing rules

Ported from hyperframes slideshow skill + bolt-slides skill:

- **Headline is a complete-sentence claim, not a label.** Write "SMBs spend 14 hours/week on manual scheduling" not "Scheduling problem".
- **One idea + one visual per slide.** If tempted to add a second bullet cluster or second chart, split the slide.
- **Lead with the punchline.** The strongest point goes first — on the slide and in the deck order.
- **1–3 word kickers.** Sentence case. Short, declarative.
- **Body 1–3 tight sentences.** No paragraphs. No lorem ipsum.
- **Use the user's real numbers.** Never invent numbers for a real brand.
- **Add `notes` for talking points.** One sentence per slide is enough.

### 12.9 The JSON config

The agent's only deliverable is a JSON config written to `deck.json`. The skill provides the complete schema reference.

#### Top-level structure

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

#### Slide configs — per-type schema

**cover**
```json
{
  "type": "cover",
  "kicker": "Series A pitch",
  "title": "Acme",
  "subtitle": "The future of widget delivery",
  "foot": "June 2026",
  "image": "/assets/hero.webp",
  "notes": "Welcome — introduce yourself, then set up the problem."
}
```
| Field | Required | Notes |
|---|---|---|
| `kicker` | yes | 1–4 words, muted tone. Sets the stage. |
| `title` | yes | Display text. Can include `{ "accent": "word" }` for accent highlighting. |
| `subtitle` | yes | One sentence. What the deck is about. |
| `foot` | no | Date, event name, or context line. |
| `image` | no | Path to background image. Adds a scrim under text. |
| `notes` | no | Presenter-only. Shown in presenter mode. |

**big-number**
```json
{
  "type": "big-number",
  "kicker": "Every day",
  "value": { "number": 2.4, "decimals": 1, "suffix": "B" },
  "caption": "events answered in under a second.",
  "foot": "Production traffic, trailing 30 days",
  "notes": "Let the number breathe. One sentence, then move."
}
```
| Field | Required | Notes |
|---|---|---|
| `value.number` | yes | The figure. |
| `value.decimals` | no | Decimal places. Default: 0. |
| `value.prefix` | no | String before number (e.g. `"$"`). |
| `value.suffix` | no | String after number (e.g. `"M"`, `"%"`). |
| `caption` | yes | One sentence contextualizing the number. |
| `foot` | no | Source citation. Required for real data. |

**contrast**
```json
{
  "type": "contrast",
  "kicker": "The shift",
  "title": "Stop digging. Start asking.",
  "left": {
    "label": "Before",
    "title": "Dashboard sprawl",
    "points": ["Forty dashboards, zero answers", "Analysts as human query engines"]
  },
  "right": {
    "label": "With Acme",
    "title": "Answers on tap",
    "points": ["Ask in plain English", "Sub-second, source-linked answers"]
  },
  "notes": "Let the left panel sting before talking to the right one."
}
```

**split**
```json
{
  "type": "split",
  "kicker": "Developer-first",
  "title": "Drop-in simple.",
  "body": "Add it to your app in three lines. No SDK to learn.",
  "media": { "type": "code-window", "title": "app.ts", "highlight": [3], "code": "..." },
  "flip": false,
  "notes": "If there's an engineer in the room, this is the slide for them."
}
```
| Field | Required | Notes |
|---|---|---|
| `body` | yes | 1–3 sentences of explanatory text. |
| `media` | yes | Embedded config for a visual: `{ "type": "image", "src": "..." }`, `{ "type": "code-window", ... }`, `{ "type": "browser-frame", ... }`, `{ "type": "globe", ... }`, `{ "type": "chart", ... }`, or `{ "type": "panel", "color": "..." }` |
| `flip` | no | Swap text/media sides. Default: false (text left, media right). |

**bento**
```json
{
  "type": "bento",
  "kicker": "One platform",
  "title": "Everything in one place.",
  "tiles": [
    { "k": "Throughput", "fig": { "number": 9.4, "decimals": 1, "suffix": "M" }, "body": "events / min at peak.", "c": 5, "r": 2, "variant": "glow" },
    { "k": "Uptime", "fig": { "number": 99.99, "decimals": 2, "suffix": "%" }, "c": 4 },
    { "k": "Regions", "fig": { "number": 28 }, "c": 3, "variant": "accent" },
    { "k": "Connectors", "title": "120+ native", "body": "Snowflake, Kafka, dbt…", "c": 4 },
    { "k": "Compliance", "title": "SOC 2 · HIPAA", "c": 3 }
  ],
  "notes": "Don't read every tile — let them scan."
}
```
| Tile field | Required | Notes |
|---|---|---|
| `k` | yes | Tile label (kicker-sized, muted). |
| `fig` | no | CountUp config for the figure. |
| `title` | no | Bold short string. Alternative to `fig`. |
| `body` | no | One sentence. |
| `c` | no | Column span. Default: 1. |
| `r` | no | Row span. Default: 1. |
| `variant` | no | `"glow"`, `"accent"`, or omitted (default surface). |
| `img` | no | Path to image for full-bleed photo tile. |

**stat-grid**
```json
{
  "type": "stat-grid",
  "kicker": "Traction",
  "title": "Numbers that compound.",
  "stats": [
    { "value": { "number": 4.2, "decimals": 1, "prefix": "$", "suffix": "M" }, "label": "ARR", "caption": "up 3× year over year" },
    { "value": { "number": 92, "suffix": "%" }, "label": "Net retention", "caption": "best in class" },
    { "value": { "number": 120, "suffix": "+" }, "label": "Enterprise logos", "caption": "across six industries" }
  ],
  "notes": "These are the headline numbers investors remember."
}
```

**quote**
```json
{
  "type": "quote",
  "text": "We replaced four tools with Acme and never looked back.",
  "name": "Dana Kim",
  "role": "VP Engineering, Globex",
  "image": "/assets/quote-bg.webp",
  "notes": "Read it slowly, then stay silent for a second."
}
```

**comparison**
```json
{
  "type": "comparison",
  "kicker": "Why teams switch",
  "title": "The honest comparison.",
  "cols": ["", "Acme", "Legacy tools"],
  "highlight": 0,
  "rows": [
    { "label": "Realtime by default", "values": [true, false] },
    { "label": "Time to first insight", "values": ["5 min", "2 weeks"] },
    { "label": "Starting price", "values": ["$29", "$99"] }
  ]
}
```
| Field | Required | Notes |
|---|---|---|
| `rows[].values` | yes | Array of values, one per column. `true` renders a checkmark, `false` renders a cross. |
| `highlight` | no | Column index to accent-highlight (0-based). |

**table**
```json
{
  "type": "table",
  "kicker": "Unit economics",
  "title": "Growth, by region.",
  "columns": ["Region", "ARR", "Growth", "NRR", "Payback"],
  "rows": [
    ["North America", "$2.4M", "+38%", "124%", "11 mo"],
    ["Europe", "$1.1M", "+52%", "118%", "13 mo"]
  ],
  "highlightCol": 2,
  "caption": "Company data, FY25"
}
```

**steps**
```json
{
  "type": "steps",
  "kicker": "How it works",
  "title": "Three steps to live data.",
  "items": [
    { "title": "Connect", "body": "Point Acme at your warehouse. No schema to define." },
    { "title": "Model", "body": "It learns your entities and builds the metric graph." },
    { "title": "Act", "body": "Ask questions in plain English; alerts fire before dashboards notice." }
  ]
}
```

**timeline**
```json
{
  "type": "timeline",
  "kicker": "Where we're going",
  "title": "The roadmap.",
  "items": [
    { "time": "Shipped", "title": "Realtime core", "body": "Sub-second metrics across 28 regions." },
    { "time": "Now", "title": "AI insights", "body": "Plain-English answers from your data." },
    { "time": "Next", "title": "Enterprise", "body": "SSO, audit logs, and on-prem." }
  ]
}
```

**chat**
```json
{
  "type": "chat",
  "kicker": "Ask anything",
  "title": "Plain English in. Answers out.",
  "name": "Acme",
  "messages": [
    { "from": "user", "text": "Why did signups dip last week?" },
    { "from": "ai", "text": "Signups fell 12% after Tuesday's pricing-page change. The drop is entirely mobile — desktop is flat." },
    { "from": "user", "text": "Roll it back for mobile only?" },
    { "from": "ai", "text": "Done. I'll alert you when the trend recovers." }
  ]
}
```
Messages are automatically wrapped in `Build at={1}`, `Build at={2}`, etc. Each click reveals one message.

**pricing**
```json
{
  "type": "pricing",
  "kicker": "Pricing",
  "title": "Simple, honest plans.",
  "tiers": [
    { "name": "Starter", "price": "$29", "period": "/mo", "blurb": "For small teams.", "features": ["1M events/month", "Realtime dashboards"] },
    { "name": "Pro", "price": "$79", "period": "/mo", "blurb": "For growing teams.", "features": ["10M events/month", "AI insights", "Self-host"], "highlight": true },
    { "name": "Enterprise", "price": "Custom", "blurb": "Scale and control.", "features": ["Unlimited events", "SSO", "On-prem"] }
  ]
}
```

**accordion**
```json
{
  "type": "accordion",
  "kicker": "Common questions",
  "title": "Frequently asked.",
  "items": [
    { "title": "How long does setup take?", "body": "Five minutes — point Acme at your warehouse and you are live." },
    { "title": "Can we self-host?", "body": "Yes. A Docker image and Terraform module ship with every plan." }
  ]
}
```

**tabs**
```json
{
  "type": "tabs",
  "kicker": "One platform",
  "title": "Built for every team.",
  "tabs": [
    { "label": "Engineering", "body": "Trace any request end-to-end, alert on anomalies." },
    { "label": "Data", "chart": { "type": "bar", "data": [{ "label": "Mon", "value": 38 }, ... ] } },
    { "label": "Ops", "body": "One source of truth for uptime, cost, and capacity." }
  ]
}
```

**team**
```json
{
  "type": "team",
  "kicker": "The team",
  "title": "Built by operators.",
  "people": [
    { "name": "Dana Kim", "role": "CEO · ex-Stripe", "img": "/assets/dana.webp" },
    { "name": "Ade Obi", "role": "CTO · ex-Datadog" }
  ]
}
```

**agenda**
```json
{
  "type": "agenda",
  "kicker": "Agenda",
  "title": "What we'll cover.",
  "items": [
    "The problem",
    "How Acme works",
    { "title": "Pricing & the ask", "hint": "5 min" }
  ]
}
```

**section**
```json
{
  "type": "section",
  "n": 2,
  "kicker": "Part two",
  "title": "How it works."
}
```

**code-window** (embedded in split or standalone)
```json
{
  "type": "code-window",
  "title": "app.ts",
  "highlight": [3],
  "code": "import { track } from '@acme/sdk'\n\ntrack('signup', {\n  plan: 'pro',\n  source: 'landing',\n})"
}
```

**browser-frame** (embedded in split or standalone)
```json
{
  "type": "browser-frame",
  "url": "app.acme.dev",
  "screenshot": "/assets/app-mock.webp"
}
```

**spotlight-card**
```json
{
  "type": "spotlight-card",
  "kicker": "What we believe",
  "title": "Three principles.",
  "cards": [
    { "k": "01", "title": "Fast by default", "body": "Speed is a feature. Everything is realtime." },
    { "k": "02", "title": "Yours to own", "body": "Your data, your infra, no lock-in." },
    { "k": "03", "title": "Honest pricing", "body": "No per-seat tax. Scale without surprises." }
  ]
}
```

**globe**
```json
{
  "type": "globe",
  "kicker": "28 regions",
  "title": "Everywhere your data lives.",
  "body": "Ingest close to the source; answer from the nearest edge.",
  "markers": [
    { "location": [37.77, -122.41], "size": 0.08, "label": "sfo1", "value": "221k evt/s" },
    { "location": [51.5, -0.12], "size": 0.07, "label": "lhr1", "value": "188k evt/s" },
    { "location": [1.35, 103.82], "size": 0.07, "label": "sin1", "value": "96k evt/s" }
  ],
  "arcs": [
    { "from": [37.77, -122.41], "to": [51.5, -0.12] }
  ],
  "stats": [
    { "value": "48%", "label": "North America" },
    { "value": "31%", "label": "EMEA" }
  ]
}
```

**marquee**
```json
{
  "type": "marquee",
  "items": ["Northwind", "Globex", "Initech", "Umbra", "Hooli"]
}
```

**cta**
```json
{
  "type": "cta",
  "title": "Let's talk.",
  "subtitle": "hello@acme.com",
  "notes": "Make the ask explicitly. Leave contact details on screen for questions."
}
```

### 12.10 Interactivity: Build and Reveal

The skill explains the two animation primitives:

**Build** — content reveals on click-advance. Set `build: n` on any element inside a slide:

```json
{
  "type": "slide",
  "center": true,
  "content": [
    { "el": "h2", "className": "headline", "text": "Three things changed." },
    { "build": 1, "el": "p", "className": "lead", "text": "First, the data got bigger." },
    { "build": 2, "el": "p", "className": "lead", "text": "Then, the tools got faster." },
    { "build": 3, "el": "p", "className": "lead", "text": "Now, anyone can ship." }
  ]
}
```

**Reveal** — on-enter entrance (no click needed). Set `reveal: true` on headings, grids, content blocks. Uses `IntersectionObserver` + CSS transition.

**CountUp** — animated number counter. Pass `{ "number": 4.2, "decimals": 1, "suffix": "M" }` as a `value` or `fig` field. Animates on enter.

### 12.11 Text atoms (CSS classes)

The skill lists available typography atoms:

| Class | Use |
|---|---|
| `.display` | Hero text (cover title). `font-size: clamp(40px, 7vw, 96px)`. |
| `.headline` | Slide heading. `font-size: clamp(30px, 4.4vw, 52px)`. |
| `.lead` | Body emphasis. Larger, muted color. |
| `.subhead` | Secondary line under a display or headline. |
| `.kicker` | ALL CAPS small pre-title. `letter-spacing: 0.08em`. |
| `.accent-text` | Span wrapper — colors text with `--primary`. |
| `.foot` | Source line, date, context. Smallest legible size. |

### 12.12 Responsive rules

The skill reinforces:

> Each slide is a **full-viewport responsive layout**, not a fixed canvas — it
> reflows to the screen, so nothing scales-and-clips. Use `%`, `vw`, `rem`,
> `max-width` containers — not fixed pixel widths. One idea per slide, sized to
> fill ~one screen with deliberate negative space. A paged slide CANNOT scroll.

### 12.13 Visuals and imagery

> Data/SaaS → app mock (`browser-frame`), code window, chart. Brand/product →
> generated images in `public/`, one consistent style, used as `split` media or
> full-bleed slide backgrounds under a gradient scrim. No text in images. An
> image in a `split` or as a full-bleed background beats a floating card.

### 12.14 GSAP — optional escalation

```
GSAP is not included in the slides module. If a specific slide needs animation
that CSS cannot express (complex SVG morphing, multi-stage choreography, physics),
GSAP is available as an optional resource. Read docs/animation/SKILL.md § "GSAP
Escalation" before using it. All GSAP timelines must be scoped to the slide's
DOM tree and killed in the slide's cleanup function. Do not add GSAP just
because a slide "feels plain" — fix hierarchy, spacing, typography first.
```

### 12.15 Build and present

```bash
# Agent runs these after writing deck.json:
npx csma-slides build deck.json
# → compiles JSON → HTML + JS + CSS in dist/

npx csma-slides present
# → opens browser with presenter mode ready

npx csma-slides export png --output slides/
# → per-slide PNGs for sharing

npx csma-slides deploy --target cloudflare-pages
# → live URL
```

### 12.16 Definition of done

The skill closes with a self-check list for the agent:

- [ ] Deck title set in `"title"` field — no placeholder left behind.
- [ ] Theme colors match the brand (fetched or confirmed).
- [ ] Only the `theme` object was edited for theming — no token files touched.
- [ ] Slides compose like web sections (full-bleed/asymmetric/bento/split), not centered card rows.
- [ ] Alignment audit: every slide without a side visual is fully centered.
- [ ] No showcase decks: every specialty layout meets its entry condition.
- [ ] Layouts vary — no two adjacent slides share the same shape.
- [ ] One idea per slide. Headlines are claims, not labels.
- [ ] Real numbers. Zero lorem. Zero placeholder names.
- [ ] Notes added to slides for talking points.
- [ ] `npx csma-slides build deck.json` completes with no errors.
- [ ] Deck is 8–16 slides (shorter for micro-decks, longer for keynotes).

---

## 13. Safety Checklist

Every piece of the slides module must pass these checks before being considered done:

### 12.1 CSMA architecture compliance

- [ ] All UI state expressed as CSS classes or `data-*` attributes
- [ ] No inline styles for durable UI state
- [ ] Transient animation styles (canvas, rAF) are cleanup-safe
- [ ] All user-authored text set via `textContent`, never `innerHTML`
- [ ] All visual values reference `var(--token-name)`
- [ ] No raw hex colors or pixel values in JS
- [ ] Token consumption only — no new token creation without review

### 12.2 EventBus compliance

- [ ] Every user interaction publishes an `INTENT_*` contract
- [ ] Every state change publishes a state event
- [ ] All contracts have schemas, owners, lifecycles, and rate limits
- [ ] Schema validation uses CSMA's validation library (superstruct fork)
- [ ] `[error, validated]` destructuring used everywhere

### 12.3 Security compliance

- [ ] Rate limits on all user-facing intents
- [ ] String size limits on all text inputs (`size(string(), 0, N)`)
- [ ] No secrets in config, storage, or EventBus payloads
- [ ] No `eval()`, `Function()`, or dynamic code execution
- [ ] No `innerHTML` for any content (even "trusted")
- [ ] CSP compatible — no inline scripts, no third-party CDN deps

### 12.4 Lifecycle compliance

- [ ] `SlideDeckService.destroy()` unsubscribes all listeners
- [ ] `mountDeck()` returns a cleanup function
- [ ] All chrome `init*()` functions return cleanup functions
- [ ] Canvas/animation loops stop on cleanup
- [ ] `DECK_DESTROYED` published before teardown completes

### 12.5 Accessibility

- [ ] All buttons have accessible labels (`aria-label` or text content)
- [ ] Keyboard navigation works without mouse
- [ ] Focus visible on all interactive chrome elements
- [ ] `prefers-reduced-motion: reduce` disables all motion
- [ ] Slides are readable at 200% zoom
- [ ] Presenter notes textarea is labeled

### 12.6 Responsive

- [ ] Dock layout adapts to mobile (nav cluster above tools)
- [ ] Rail and grid are full-screen on mobile
- [ ] All layouts stack/reflow below `--breakpoint-sm` (480px)
- [ ] No horizontal scroll at any viewport width
- [ ] No content overflow that requires scrolling within a slide

### 12.7 Performance

- [ ] No layout thrashing — reads batched before writes
- [ ] Canvas thumbnails debounced during resize
- [ ] Globe and chart canvases pause when off-screen
- [ ] Keyboard handler is passive, no `requestAnimationFrame` per keystroke
- [ ] Module bundle < 30KB gzipped (target)

---

## 14. References

- `docs/architecture/SKILL.md` — CSMA architecture rules
- `docs/animation/SKILL.md` — CSS-first animation rules
- `docs/security/SKILL.md` — 6-layer security model
- `docs/service-pattern/SKILL.md` — service implementation patterns
- `docs/patterns/SKILL.md` — layout recipes and Type I/II decisions
- `docs/video/SKILL.md` — video asset integration
- `docs/MODULE_IMPLEMENTATION_PLAN.md` — module registration standards
- `src/modules/media/` — reference module (contracts + service + codecs)
- `src/modules/visual-editor/` — reference module (complex service + rendering)
- `src/runtime/Contracts.js` — core contracts pattern
- `src/runtime/ModuleManager.js` — dynamic module loading
- `src/runtime/EventBus.js` — contract validation + rate limiting
- `../bolt-slides/src/deck/` — bolt-slides engine (reference for porting)
- `../bolt-slides/src/components/` — bolt-slides layouts (reference for porting)
