---
name: csma-css
description: Modern CSS best practices, browser compatibility, and fallback strategies for CSMA. Guides agents to replace JS-driven patterns with pure CSS where baseline support allows, with progressive enhancement fallbacks.
---

<!-- version: 1.0.0 | tags: css, browser-compat, progressive-enhancement, modern-css, fallback -->

# CSMA Modern CSS Skill

## Purpose

CSMA's architecture is "CSS handles rendering, JS manages state via events."
Modern CSS absorbs more state and interactivity that previously required
JavaScript. This skill guides agents to:

1. Identify JS patterns replaceable with pure CSS
2. Check browser baseline status via MDN Baseline
3. Draft fallback strategies using `@supports` and progressive enhancement
4. Apply the right modern CSS feature for each use case

**When to use this skill:** When building new components, auditing existing JS
for CSS migration opportunities, or deciding browser support boundaries.

## CSMA CSS Philosophy

- **Pure CSS first.** If a browser-native CSS feature handles it at baseline,
  prefer CSS over JS. No virtual DOM, no shadow DOM, no component state logic.
- **`data-*` attributes as state drivers.** CSS selectors on `[data-state]`,
  `[data-loading]`, `[aria-expanded]` etc. are the reactivity model.
- **Progressive enhancement, not polyfills.** Use `@supports` to layer modern
  CSS on top of working JS, not the reverse.
- **No inline styles for durable state.** State changes via attribute/class
  toggles; CSS handles the visual response.

## Scope Boundary

This skill is for reducing JS used for visual expression, not for replacing
CSMA's state model.

- Do not move persisted user preferences, contracts, routing, or business logic
  into CSS.
- Do not treat modern CSS as a replacement for EventBus, Contracts, or durable
  `data-*` state.
- Use modern CSS to reduce styling JS, overlay plumbing, breakpoint branching,
  and visual-only validation hints when the semantics still hold.

## MDN Baseline Quick Reference

MDN Baseline classifies features by browser support:

| Status | Meaning | CSMA policy |
|:-------|:--------|:------------|
| **Widely available** | All major browsers ≥30 months | Use freely, no fallback |
| **Newly available** | All major browsers shipped, <30 months | Use with `@supports` fallback |
| **Limited availability** | 1–2 major browsers only | Use only with `@supports` + JS fallback |

Check current status: https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility

## Stable Defaults vs Verify-First Features

Use the repo skill as the primary source for stable CSS defaults. Do not fetch
MDN for every ordinary CSS decision.

### Stable defaults to use directly

These are stable enough to encode as CSMA guidance:

- `clamp()` for fluid typography and bounded responsive sizing
- `gap` for flex and grid spacing
- logical properties by default: `margin-inline`, `padding-inline`,
  `inset-inline`, `border-inline`, `inline-size`, `block-size`
- `@media` for page and shell breakpoints
- `@container` for reusable component-local adaptation
- `:focus-visible`, `:is()`, `:where()`, `:not()` and `:has()` where the
  selector meaning is clear
- native HTML/CSS primitives such as `<details>` and `<dialog>` when they fit

### Verify against MDN before relying on them

These features are still time-sensitive enough that the agent should re-check
current MDN Baseline/compatibility before using them as a primary path:

- `light-dark()`
- `@starting-style`
- `transition-behavior: allow-discrete`
- `popover`
- `@property`
- `:user-valid` / `:user-invalid`
- scroll-driven animations (`animation-timeline`, `view()`, `scroll()`)
- limited features such as `calc-size()`

Rule:

- stable defaults belong in this skill
- newly available or limited features should be verified against MDN when used
- if compatibility is uncertain, prefer progressive enhancement over rewrite

## Feature Map: JS Pattern → Modern CSS

### 1. Theme Switching (Light ↔ Dark)

**Current JS approach:** `document.documentElement.dataset.theme = theme`
with `[data-theme="dark"]` selectors.

