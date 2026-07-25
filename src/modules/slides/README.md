# Slides Module

Presentation deck engine for CSMA. Vanilla JS DOM factories, CSS-driven state,
EventBus contracts. Replaces bolt-slides / Slidev with a headless core that
composes with the rest of CSMA (history, ai-ui, media).

> Status: Wave 2-E, Phases 1–5 complete. Phase 6 (CLI in separate package)
> deferred per plan. Full authoring guide lives in `SKILL.md`.

## Quick start

```js
import { SlideDeckService, mountDeck } from './src/modules/slides/index.js';

window.__DECK_CONFIG__ = {
  title: 'Acme — Series A',
  slides: [
    { type: 'cover', kicker: 'Series A', title: 'Acme', subtitle: 'Widget delivery' },
    { type: 'big-number', value: { number: 4.2, suffix: 'M' }, caption: 'ARR' },
    { type: 'cta', title: 'Let’s talk', subtitle: 'hello@acme.com' }
  ]
};

const service = new SlideDeckService(eventBus);
service.init();           // reads window.__DECK_CONFIG__
mountDeck(document.body, service, eventBus);
```

Load the CSS:

```html
<link rel="stylesheet" href="./src/modules/slides/slides.css">
<link rel="stylesheet" href="./src/modules/slides/dock.css">
<link rel="stylesheet" href="./src/modules/slides/layouts.css">
<link rel="stylesheet" href="./src/modules/slides/print.css">
```

## Keyboard map

| Key | Action |
|-----|--------|
| → ↓ Space PgDn | Next (build step or slide) |
| ← ↑ PgUp | Previous |
| Home / End | First / Last slide |
| S | Toggle thumbnail rail |
| G | Toggle grid overview |
| F | Fullscreen |
| A | Toggle annotation drawing |
| P | Open presenter tab |
| H | Hide UI |
| Esc | Close grid / rail / drawing / fullscreen |

All keys publish a validated `INTENT_SLIDE_*` contract — the agent can drive
the deck by publishing the same intents.

## Layouts (24)

`cover`, `split`, `bento`, `globe`, `stat-grid`, `big-number`, `contrast`,
`quote`, `comparison`, `table`, `steps`, `timeline`, `chat`, `pricing`,
`accordion`, `tabs`, `team`, `code-window`, `browser-frame`, `spotlight-card`,
`agenda`, `section`, `marquee`, `cta`.

Each layout exports `createXxxSlide(props) → HTMLElement`. Pure DOM
construction, textContent only. See `SKILL.md` §12 for the layout selection
rules and JSON config schema.

## Contracts

- 12 navigation intents: `INTENT_SLIDE_{NEXT,PREV,GO,FIRST,LAST,TOGGLE_RAIL,TOGGLE_GRID,TOGGLE_FS,TOGGLE_DRAWING,OPEN_PRESENTER,HIDE_UI,ESCAPE}`
- 3 annotation intents: `INTENT_ANNOTATION_{STROKE,CLEAR,UNDO}`
- 1 note intent: `INTENT_SLIDE_NOTE_UPDATE`
- 2 export intents: `INTENT_DECK_EXPORT_PNG`, `DECK_EXPORT_COMPLETED`
- 7 state events: `SLIDE_CHANGED`, `BUILD_ADVANCED`, `DECK_READY`,
  `DECK_DESTROYED`, `UI_STATE_CHANGED`, `PRESENTER_SYNC`, `ANNOTATION_UPDATED`

All rate-limited per plan §4.

## Out of scope (v1)

- **Phase 6 CLI** — `csma-slides build deck.json` lives in a separate package.
- **Canvas globe renderer** — DOM shell + markers list ships now; full canvas
  port is Phase 5+ follow-up.
- **Media capture / PNG export** — contracts defined, full impl wires the
  `media` module's `CanvasCodec` later.

## Files

```
src/modules/slides/
├── index.js                  ← manifest + exports
├── README.md                 ← this file
├── SKILL.md                  ← agent authoring skill (large)
├── contracts/slides-contracts.js
├── services/SlideDeckService.js
├── engine/                   ← deck, build, transitions, thumbnails, annotator
├── chrome/                   ← dock, rail, grid, presenter
├── layouts/                  ← 24 factories + _shared.js + index.js
├── ui/                       ← count-up, tilt-card
├── slides.css                ← scaffold + build + transitions
├── dock.css                  ← chrome
├── layouts.css               ← per-layout
└── print.css                 ← print media
```
