---
name: <your-app-name>
version: "1.0.0"
description: <brief description of your app>
visual_direction: <professional | playful | premium | dense | editorial | utility>
primary_user: <who uses this app>
themes: [light, dark, contrast]
---

# Design Brief

`DESIGN.md` is the agent-facing project brief and composition guide. It is not
a token compiler input. Keep it compact, concrete, and specific to the app being
built.

## Token Source

`src/style/design-tokens.json` is the CSMA base visual seed and runtime token
source. Agents should patch brand and project values through
`src/style/token-overrides.json`, run `npm run tokens:patch`, and consume the
regenerated `src/generated/tokens.css`.

Never treat this file's front matter as canonical runtime tokens and never edit
`src/generated/tokens.css` directly.

| Source | Role | Edit rule |
|:-------|:-----|:----------|
| `src/style/design-tokens.json` | CSMA base token seed (DTCG) | Never edit directly. Patch via overrides. |
| `src/style/token-overrides.json` | Brand/project patches | Agent writes this. Dot-notation DTCG paths. |
| `src/generated/tokens.css` | Runtime CSS variables | Generated only by `npm run tokens` or `npm run tokens:patch`. |
| `tooling/generated/token-reference.json` | Machine-readable token reference | Regenerate with token tooling when needed. |
| `DESIGN.md` | Human and agent composition guide | Record intent, recipes, and Type I/II decisions. |

## Token Patch Workflow

```text
Agent reads DESIGN.md (this file)
         |
         v
Agent writes src/style/token-overrides.json
         |
         v
npm run tokens:patch
```

Never read or edit `design-tokens.json` directly when making app-specific token
changes. The patch script merges overrides and regenerates CSS.

## CSMA Base Token Paths

Use these DTCG paths in `src/style/token-overrides.json`.

### Primitives

```text
primitives.spacing.{2xs|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl}.$value
primitives.typography.fontFamily.{base|mono}.$value
primitives.typography.fontSize.{xs|sm|base|lg|xl|2xl|3xl}.$value
primitives.typography.fontWeight.{regular|medium|semibold|bold}.$value
primitives.typography.lineHeight.{tight|heading|body|base|loose}.$value
primitives.letterSpacing.{display|heading|normal|label|uppercase|wide}.$value
primitives.radius.{none|sm|md|lg|xl|2xl|3xl|full}.$value
primitives.shadow.{xs|sm|md|lg|xl}.$value
primitives.motion.duration.{instant|fast|normal|slow|enter}.$value
primitives.motion.easing.{outQuart|outQuint|outExpo|inOutSoft}.$value
primitives.breakpoint.{sm|md|lg|xl}.$value
primitives.zIndex.{base|overlay|modal|popover|toast|lightbox}.$value
primitives.opacity.{disabled|muted|faded|hover|overlay}.$value
primitives.borderWidth.{default|focus|emphasis|accent}.$value
primitives.focusRing.{offsetWidth|width|shadow}.$value
primitives.layout.{containerNarrow|container|containerWide|sidebar|touchTarget|gridMinSm|gridMinMd|gridMinLg}.$value
```

### Themes

```text
themes.{light|dark|contrast|dark-storm}.colors.{background|backgroundMuted|surface|surfaceMuted|foreground|foregroundMuted|border|primary|primaryForeground|secondary|secondaryForeground|accent|accentForeground|destructive|destructiveForeground|warning|warningForeground|success|successForeground|info|infoForeground}.$value
themes.{light|dark|contrast|dark-storm}.colors.{background|backgroundMuted|surface|surfaceMuted|foreground|foregroundMuted|border|primary|primaryForeground|secondary|secondaryForeground|accent|accentForeground|destructive|destructiveForeground|warning|warningForeground|success|successForeground|info|infoForeground}.$description
```

### Components

```text
components.button.{radius|height|heightSm|heightLg|paddingBlock|paddingInline|fontSize}.$value
components.input.{radius|height|paddingBlock|paddingInline}.$value
components.card.{radius|padding|shadow}.$value
components.dialog.{radius|shadow}.$value
components.navbar.height.$value
```

## Overview

<!-- Agent: Fill this section with the user through conversation. -->