**Modern CSS:** `light-dark()` + `color-scheme`

```css
:root {
  color-scheme: light dark;
}

.card {
  background: light-dark(var(--surface), var(--surface-dark));
  color: light-dark(var(--foreground), var(--foreground-dark));
}
```

```html
<meta name="color-scheme" content="light dark">
```

| Aspect | Detail |
|:-------|:-------|
| Baseline | Newly available / Baseline 2024 |
| Falls back to | `[data-theme]` selectors (current approach) |
| Limitation | Only handles light/dark binary. It does not replace persisted user choice, explicit theme cycling, or CSMA's `contrast` theme. |
| Migration path | Use `light-dark()` selectively inside tokens or component styles where it simplifies light/dark pairs; keep `data-theme` for persistence, contrast, and explicit overrides. |

**Fallback pattern:**
```css
/* Modern: no attribute needed for light/dark */
.card {
  background: light-dark(#fff, #1a1a1a);
}

/* Legacy: attribute-based */
@supports not (color: light-dark(red, blue)) {
  [data-theme="dark"] .card {
    background: #1a1a1a;
  }
}
```

### 2. Enter/Exit Animations (Display Transitions)

**Current JS approach:** Add `data-state="closed"` → keyframe animation →
`setTimeout(() => el.remove(), 300)`.

**Modern CSS:** `@starting-style` + `transition-behavior: allow-discrete`

```css
/* Enter: element appears with transition from starting-style */
.toast[data-state="open"] {
  display: block;
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity 0.3s ease-out,
    transform 0.3s ease-out,
    display 0.3s ease-out allow-discrete;
}

@starting-style {
  .toast[data-state="open"] {
    opacity: 0;
    transform: translateX(100%);
  }
}

/* Exit: transition to closed state */
.toast[data-state="closed"] {
  display: none;
  opacity: 0;
  transform: translateX(100%);
  transition:
    opacity 0.3s ease-in,
    transform 0.3s ease-in,
    display 0.3s ease-in allow-discrete;
}
```

| Aspect | Detail |
|:-------|:-------|
| Baseline | Newly available (Chrome 120+, Firefox 129+) |
| Falls back to | Keyframe animations + JS timer (current approach) |
| Benefit | Eliminates `setTimeout` for animation timing. DOM removal still requires JS. |
| Combined with `popover` | Full overlay lifecycle without JS |

**Fallback pattern:**
```css
/* Modern: starting-style driven */
@supports (transition-behavior: allow-discrete) {
  .toast[data-state="closed"] {
    display: none;
    transition: opacity 0.3s, display 0.3s allow-discrete;
  }
}

/* Legacy: keyframe animation */
@supports not (transition-behavior: allow-discrete) {
  .toast[data-state="closed"] {
    animation: toast-slide-out 0.3s ease-in forwards;
  }
}
```

### 3. Popover / Top-Layer Overlays

**Current JS approach:** Custom open/close logic, manual overlay management,
z-index stacking, focus trap, click-outside detection.

**Modern CSS:** `popover` attribute (HTML attribute, not just CSS)

```html
<button popovertarget="menu">Open Menu</button>
<div id="menu" popover="auto">
  <!-- Content auto-dismisses on outside click -->
</div>
```

```css
[popover] {
  /* Styling the top-layer element */
  margin: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-xl);
}

/* Animated popover entry */
[popover]:popover-open {
  opacity: 1;
  transform: scaleY(1);
  transition:
    opacity 0.2s,
    transform 0.2s,
    display 0.2s allow-discrete,
    overlay 0.2s allow-discrete;
}

@starting-style {
  [popover]:popover-open {
    opacity: 0;
    transform: scaleY(0.8);
  }
}
```

