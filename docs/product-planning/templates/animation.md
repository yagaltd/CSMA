# Animation: `<animation name>`

## Purpose

| Field | Decision |
|:--|:--|
| Scope | `<page/app shell/route/component/flow>` |
| Goal | `<orientation/feedback/hierarchy/reveal/continuity/delight>` |
| Owner | `<page/flow/app module/component>` |
| Motion level | `<micro/section/runtime sequence/scroll>` |

## Use Conditions

| Condition | Rule |
|:--|:--|
| Starts when | `<load/click/route change/state change/scroll>` |
| Ends when | `<final state or event>` |
| Interruptible | `<yes/no; how interruption resolves>` |
| Repeat behavior | `<once/per visit/per state change/manual>` |

## Elements

| Element | Selector / state hook | Role | Movement |
|:--|:--|:--|:--|
| `<element>` | `<class/data-* attribute>` | `<anchor/supporting/feedback>` | `<fade/translate/scale/clip/none>` |

## Timeline

| Step | Trigger / offset | Element | Action | Duration | Easing |
|:--|:--|:--|:--|:--|:--|
| 1 | `<trigger>` | `<element>` | `<state change>` | `<token>` | `<token>` |

## State Model

| State | Source | Implementation rule |
|:--|:--|:--|
| `<state>` | `<class/data-* / EventBus / Contract>` | `<how CSS or JS reads it>` |

## Token Use

| Token branch | Usage |
|:--|:--|
| `primitives.motion.duration` | `<which duration tokens drive the sequence>` |
| `primitives.motion.easing` | `<which easing tokens drive the sequence>` |
| `semantic.transition` | `<shared transition aliases if available>` |

## Reduced Motion

| Motion feature | Alternative |
|:--|:--|
| `<animated feature>` | `<disable/shorten/static equivalent/preserve essential transition>` |

## Implementation Bias

| Decision | Rule |
|:--|:--|
| Default | CSS transitions or keyframes using generated CSMA variables. |
| JavaScript | Use only for state changes, sequencing triggers, cleanup, or Type II behavior. |
| GSAP | Optional only for complex timelines, scroll control, SVG, or runtime control. |
| Authored styles | No inline styles; use classes, `data-*`, and CSS variables. |
| Performance | Animate transform and opacity before size, position, color, or layout properties. |

## Verification

| Check | Expected result |
|:--|:--|
| Static final state | Layout works before animation is enabled. |
| Desktop | `<viewport and expected behavior>` |
| Mobile | `<viewport and expected behavior>` |
| Reduced motion | `<expected fallback>` |
| State cleanup | `<timeline/classes/listeners do not persist incorrectly>` |