| Question | Decision |
|:---------|:---------|
| App category | `<SaaS dashboard / commerce / tool / content / internal app>` |
| Primary user | `<role, context, expertise>` |
| Desired feeling | `<calm, dense, premium, playful, editorial, clinical, etc.>` |
| Brand signals | `<colors, typography, imagery, tone>` |
| Density | `<compact / balanced / spacious>` |
| Reference products | `<specific products or visual references>` |

## Token Usage

<!-- Agent: Translate user choices into concrete token patches in src/style/token-overrides.json. -->

| Area | CSMA tokens | App decision | Notes |
|:-----|:------------|:-------------|:------|
| Backgrounds | `--background`, `--background-muted`, `--surface`, `--surface-muted` | `<decision>` | Define page, panel, and muted surface roles. |
| Text | `--foreground`, `--foreground-muted` | `<decision>` | Keep muted text readable in all themes. |
| Brand/action | `--primary`, `--primary-foreground`, `--accent` | `<decision>` | Primary is for decisive actions and focus. |
| Status | `--success`, `--warning`, `--destructive`, `--info` | `<decision>` | Map statuses to domain language. |
| Typography | `--font-family-*`, `--font-size-*`, `--line-height-*` | `<decision>` | Use existing scale unless the app has a strong reason. |
| Spacing | `--space-xs` through `--space-5xl` | `<decision>` | Define density using relationships, not one-off values. |
| Shape | `--radius-*`, component radius tokens | `<decision>` | Keep cards/buttons/fields consistent unless hierarchy requires contrast. |
| Elevation | `--shadow-*`, `--card-shadow` | `<decision>` | Use borders first; add shadow for lift or overlay. |

## Visual Distinctiveness

<!-- Agent: Record the app-specific taste constraints that keep screens from drifting. -->

| Decision | Rule |
|:---------|:-----|
| Primary moment | `<hero metric / product image / workflow board / editor surface / command input>` |
| Hierarchy layers | `<primary: first read / secondary: supporting context / tertiary: metadata>` |
| Signature motif | `<none / ruled lines / dense grid / editorial image / status strip / timeline rail>` |
| Density rule | `<compact rows / balanced cards / airy editorial sections / dashboard dense>` |
| Container rule | `<spacing first / divider / border / card surface>` |
| Interaction feel | `<instant utility / calm transitions / instrument-like / editorial>` |

## App Anti-Patterns

<!-- Agent: List visual moves that should not appear in this app, even if they are allowed by CSMA generally. -->

| Anti-pattern | Why it is forbidden | Safer alternative |
|:-------------|:--------------------|:------------------|
| `<no nested cards>` | `<reason>` | `<sibling sections or unframed layout>` |
| `<no decorative gradients>` | `<reason>` | `<token surface, image, or meaningful status color>` |
| `<no emoji or mascot empty states>` | `<reason>` | `<short copy plus relevant action>` |
| `<no heavy shadows>` | `<reason>` | `<border, tonal surface, or spacing>` |

## Component Recipes

<!-- Agent: Name domain-specific components, not only generic primitives. -->

| Component recipe | Compose from | Visual tokens | States | Type | Event/contract notes |
|:-----------------|:-------------|:--------------|:-------|:-----|:---------------------|
| `<domain-card>` | `.card`, `.badge`, actions | `<tokens>` | `<default/hover/selected/loading>` | `<I/II>` | `<INTENT_* or none>` |
| `<primary-task-action>` | `.button[data-variant="primary"]` | `<tokens>` | `<default/loading/disabled>` | `<I/II>` | `<contract if Type II>` |
| `<filter-toolbar>` | `.cluster`, `.button`, `.badge` | `<tokens>` | `aria-pressed`, `data-state` | `<I/II>` | `<publish filter intent if app state changes>` |
| `<data-field>` | `.field`, `.input` | `<tokens>` | `data-state="error"` | `<I/II>` | `<validation contract if submitted>` |

## Layout Recipes

<!-- Agent: Define recurring page layouts that the app will reuse. -->