| Aspect | Detail |
|:-------|:-------|
| Baseline | Widely available (2024) |
| Provides | Top-layer rendering, light dismiss, and good behavior for many non-modal overlays |
| JS needed | None for basic open/close. `popovertarget` is pure HTML. |
| Use for | Dropdowns, menus, tooltips, notification panels, action sheets |
| Do not default to | Modal workflows, consent/auth flows, or anything better served by native `<dialog>` or explicit app-state control |

**Fallback pattern:** Use `@supports` check for `selector(:popover-open)` or
feature-detect in JS. Prefer `<dialog>` for true modal flows; do not force
`popover` into every overlay pattern.
```js
const supportsPopover = HTMLElement.prototype.hasOwnProperty('popover');
```

### 4. Container Queries (Component-Level Responsiveness)

**Current approach:** `@media (min-width: var(--breakpoint-md))` — viewport-based.

**Modern CSS:** `@container` queries — parent-width-based.

CSMA already defines container contexts in `states.css`:
```css
.container-card { container-type: inline-size; container-name: card; }
```

**Add container query rules:**
```css
@container card (min-width: 400px) {
  .card { grid-template-columns: 1fr 2fr; }
}

@container card (max-width: 399px) {
  .card { grid-template-columns: 1fr; }
}
```

| Aspect | Detail |
|:-------|:-------|
| Baseline | Widely available (2023) |
| Falls back to | `@media` breakpoints (current approach) |
| Benefit | Component responds to its container width, not viewport. Works in sidebars, modals, nested layouts. |
| Migration path | Keep `@media` for page-level layout and shell breakpoints. Use `@container` for component-level adaptations where the component can appear in multiple parent widths. |

**CSMA rule:** Prefer `@container` for component-local adaptation and `@media`
for page/shell breakpoints. Do not rewrite page layout CSS into container
queries just because the feature exists.

### 5. Form Validation Styling

**Current JS approach:** Toggle `[aria-invalid="true"]` via JS after validation.

**Modern CSS:** `:user-valid` / `:user-invalid` pseudo-classes

```css
/* Only style after user interaction (not on pristine load) */
.input:user-invalid {
  border-color: var(--destructive);
  box-shadow: 0 0 0 1px var(--destructive);
}

.input:user-valid {
  border-color: var(--success);
}

/* Combine with error message visibility */
.input:user-invalid ~ .field-error {
  display: block;
}
```

| Aspect | Detail |
|:-------|:-------|
| Baseline | Newly available (2024) |
| Falls back to | JS-driven `[aria-invalid]` toggle |
| Benefit | No JS needed for visual validation feedback on simple native field states. Browser tracks interaction state. |
| Limitation | Complex, async, cross-field, or server-backed validation still needs JS and semantic error state. Use for single-field styling hints only. |

**Fallback pattern:**
```css
/* Modern */
@supports selector(:user-invalid) {
  .input:user-invalid { border-color: var(--destructive); }
}

/* Legacy */
@supports not selector(:user-invalid) {
  .input[aria-invalid="true"] { border-color: var(--destructive); }
}
```

### 6. Custom Property Transitions

**Current JS approach:** Theme switch is instant — no smooth color transition
because CSS custom properties can't be transitioned by default.

**Modern CSS:** `@property` registration enables interpolation

```css
@property --primary {
  syntax: '<color>';
  inherits: true;
  initial-value: #3b82f6;
}

:root {
  --primary: #3b82f6;
  transition: --primary 0.3s ease;
}

[data-theme="dark"] {
  --primary: #60a5fa;
}
```

| Aspect | Detail |
|:-------|:-------|
| Baseline | Newly available / Baseline 2024 |
| Falls back to | Instant theme switch (no transition) — acceptable degradation |
| Benefit | Smooth theme transitions without JS animation |
| Limitation | Must register each property with `@property`. Only works with typed values (`<color>`, `<length>`, `<number>`). In CSMA this is a token-pipeline concern, not just a local CSS choice. |

### 7. Scroll-Driven Animations

**Current JS approach:** `IntersectionObserver` or scroll event listeners.

