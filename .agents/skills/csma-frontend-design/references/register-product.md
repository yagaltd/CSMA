# Product register

Design SERVES the product: app UIs, admin dashboards, settings panels, data
tables, tools, authenticated surfaces, anything where the user is in a task.

Loaded when `DESIGN.md` front matter has `register: product`.

---

## Stance

Product UI's failure mode is not flatness — it's strangeness without purpose:
over-decorated buttons, mismatched form controls, gratuitous motion, display
fonts where labels should be. The bar is earned familiarity. The tool should
disappear into the task.

## Typography

- **One family is often right.** Product UIs don't need display/body pairing.
  A well-tuned sans carries headings, buttons, labels, body, and data.
- **Fixed rem scale, not fluid.** `clamp()`-sized headings don't serve product
  UI. Users view at consistent DPI.
- **Tighter scale ratio.** 1.125-1.2 between steps is typical. Exaggerated
  contrast creates noise in product UI.
- **Line length still applies for prose** (65-75ch). Tables and compact data
  can run denser.

## Color

Product defaults to **Restrained**. A single surface can earn Committed
(a dashboard where one category color carries a report, an onboarding flow
with a drenched welcome screen), but Restrained is the floor.

- State-rich semantic vocabulary: hover, focus, active, disabled, selected,
  loading, error, warning, success, info. Standardize these.
- Accent color used for primary actions, current selection, and state
  indicators only — not decoration.
- A second neutral layer for sidebars, toolbars, and panels (slightly cooler
  or warmer than the content surface).

## Layout

- Responsive behavior is structural (collapse sidebar, responsive table,
  breakpoint-driven columns), not fluid typography.
- Standard navigation patterns are fine: top bar + side nav, breadcrumbs,
  tabs, command palettes.
- Density is acceptable. Tables with many rows, panels with many labels,
  dense information when users need it.

## Components

Every interactive component must have all 8 states. Don't ship with half:
default · hover · focus · active · disabled · loading · error · success.

- Skeleton states for loading, not spinners in the middle of content.
- Empty states that teach the interface, not "nothing here."
- Consistent affordances across the surface. Same button shape, same
  form-control vocabulary, same icon style.

## Motion

- 150-250ms on most transitions. Users are in flow; don't make them wait.
- Motion conveys state, not decoration. State change, feedback, loading,
  reveal — nothing else.
- No orchestrated page-load sequences. Product loads into a task; users
  don't want to watch it load.

## Product-specific bans

| Anti-pattern | Why |
|-------------|-----|
| Decorative motion that doesn't convey state | Product motion is feedback, not decoration |
| Inconsistent component vocabulary across screens | If "save" looks different in two places, one is wrong |
| Display fonts in UI labels, buttons, data | Labels should be legible, not expressive |
| Reinventing standard affordances | Custom scrollbars, weird form controls, non-standard modals = broken UX |
| Heavy color or full-saturation accents on inactive states | Muted = inactive is a universal convention |
| Modal as first thought | Exhaust inline / progressive alternatives first |
