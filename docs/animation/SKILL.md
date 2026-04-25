---
name: csma-animation
description: Implement runtime animation in CSMA. Use for splash screens, route transitions, app-shell transitions, section reveals, scroll motion, modal/drawer motion, and reusable animation sequences. CSS-first, GSAP-optional.
---

<!-- version: 1.0.0 | tags: animation, motion, transitions, css, gsap -->

# CSMA Animation Skill

## Purpose

Use this skill when implementing runtime motion in a CSMA website or app.

Planning decides what should move. This skill decides how to implement it while
preserving CSMA boundaries: tokens own visual timing, CSS owns authored styles,
and JavaScript owns state transitions only when needed.

## Required Reading

Read only what applies:

1. `DESIGN.md`.
2. `docs/design/SKILL.md` for token rules.
3. `docs/patterns/SKILL.md` for Type I/II and layout patterns.
4. `docs/architecture/SKILL.md` if animation follows shared app state.
5. `animations/<animation>.md` if product planning created one.
6. Page or flow specs that own the animated surface.

If no motion artifact exists and the animation is reusable, cross-page, or
sequence-based, create one from
`docs/product-planning/templates/animation.md` before implementation.

## Decision Matrix

| Need | Default implementation | Escalate when |
|:--|:--|:--|
| Hover, focus, pressed, disabled | CSS transitions using token variables. | Do not escalate. |
| Modal, drawer, popover, disclosure | CSS transition/keyframe plus class or `data-*` state. | Sequence has interruption, staging, or nested timing. |
| Toast or async feedback | CSS transition driven by Type II state. | Multiple timed exits or chained states need timeline control. |
| Splash screen or route transition | `animations/<animation>.md`, CSS keyframes, small JS trigger/cleanup. | Timeline must pause, reverse, interrupt, or coordinate many elements. |
| Section or hero reveal | CSS first, often with `IntersectionObserver`. | Many elements need choreography or scroll-linked control. |
| Scroll narrative or pinned panels | Avoid unless user goal requires it. | Use GSAP ScrollTrigger with reduced-motion fallback. |
| SVG, text, product, or path motion | CSS/SVG first if simple. | Use GSAP plugins for complex paths, split text, morphs, or sequencing. |

## CSS-First Rules

| Rule | Implementation check |
|:--|:--|
| Build static layout first. | Final state looks correct with animation disabled. |
| Use generated variables. | Durations/easing come from `--motion-*` or `--transition-*` tokens when available. |
| Keep authored styles in CSS. | No inline authored styles for normal UI state. |
| Keep state explicit. | Use classes, ARIA, and `data-*` attributes. |
| Prefer transform and opacity. | Avoid animating layout properties unless the user goal requires it. |
| Respect reduced motion. | Add `@media (prefers-reduced-motion: reduce)` for page-level and runtime sequences. |

## State Model

| Animation owner | Rule |
|:--|:--|
| Type I visual feedback | CSS state only: `:hover`, `:focus-visible`, classes, ARIA, `data-*`. |
| Type I disclosure | Prefer native HTML when possible; otherwise local JS may toggle attributes. |
| Type II app state | Publish intents, validate Contracts, then render animation from confirmed state. |
| Route/app-shell transition | Keep navigation state separate from animation timing. Animation may delay rendering only when explicitly planned. |
| User content | Render with `textContent`, never `innerHTML`. |

Animation is not the durable state model. It can communicate state, but app
truth still lives in CSMA events, Contracts, classes, and `data-*`.

## Token Use

| Token branch | Use for |
|:--|:--|
| `primitives.motion.duration` | Enter, exit, hover, route, splash, and reveal duration choices. |
| `primitives.motion.easing` | Standard, emphasized, entrance, and exit curves. |
| `semantic.transition` | Shared transition aliases for components and states. |

Patch `src/style/token-overrides.json` only when repeated animation work shows a
missing duration, easing, or semantic transition. Run `npm run tokens:patch`
afterward. Do not create one-off timing tokens for a single small hover effect.

## GSAP Escalation

GSAP is optional. Do not install it by default.

Use GSAP only when CSS is the wrong tool:

| GSAP use | Justification |
|:--|:--|
| Timeline sequencing | Many elements need precise staging, labels, reversal, or interruption. |
| ScrollTrigger | Pinned panels, scrubbed motion, or scroll narratives are required. |
| SVG/text/path plugins | Native CSS/SVG is too fragile or verbose. |
| Runtime control | Animation must pause, resume, reverse, seek, or coordinate with media. |

External reference: `https://github.com/greensock/gsap-skills`

Ask before adding GSAP as a dependency. If the user accepts it, keep GSAP inside
the app or module boundary that owns the motion. Register plugins once, scope
selectors, and kill/revert timelines on teardown.

GSAP may mutate inline styles at runtime. That is acceptable only as transient
animation output. Authored CSMA styles still live in CSS.

## GSAP Guardrails

Use GSAP as a motion renderer, not as the UI state model.

| Guardrail | Rule |
|:--|:--|
| State ownership | GSAP must not own durable app state such as open/closed, selected, loading, error, auth, or route state. Those remain in classes, `data-*`, ARIA, Contracts, and EventBus flows. |
| Trigger model | App logic changes state first. GSAP reacts to confirmed state, route changes, or explicit runtime triggers. |
| Property ownership | If GSAP controls `transform`, `opacity`, `clip-path`, or `filter` for an interaction path, CSS transitions/keyframes must not also control that same property on that same element. One property, one owner. |
| Layout safety | Prefer transform/opacity motion. Avoid animating `width`, `height`, `top`, `left`, or other layout-driving properties unless the motion requirement truly needs them. |
| Inline style exception | GSAP inline styles are allowed only as transient animation output. They are not the source of truth for component state or design tokens. |
| Cleanup | Kill or revert timelines, ScrollTriggers, observers, and listeners on teardown. Runtime motion must clean up like any other CSMA behavior. |
| Reduced motion | Explicitly short-circuit or simplify GSAP motion under `prefers-reduced-motion: reduce`. |
| Static validity | The final layout must work with animation disabled. GSAP can animate between states, but must not be required for the surface to render correctly. |

Practical rule:

- classes / `data-*` / ARIA / Contracts decide what state the UI is in
- CSS or GSAP decides how that state is visually expressed over time
- do not let GSAP toggle app-state classes as its primary control mechanism

## Reduced Motion

| Motion type | Required fallback |
|:--|:--|
| Micro feedback | Shorten or remove nonessential movement; preserve focus/active clarity. |
| Modal/drawer | Use instant state change or very short opacity transition. |
| Splash/route | Skip sequence and show final state immediately. |
| Section reveal | Render content visible without scroll-dependent timing. |
| Scroll narrative | Provide normal document flow with no pinned/scrubbed dependency. |

## Verification

Before finishing:

1. Confirm the static final state works with animation disabled.
2. Check desktop and mobile viewports.
3. Check light, dark, and contrast themes when theme tokens are involved.
4. Check `prefers-reduced-motion: reduce`.
5. Confirm listeners, timers, observers, classes, and GSAP timelines clean up.
6. Run relevant lint/build commands for the touched code.

## Guardrails

- Do not add animation just because the UI feels plain; first fix hierarchy,
  spacing, typography, and tokens.
- Do not use animation to hide slow loading or unclear state.
- Do not animate layout dimensions when transform/opacity can express the same
  idea.
- Do not create `animations/<animation>.md` for every hover or small reveal.
- Do not let GSAP or JS write the design system.