**Modern CSS:** `animation-timeline: scroll()` / `animation-timeline: view()`

```css
/* Parallax */
.hero-bg {
  animation: parallax linear;
  animation-timeline: scroll();
}

@keyframes parallax {
  from { transform: translateY(0); }
  to { transform: translateY(-20%); }
}

/* Reveal on scroll */
.reveal-section {
  animation: fade-in linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}
```

| Aspect | Detail |
|:-------|:-------|
| Baseline | Limited availability (Chrome 115+, no Firefox/Safari yet) |
| Falls back to | `IntersectionObserver` JS |
| Use when | Progressive enhancement only. Not for critical UI and not as the default CSMA scroll pattern. |

### 8. Advanced Selectors Reducing JS State

| Selector | Baseline | Replaces |
|:---------|:---------|:---------|
| `:has(.selected)` | Widely available | JS parent-state tracking |
| `:is()`, `:where()` | Widely available | Verbose selector lists, specificity management |
| `:not(.a, .b)` | Widely available | Multiple exclusion rules |
| `:focus-visible` | Widely available | JS focus-ring management |
| `:has(> img)` | Widely available | Conditional card layout based on child content |
| `:empty` | Widely available | Hide empty containers, show placeholders |
| `:checked ~ label` | Widely available | Pure CSS toggle/accordion using hidden checkbox |

**CSMA pattern — conditional layout with `:has()`:**
```css
/* Card adapts layout when it contains an image */
.card:has(> img) {
  grid-template-columns: 1fr 2fr;
}

/* Card without image stays single column */
.card:not(:has(> img)) {
  grid-template-columns: 1fr;
}
```

### 9. Sizing Utilities

| Feature | Baseline | Use |
|:--------|:---------|:----|
| `clamp()` | Widely available | Fluid typography, sizing with min/max bounds |
| `min()` / `max()` | Widely available | Constrain dimensions without media queries |
| `calc-size()` | Limited | Animate `auto` height (`height: 0` → `height: auto`) |

**`calc-size()` for auto-height animation (limited, progressive only):**
```css
@supports (height: calc-size(auto)) {
  .accordion-content[aria-hidden="false"] {
    height: calc-size(auto);
    transition: height 0.3s ease;
  }
}
```

## Fallback Strategy Patterns

### Pattern 1: `@supports` Feature Detection (CSS-only)

Use when the CSS feature itself can be detected.

```css
/* Modern browsers */
@supports (animation-timeline: scroll()) {
  .hero-bg { animation-timeline: scroll(); }
}

/* Fallback: no parallax */
@supports not (animation-timeline: scroll()) {
  .hero-bg { transform: none; }
}
```

### Pattern 2: `@supports selector()` (CSS-only)

Use for new pseudo-classes or selectors.

```css
@supports selector(:user-invalid) {
  .input:user-invalid { border-color: var(--destructive); }
}
```

### Pattern 3: JS Feature Detect → Set Attribute

Use when CSS `@supports` can't detect the feature.

```js
// Detect popover support
if (HTMLElement.prototype.hasOwnProperty('popover')) {
  document.documentElement.dataset.popover = 'native';
}
```

```css
[data-popover="native"] [popover] {
  /* Native popover styles */
}
```

### Pattern 4: Progressive Layer (Both Coexist)

Use when the modern CSS is additive and the fallback is acceptable.

```css
/* Base: works everywhere */
.card { border: 1px solid var(--border); }

/* Enhancement: smooth theme transition */
@supports (transition: --primary 0.3s) or (transition: all 0.3s) {
  @property --primary { syntax: '<color>'; inherits: true; }
  :root { transition: --primary 0.3s ease; }
}
```

### Pattern 5: Cut-the-Mustard (JS Gate)

Use for features that fundamentally change component behavior.

