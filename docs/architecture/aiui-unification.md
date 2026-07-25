# aiui Unification — Layered Rendering Architecture

> Status: **Phase 1 complete** (module surfaces joined the catalog).
> Phases 2 and 3 planned as subsequent modular waves.
> Companion to `AGENTS.md` and `docs/architecture/SKILL.md`.

## Why this doc exists

CSMA accumulated **two parallel rendering systems**:

- **aiui** (`src/modules/ai-ui/`) — secure component composer
  (`mount` / `unmount` / `setState` ops over a generated catalog).
  Used only by `mindmap`.
- **slides layouts + archetypes** — bypass aiui and build DOM directly
  via an `el()` helper or per-module `create*` factories.

Verified fragmentation (grep, pre-Phase-1):

| System | Uses aiui? | DOM factory |
|--------|-----------|-------------|
| mindmap | ✅ yes (via catalog components) | aiui composer |
| slides | ❌ no | own `el()` |
| archetypes (data-grid, stats-dashboard, …) | ❌ no | own `create*` factories |
| comments, video, charts | ❌ no | own DOM |

This document defines the **target layered architecture** and the
**migration phases** that consolidate CSMA on a single rendering pipeline
without throwing away module-specific semantics.

## The layered model

```
LAYER 4  ─ APPLICATIONS         slide-deck app · mindmap app · dashboard app
LAYER 3  ─ NARRATIVE MACHINES   SlideDeckService (next / prev / build / presenter)
LAYER 2  ─ PRECOMPOSED LAYOUTS  archetypes (data-grid, stats-dashboard, …) +
                                slide layouts (cover, bento, stat-grid, …)
LAYER 1  ─ SECURE COMPOSITION   aiui (mount / unmount / setState on catalog)
LAYER 0  ─ PRIMITIVES           CSMA components (button, card, badge, field, …)
```

Each layer composes the layer immediately below. **No layer skips** —
applications compose narrative machines or precomposed layouts; layouts
compose via aiui; aiui mounts primitives or module surfaces.

## What belongs where

| Concern | Layer | Owner |
|---------|-------|-------|
| Button, card, badge, input rendering | 0 | `src/ui/components/` |
| `mount` / `unmount` / `setState` ops, SAFE_TAGS, catalog | 1 | `src/modules/ai-ui/` |
| A precomposed grid of stat cards | 2 | archetypes → after Phase 3, expressed as aiui compositions |
| A slide layout (`cover`, `bento`, `split`) | 2 | slide layouts → after Phase 2, expressed as aiui compositions |
| `next()` / `prev()` / build steps / cross-tab sync | 3 | `SlideDeckService` (slides module) — **stays** |
| A whole deck with dock + rail + grid | 4 | the slides app composition |

The layer-3 state machine (advance, build, presenter mode) is **not** a
composition problem. aiui has no concept of "advance to next". Keeping
`SlideDeckService` is correct; what changes is that **its layouts become
aiui compositions** rather than bespoke DOM trees.

## The `mountSurface` contract (Layer 1 ↔ module services)

Any module that wants to be embeddable via aiui (so it can appear inside
a slide, a dashboard tile, a mindmap sidebar, anywhere) MUST expose:

```js
class SomeService {
  /**
   * Mount one of this module's aiui surfaces into a container.
   *
   * @param {string} surfaceId  — matches a manifest in src/modules/<module>/aiui/
   * @param {HTMLElement} container
   * @param {object} props      — declared in the surface manifest's aiUi.props
   * @returns {() => void} cleanupFn — called when aiui unmounts the surface
   */
  mountSurface(surfaceId, container, props) { /* … */ }
}
```

The composer resolves a `spec: { component: '<surfaceId>' }` op by:

1. Looking up the surface in the generated catalog.
2. Reading `component.moduleId` from its manifest.
3. `serviceManager.get(moduleId)` → call `mountSurface(surfaceId, container, props)`.
4. Stashing the returned cleanup fn for later unmount.

If the module isn't loaded, the composer throws a clear error the agent
can handle (`[AIUI] module "video" not loaded; cannot mount surface`).

## Phase status

### ✅ Phase 1 — Module surfaces join the catalog (DONE, commit `cd43883`)

- Catalog generator (`tooling/scripts/generate-ai-ui-catalog.js`) now scans
  **two roots**: `src/ui/components/*/manifest.json` (primitives) AND
  `src/modules/*/aiui/*.json` (module surfaces). Output is one merged catalog.
- `AIUIComposerService` gained `canvas`, `svg`, `path`, `g`, `line`,
  `circle`, `rect`, `polyline`, `polygon` in `SAFE_TAGS`. `script`,
  `iframe`, `object`, `embed` are still rejected.
- New render path: `render.kind === 'module'` → `mountModuleSurface` →
  resolves via `serviceManager` and `mountSurface`.
- Four surfaces registered:
  - `comments-thread` → `CommentsService.mountSurface`
  - `chart-display`   → `ChartsService.mountSurface`
  - `mindmap-canvas`  → `MindmapService.mountSurface`
  - `video-player`    → forward-declared manifest; `VideoCompositionService`
    stub returns no-op cleanup with a TODO (module body pending)
- `ServiceManager.register` injects itself into services that expose
  `setServiceManager` (mirrors the existing `setEventBus` precedent) so
  the composer can resolve module surfaces in real apps.
- 12 new tests in `tests/ai-ui/module-surfaces.test.js`.

