# CSMA Design Contract

Visual contract for AI agents building or extending CSMA UI.

This file defines how CSMA UI should feel visually.
It is not the full design system and does not own primitive, archetype, or sitemap decisions.

## Purpose

CSMA must remain safe for AI-driven UI work while still allowing strong visual output.

This document answers:

- what visual atmosphere to create
- how hierarchy should feel
- how color, typography, spacing, and motion should behave
- what visual anti-patterns to avoid

It does not answer:

- which primitive component to use
- which archetype to select
- which sitemap or user flow to build
- runtime or compiler wiring

## Core Visual Principles

1. Tokens first. Every visual value comes from `design-tokens.json` via `var(--token)`.
2. Simplicity wins. Prefer layout, spacing, and typography over ornamental styling.
3. Hierarchy before decoration. Use size, weight, density, and spacing before color accents.
4. Accessibility is default. Focus, disabled, reduced-motion, contrast, and semantics are required, not polish.
5. New work should look intentional, but still read like CSMA, not a one-off microsite.

## Visual Rules

### Hierarchy

- Use no more than 3 active hierarchy levels per screen.
- Create hierarchy with spacing, size, weight, and density before using color.
- Keep metadata visually quiet. Labels should not compete with values.
- Prefer one dominant action or focal point per major section.

### Color

- Use semantic tokens only: `--background`, `--foreground`, `--primary`, `--border`, `--ring`, and related semantic/status tokens.
- Use status color on values and state indicators, not as broad decorative fill.
- Avoid gradients in component chrome unless they are explicitly part of the design token contract.
- Prefer restrained accent usage over constantly saturated interfaces.

### Typography

- Use tokenized families and sizes only.
- Limit active type palette per view: one display size, one body size, one metadata size unless there is a strong reason to expand.
- Labels and control metadata should remain terse and consistent.
- Keep terminology visually consistent: similar UI roles should read like the same system.

### Spacing and Layout Feel

- Use spacing to express grouping:
  - tight = same thing
  - medium = same group
  - wide = new group
  - vast = new context
- Prefer spacing and alignment over extra borders or wrapper boxes.
- Avoid monotonous equal spacing everywhere; rhythm matters.
- Use layout primitives before inventing bespoke visual wrappers.

### Craft Constraints

- Typography budget per view:
  - max 2 active font families
  - max 3 active font-size tokens
  - max 2 active font-weight tokens
- Spacing budget per view:
  - max 4 spacing scale steps in the primary composition
  - use larger jumps to signal new context instead of introducing many near-adjacent spacing values
- Color budget per section:
  - use the foreground scale for hierarchy first
  - use no more than 1 status/accent color as the visual interrupt in a section unless the UI is explicitly encoding data status
- Container escalation:
  - spacing only
  - divider
  - border
  - surface

If a screen needs more than those budgets to read clearly, the structure is probably wrong before the styling is.

### Motion and Interaction Tone

- Keep motion brief and purposeful.
- Support `prefers-reduced-motion`.
- Do not rely on motion to convey state required for comprehension.
- Prefer calm, readable transitions over attention-seeking animation.

### Surface and Elevation

- Prefer subtle surface separation and tokenized borders over heavy decorative chrome.
- Surfaces should make grouping clearer, not add visual noise.
- Avoid stacking unnecessary framed surfaces inside framed surfaces.

## Belongs Here Vs Defer Elsewhere

| Situation | Keep In `DESIGN.md` | Defer Elsewhere |
|----------|----------------------|-----------------|
| login page restyle | "Use calm, high-contrast branding with airy spacing." | `UX.md`: whether social login exists |
| auth UI hierarchy | "The primary action should dominate visually." | `STRUCTURE.md`: whether to use `card` or `auth-shell` |
| feedback treatment | "Errors should feel direct, not alarming." | component rules: whether to use inline error, toast, or summary box |

If the sentence names a primitive, archetype, route, or runtime behavior, it probably does not belong here.

## Visual Review Checklist

Review final UI for:

- hierarchy clarity
- color role discipline
- typography restraint
- spacing rhythm
- surface and elevation consistency
- motion tone
- major visual anti-patterns

This checklist is visual only. It is not a manifest, registration, or sitemap checklist.

## Accessibility Baseline

Visually, all interactive UI should provide:

- clear focus visibility
- readable contrast
- reduced-motion-safe behavior
- understandable disabled and error states

Implementation specifics for states, contracts, manifests, and Type I/II boundaries live in `docs/csma-design/STRUCTURE.md`.

## State Visual Treatment

- Focus:
  - use tokenized ring/border treatment
  - focus must be clearly visible without relying on color alone
- Error:
  - use destructive color on the control edge, indicator, or text
  - do not turn large surfaces into error-colored blocks by default
- Success:
  - use success color on values, badges, or confirmation text
  - keep success styling quiet and specific to the confirmed element
- Disabled:
  - reduce emphasis with muted foreground and lower contrast while keeping content legible
  - disabled UI should still look intentional, not broken
- Loading:
  - use muted foreground, progress affordances, or tokenized activity treatment
  - loading should preserve layout stability and should not depend on decorative animation for comprehension

These rules are cross-cutting defaults. Component-level state selectors still belong in CSS and manifests.

## Theme Awareness

- All new work must render correctly in light and dark themes at minimum.
- Theme changes should preserve hierarchy, state visibility, and surface separation, not just contrast.
- Avoid visual treatments that only work on one background polarity.
- Verify token choices on both background and surface contexts before considering a component complete.
- Contrast and focus treatment should remain valid across supported themes, including higher-contrast modes when present.

## Anti-Patterns

- no hardcoded colors, spacing, radii, shadows, or z-index values
- no inline styles for state changes
- no decorative gradients by default
- no nested decorative surfaces when spacing would solve the hierarchy
- no visually loud status colors used as broad fill everywhere
- no system-breaking one-off aesthetics unless chosen deliberately as a manual escape hatch

## Relationship To Tokens

`DESIGN.md` defines intent.

`design-tokens.json` defines values.

```text
DESIGN.md
  -> visual decision
  -> design-tokens.json
  -> generated tokens.css
```

If the visual language changes, update `DESIGN.md` first.
If only values change, update `design-tokens.json`.

## Migration Note

This file intentionally stays visual-only.

For:

- Type I vs Type II rules
- primitive/archetype rules
- manifest expectations
- component authoring
- page composition

read `docs/csma-design/STRUCTURE.md`.