```js
const modernCSS = CSS.supports('selector(:popover-open)')
  && CSS.supports('transition-behavior', 'allow-discrete');

if (modernCSS) {
  // Load minimal JS — no popover/animation logic needed
} else {
  // Load legacy JS with animation timers and manual overlay management
}
```

## Browser Compatibility Decision Matrix

When building a new component or migrating existing JS to CSS, follow this
decision tree:

```
1. Check MDN Baseline status
   ├─ Widely available → Use directly, no fallback
   ├─ Newly available → Use with @supports fallback to current approach
   └─ Limited availability → Use only if enhancement, keep JS as primary

2. Assess impact of failure
   ├─ Visual-only (animation, transition) → Acceptable to degrade silently
   ├─ Layout shift (container query) → Must have @media fallback
   └─ Behavioral (popover, dialog) → Must have JS fallback for full function

3. Write CSS with progressive layers
   ├─ Base layer: works in all target browsers
   ├─ Enhancement layer: wrapped in @supports
   └─ JS layer: only for features not achievable in CSS
```

## CSMA Migration Priorities

Based on the current codebase, ranked by impact and readiness:

| Priority | Pattern | Feature | Baseline | Effort |
|:---------|:--------|:--------|:---------|:-------|
| **P0** | Container queries for reusable components | `@container` | Widely available | Low — contexts already defined |
| **P1** | `@starting-style` for enter/exit | `@starting-style` | Newly available | Medium — toast, modal, panels |
| **P1** | `:user-valid` / `:user-invalid` layering | Pseudo-classes | Newly available | Low — form component enhancement |
| **P2** | Selective `light-dark()` use inside light/dark pairs | `light-dark()` | Newly available | Medium — token and theme coordination |
| **P2** | Popover for non-modal overlays | `popover` | Widely available | Medium — restructure specific overlay components |
| **P2** | `@property` for selected token transitions | `@property` | Newly available | Medium — token pipeline work |
| **P2** | `:has()` for conditional layouts | `:has()` | Widely available | Low — card, list component updates |
| **P3** | Scroll-driven animations | `animation-timeline` | Limited | High — progressive only |
| **P3** | `calc-size()` for auto-height | `calc-size()` | Limited | Low — accordion patterns |

## Craft Rules

1. **Never break the `data-*` state model.** Modern CSS features complement
   attribute-driven styling, they don't replace it. `[data-state="open"]` is
   still the CSMA way to signal state.

2. **Test fallbacks, not just enhancements.** Verify the `@supports not`
   branch renders correctly and functions.

3. **Keep JS for logic, not for styling.** If CSS can handle the visual
   response (animation, visibility, layout), move it to CSS. JS toggles the
   attribute; CSS interprets it. Do not remove JS that owns persistence,
   contracts, or semantic app state unless the behavior is truly visual-only.

4. **No polyfills.** Use progressive enhancement. Polyfills add weight and
   break the "CSS handles rendering" contract.

5. **Check Baseline before using.** Feature support changes quarterly.
   Re-verify before migrating a pattern.

6. **Prefer `@supports` over user-agent sniffing.** Feature detection is
   future-proof; UA strings are not.

7. **Animate only `transform` and `opacity`** for 60fps. Modern CSS makes it
   easier to animate other properties, but compositing still prefers these two.
   Use `will-change` sparingly and remove after animation (CSMA's
   `.animate-once` pattern).

8. **Container queries for components, media queries for pages.** Never use
   `@container` for page-level breakpoints or `@media` for component-level
   adaptations by default. Choose based on the ownership of the responsive rule.

9. **Prefer native HTML primitives before custom JS overlays.** For modal
   workflows, prefer `<dialog>` when it fits. For non-modal top-layer surfaces,
   consider `popover`. Do not force one primitive onto every disclosure case.

10. **Use logical properties by default.** Prefer direction-aware CSS over
    physical left/right properties unless the surface is intentionally
    directional.