**Tests:** 1188/1188 (was 1176 + 12 new). No regressions.

After Phase 1, an aiui composition can already mount any of these
surfaces:

```js
composer.applyOp({
  spec: {
    component: 'comments-thread',
    props: { threadId: 'slide-3-q-and-a' }
  }
});
```

What's still missing: the slides layouts themselves still use `el()`.
So you can embed comments inside a *custom* aiui composition, but you
cannot yet embed comments inside a *slide layout* like `cover` or
`bento`. Phase 2 closes that gap.

### 🔜 Phase 2 — Slides layouts become aiui compositions

Each of the 24 slide layout factories (`src/modules/slides/layouts/*.js`)
gets re-expressed as an aiui composition spec — a JSON of mount ops the
composer can render. The `el()` helper is deprecated for new layouts.

- `SlideDeckService` is **unchanged** — still owns `next` / `prev` /
  `build` / cross-tab sync / presenter mode.
- The public `deck.json` schema (the JSON agents author) is **unchanged** —
  the migration is purely internal (layout → composer ops).
- Result: any aiui surface (comments, video, charts, mindmap, future
  modules) can be embedded in any slide:

  ```json
  {
    "type": "split",
    "left":  { "component": "video-player", "props": { "src": "..." } },
    "right": { "component": "comments-thread", "props": { "threadId": "..." } }
  }
  ```

- GSAP escalation, transitions, reduced-motion — all work uniformly
  because they ride the aiui lifecycle, not slide-specific code.

Scope estimate: ~3–5 days. Run as a modular wave (subagents in
worktrees, like Wave 1/2 of the modular build).

### 🔜 Phase 3 — Archetypes migrate, `el()` deprecated

- `src/modules/archetypes/*` (data-grid, stats-dashboard, config-panel,
  editor-builder, media-browser, nav-tabs, overlay-manager, viewer)
  re-expressed as aiui compositions.
- Slides chrome (dock, rail, grid, presenter) becomes aiui components.
- The `el()` helper in `src/modules/slides/layouts/_shared.js` is
  removed. By this point every layout renders through aiui.
- A new convention is documented: **all Layer-2 patterns compose via
  aiui**; raw DOM factories are forbidden in `src/modules/*/layouts/`
  and `src/modules/archetypes/`.

Scope estimate: ~1 week. Long-tail; can be sequenced across multiple
modular waves.

## Why unify (and why NOT to big-bang)

**Why unify:**

1. **Single mental model.** Agents learn aiui once; can compose anything.
2. **Mix-and-match content.** A slide embeds comments, charts, mindmap,
   video — all catalog surfaces.
3. **Streaming-ready.** aiui already handles progressive mount/unmount;
   ideal for live-built slides and LLM streaming UI.
4. **Consistent security boundary.** Every composition passes through
   the same `SAFE_TAGS` / `SAFE_ATTRIBUTES` filter.
5. **One extension point.** A new module that wants to be embeddable
   registers a manifest + `mountSurface` — done.

**Why NOT to big-bang:**

- Slides were just built (24 layouts, ~2500 LOC). A forced rewrite risks
  regressions.
- `SlideDeckService` is genuinely layer-3 logic (sequential narrative,
  cross-tab sync) — replacing it would force aiui to grow temporal
  semantics, the wrong direction.
- Incremental migration lets each wave ship value and stay green.

## Decisions locked

| Decision | Rationale |
|----------|-----------|
| Keep `SlideDeckService` | Layer-3 state machine; not a composition concern |
| Unify Layer 1 on aiui | Single rendering pipeline, single security boundary |
| Phased migration, not big-bang | Preserve working code, ship value incrementally |
| `mountSurface` contract | Module-side hook the composer calls; symmetric with `setEventBus` / `setServiceManager` injection |
| Module manifests at `src/modules/<mod>/aiui/` | Co-located with module, discovered by the catalog generator |
| `iframe`, `script`, `object`, `embed` stay banned | Security; module surfaces provide controlled alternatives |

## Open questions (resolve in Phase 2)

1. **Layout composition DSL.** Phase 2 layouts become aiui ops, but do
   agents author them as raw op arrays, or do we add a higher-level
   "layout composition" sugar on top (e.g., a `compose()` helper)?
   Lean: sugar — keeps agent-authored JSON clean.
2. **Streaming partial slides.** Should a single slide stream its build
   steps via aiui as the user clicks, or pre-render all build states?
   Current slides pre-render; aiui can do either. Lean: pre-render for
   v1 of Phase 2, revisit.
3. **Slide-embedded charts.** The `chart-display` surface needs a
   chart adapter registered (e.g., chart.js). Do we ship a default
   adapter in `src/modules/charts/adapters/`, or leave adapter
   registration entirely to the app? Lean: leave to app, document the
   pattern in `docs/charts/SKILL.md` (which does not exist yet — add it
   in Phase 2).

## References

- `src/modules/ai-ui/services/AIUIComposerService.js` — composer + `mountSurface` resolver
- `src/modules/ai-ui/catalog/componentCatalog.js` — generated catalog (primitives + module surfaces)
- `tooling/scripts/generate-ai-ui-catalog.js` — generator (two scan roots)
- `tests/ai-ui/module-surfaces.test.js` — Phase 1 contract tests
- `docs/slides/SKILL.md` — slide authoring skill (mentions this doc)
- `docs/architecture/SKILL.md` — CSMA architecture rules
- `docs/animation/SKILL.md` — CSS-first motion, GSAP escalation
