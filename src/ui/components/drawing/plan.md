# Drawing Component — Plan

## Purpose

`src/ui/components/drawing/` is a **pure SVG freehand drawing layer** — reusable
across any CSMA surface (slides, MorphEditor, whiteboard, mindmap). It handles
pointer capture, stroke rendering, hit-testing, and selection. It does NOT own
state, persistence, undo, or comments — those are wired by the host.

## Separation from slides module

The current implementation in `src/modules/slides/engine/annotator.js` and
`src/modules/slides/slides.css` is ~80% reusable. The remaining ~20% is
CSMA-specific glue (EventBus, SlideDeckService, contracts).

| Concern | Slides module (current) | Drawing component (extracted) |
|---------|------------------------|------------------------------|
| SVG overlay + pointer capture | `annotator.js` (inline) | ✅ Copy directly |
| Stroke data model | Implicit in `addStroke()` | ✅ Extract as plain objects |
| Stroke rendering (`buildPath`) | `annotator.js` (private) | ✅ Export |
| Hit-testing / selection | `annotator.js` + `slides.css` | ✅ CSS `pointer-events: stroke` |
| State management (strokes per slide) | `SlideDeckService.annotations` Map | ❌ Host manages |
| Persistence (IDB) | `AnchorableCommentsService` | ❌ Host manages |
| Undo/redo | `SlideDeckService._undoneStrokes` | ❌ Host manages |
| Comments integration | Demo subscriptions | ❌ Host manages |
| Event contracts | `SlidesContracts` | ❌ Host defines |

## API design

The component exposes a factory function with minimal surface:

```js
import { createDrawingLayer } from '../src/ui/components/drawing/drawing.js';

const layer = createDrawingLayer(container, {
    // Host-provided callbacks
    onStrokeCommit(stroke) → void              // stroke committed (pointer up)
    onStrokeSelect(strokeId) → void            // stroke clicked/selected
    onStrokeDelete(strokeId) → void            // Delete key pressed
    getStrokes() → Stroke[]                    // all strokes (including hidden)
});
```

The **host** (slides demo, MorphEditor, etc.) owns:
- Stroke storage (Map, array, IDB)
- Undo/redo stacks
- Visibility state (`hidden` flag)
- Comment linking
- Event publishing

## File structure

```
src/ui/components/drawing/
├── plan.md          ← this file
├── drawing.js       ← factory + SVG rendering + pointer capture + selection
├── drawing.css      ← SVG overlay, stroke, hover, selected, highlighted styles
└── manifest.json    ← aiui catalog entry
```

## What to extract from slides (reference implementation)

### `drawing.js` (~200 lines)

**From `src/modules/slides/engine/annotator.js`:**

| Section | Lines | Purpose |
|---------|-------|---------|
| SVG creation + `data-active` toggle | ~15 | Create SVG overlay, set attributes |
| `buildPath(stroke)` | ~15 | Stroke → SVG `<path>` element |
| `renderAll(strokes)` | ~10 | Clear + render all paths |
| `toLocalPoint(svg, e)` | ~5 | Pointer event → SVG coordinates |
| Pointer capture (`pointerdown/move/up`) | ~60 | Draw new strokes |
| Selection (`selectStroke`, `deselectAll`, click/Del/Esc) | ~55 | Click to select, keyboard delete |
| Cleanup function | ~10 | Remove listeners, destroy SVG |

**Key changes for extraction:**
- Replace `service.removeStrokeById(id)` with `opts.onStrokeDelete(id)`
- Replace `service.getAnnotations(idx)` with `opts.getStrokes()`
- Replace direct `eventBus.publish` calls with `opts.onStrokeCommit(stroke)`
- Remove all `eventBus` references — host publishes its own events
- Remove all `subs` for EventBus subscriptions — host manages

### `drawing.css` (~60 lines)

**From `src/modules/slides/slides.css`:**

| Rule | Purpose |
|------|---------|
| `.drawing-layer` | Absolute positioned SVG, `pointer-events: none` |
| `.drawing-layer[data-active="true"]` | `pointer-events: auto`, `cursor: crosshair` |
| `.drawing-layer:not([data-active]) .drawing-path` | `pointer-events: stroke`, `cursor: pointer` |
| `.drawing-path` | `stroke: currentColor`, `fill: none` |
| `.drawing-path:hover` | Subtle preview glow (optional) |
| `.drawing-path[data-selected="true"]` | Accent color stroke |
| `.drawing-path[data-highlighted="true"]` | Pin highlight glow |
| `.drawing-path[hidden]` | `display: none` (stays in DOM for pin anchors) |

## Host integration example (slides)

```js
// demo/slides.html — host wires drawing to its own state
import { createDrawingLayer } from '../src/ui/components/drawing/drawing.js';

const strokes = new Map(); // slideIndex → Stroke[]
let lastStrokeId = null;

const layer = createDrawingLayer(stage, {
    onStrokeCommit(stroke) {
        // Host persists stroke via its own service
        service.addStroke(stroke);
        lastStrokeId = stroke.id;
        // Host creates linked comment
        anchorableComments.add({
            type: 'annotation',
            anchor: { anchor_type: 'element', anchor: { id: stroke.id } },
            data: { strokeId: stroke.id },
            ...
        });
    },
    onStrokeSelect(strokeId) {
        // Host highlights + shows comment
        eventBus.publish('INTENT_COMMENTS_FOCUS', { id: findCommentByStroke(strokeId) });
    },
    onStrokeDelete(strokeId) {
        service.removeStrokeById(strokeId);
        eventBus.publish('INTENT_ANNOTATION_STROKE_DELETE', { strokeId });
    },
    getStrokes() {
        return service.getAnnotations(service.index);
    }
});
```

## What stays in slides

`SlideDeckService.undoStroke()` — undo/redo logic is host-specific.
`SlideDeckService.hideStroke()`/`showStroke()` — visibility via comments is host-specific.
`SlidesContracts` — event validation is host-specific.
Demo auto-logging handlers — comment integration is host-specific.

## Migration path

1. Create `src/ui/components/drawing/drawing.js` + `drawing.css`
2. Tests pass without slides dependency
3. Rewire `src/modules/slides/engine/annotator.js` to delegate to drawing component
4. Delete old `buildPath`, `renderAll`, pointer capture, selection from annotator.js
5. `annotator.js` becomes a thin host adapter (~30 lines) that wires drawing to SlideDeckService
6. MorphEditor can import `drawing.js` directly with its own host adapter