| Layout recipe | Shell | Container | Desktop | Mobile | Notes |
|:--------------|:------|:----------|:--------|:-------|:------|
| `<dashboard>` | `<header> + sidebar + main` | `--layout-container-wide` | `<columns/grid>` | `<stack/collapse>` | `<critical responsive behavior>` |
| `<detail-page>` | `<main> + aside` | `--layout-container-wide` | `<content/sidebar>` | `<aside below>` | `<sticky/priority notes>` |
| `<settings>` | `<section>` stacks | `--layout-container-narrow` | `<label/control rows>` | `<single column>` | `<action placement>` |
| `<empty-state>` | centered stack | `--layout-container` | `<copy + action cluster>` | `<same, reduced gap>` | `<when shown>` |

## Responsive Behavior

| Pattern | Default | `md+` | `lg+` | Collapse rule |
|:--------|:--------|:------|:------|:--------------|
| Page inset | `--space-xl` | `--space-2xl` | `--space-3xl` | Reduce before text wraps awkwardly. |
| Card grid | `1fr` | `repeat(auto-fit, minmax(var(--layout-grid-min-sm), 1fr))` | Use `--layout-grid-min-md` for dense cards | Preserve readable card width. |
| Toolbar | Wrapped `.cluster` | Space-between groups | Same | Wrap controls before truncating labels. |
| Sidebar | Below content or top nav | Optional split | Fixed `--layout-sidebar` column | Collapse if main content becomes cramped. |
| Forms | Single column | Optional label/control split | Same | Error/help text stays under the input. |

## Spacing Relationships

| Relationship | Token | App usage |
|:-------------|:------|:----------|
| Icon to label | `--space-xs` | `<usage>` |
| Related controls | `--space-sm` | `<usage>` |
| Field groups and rows | `--space-md` | `<usage>` |
| Card internals | `--space-lg` or `--card-padding` | `<usage>` |
| Section content gap | `--space-xl` | `<usage>` |
| Major page bands | `--space-2xl` to `--space-4xl` | `<usage>` |

## Type I/II Decisions

| Need | Type | Implementation rule |
|:-----|:-----|:--------------------|
| Static visual variants | Type I | Use classes, ARIA, and `data-*`; CSS handles rendering. |
| Form field styling and validation display | Type I | Use `data-state`; do not mutate inline styles. |
| User action changes app state | Type II | Publish `INTENT_*`; validate payload with Contracts. |
| Async loading or persistence | Type II | Render `data-loading`/`data-state` from confirmed state. |
| Notifications | Type II | Use toast system and cleanup subscriptions. |
| Theme changes | Type II | Set `document.documentElement.dataset.theme`; persist outside CSS. |

## CSMA Requirements

The following rules are non-negotiable. The agent must enforce them when
building components and pages.

### State Changes = CSS Classes Only

```javascript
// CORRECT
element.className = 'card completed';
element.dataset.state = 'loading';

// WRONG - never use inline styles
element.style.opacity = '1';
```

### Type I Components (Pure CSS)

No JavaScript. Variants controlled by `data-*` attributes. CSS handles all
rendering.

```html
<button class="button" data-variant="primary" data-size="md">Save</button>
```

### Type II Components (EventBus-Driven)

CSS + JS. Export `init[Name]System(eventBus)` returning cleanup.

```javascript
export function initToastSystem(eventBus) {
  const unsubscribe = eventBus.subscribe('INTENT_TOAST_SHOW', (payload) => {
    showToast(payload);
    eventBus.publish('TOAST_SHOWN', { toastId: payload.id });
  });
  return () => unsubscribe();
}
```

### Event Naming Convention

| Prefix | Meaning | Example |
|:-------|:--------|:--------|
| `INTENT_*` | User action or component intent | `INTENT_TODO_CREATE` |
| `*_COMPLETED`, `*_UPDATED` | State change confirmed | `TODO_CREATED` |
| `SECURITY_*` | Security event | `SECURITY_VIOLATION` |

### Security Rules

- Use `textContent`, never `innerHTML`, for user data.
- Validate all EventBus payloads with Contracts.
- Clean up subscriptions on unmount.
- Support `prefers-reduced-motion: reduce`.

### Token Workflow

1. Edit `src/style/token-overrides.json` for app-specific token changes.
2. Run `npm run tokens:patch` to merge into `src/style/design-tokens.json` and regenerate CSS.
3. Reference tokens in CSS: `var(--primary)`, `var(--space-lg)`.
4. Never edit `src/style/design-tokens.json` or `src/generated/tokens.css` directly for app-specific work.