11. **Treat `@layer` as a repo-level architecture choice.** Do not introduce
    ad hoc cascade layers in one feature. Adopt `@layer` only when the CSS
    pipeline and ordering contract are updated intentionally across the repo.

## Anti-Patterns

| Anti-pattern | Why | Instead |
|:-------------|:----|:--------|
| `@supports` wrapping 90% of stylesheet | Creates maintenance burden, bifurcated codebase | Use for targeted features only |
| Replacing all JS animations with CSS | Some complex sequences need JS orchestration | Use CSS for individual element transitions, JS for coordination |
| Using limited-baseline features without fallback | Breaks for real users | Always wrap limited features in `@supports` |
| Animating `height: auto` without `calc-size()` | Won't work in most browsers | Use `max-height` hack or `calc-size()` with `@supports` |
| Nesting `@supports` deeply | Unreadable, hard to debug | One level of feature detection max |

## Skill Activation Triggers

Use this skill when:

- Building a new component with overlays, transitions, or responsive behavior
- Auditing existing JS for CSS migration opportunities
- Reviewing a PR that adds JS for visual behavior
- Setting browser support targets for a project
- Evaluating whether a CSS feature is safe to use
- Writing `@supports` blocks for progressive enhancement

## Related Skills

| Skill | When to use instead |
|:------|:--------------------|
| `docs/design/SKILL.md` | Defining visual direction, token values, brand palette |
| `docs/patterns/SKILL.md` | Composing layouts from primitives and tokens |
| `docs/animation/SKILL.md` | Runtime animation implementation with timing curves |
| `docs/rigor/SKILL.md` | Deciding test coverage and transition rigor level |

## Modern Web Guidance Integration

CSMA components should leverage modern CSS capabilities before reaching
for JavaScript. Use the `modern-web-guidance` skill for real-time MDN
compatibility checks and best-practice patterns when:

- Building layouts with `grid`, `flex`, or `@container`
- Implementing modals, dialogs, popovers, or disclosure patterns
- Adding scroll-based reveals or parallax
- Optimizing Core Web Vitals (LCP, INP, CLS)
- Using `:has()`, `:is()`, `:where()`, `:user-valid`, `anchor()` positioning
- Deciding between CSS-native and JS-driven visual behavior
- Working with `backdrop-filter`, glassmorphism, or `@starting-style`
- Handling form autofill, custom scrollbars, or advanced input states

### Decision flow

```
Need visual behavior?
  ├─ Check docs/css/SKILL.md feature map first
  │   └─ Has a CSS-native pattern? → Use it with @supports fallback
  ├─ Not listed here or Baseline unclear?
  │   └─ Trigger modern-web-guidance skill → verify MDN Baseline
  └─ CSS can't handle it (state coordination, async, persistence)?
      └─ Use JS for logic, CSS for visual response
```

### When NOT to trigger modern-web-guidance

- Backend work (databases, ORMs, API routes)
- CI/CD pipelines, Docker, GitHub Actions
- Local scripts (Python/Go tools), ESLint, Git
- Decisions already covered by the feature map in this skill

### Relationship to this skill

`modern-web-guidance` is a **lookup tool** — it fetches current MDN
compatibility data and modern API patterns. This skill (`docs/css/SKILL.md`)
is the **policy layer** — it defines CSMA's CSS philosophy, migration
priorities, and fallback strategies. Always check this skill's feature map
first; escalate to modern-web-guidance when the map doesn't cover the
feature or Baseline status needs verification.

## External References

- MDN Baseline: https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility
- CSS `@starting-style`: https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
- Popover API: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API
- Container Queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries
- `light-dark()`: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark
- `@property`: https://developer.mozilla.org/en-US/docs/Web/CSS/@property
- Scroll-driven Animations: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations
- `:user-valid` / `:user-invalid`: https://developer.mozilla.org/en-US/docs/Web/CSS/:user-valid
- `calc-size()`: https://developer.mozilla.org/en-US/docs/Web/CSS/calc-size
