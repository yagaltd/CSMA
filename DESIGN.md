---
name: CSMA
version: "2.0.0"
description: Design-token-first vanilla JS template with modular runtime
colors:
  background: "#FAFAFA"
  backgroundMuted: "#F4F4F5"
  surface: "#FFFFFF"
  surfaceMuted: "#F9FAFB"
  foreground: "#18181B"
  foregroundMuted: "#71717A"
  border: "#E4E4E7"
  primary: "#27272A"
  primaryForeground: "#FAFAFA"
  secondary: "#F4F4F5"
  secondaryForeground: "#27272A"
  accent: "#F4F4F5"
  accentForeground: "#27272A"
  destructive: "#EF4444"
  destructiveForeground: "#FAFAFA"
  success: "#22C55E"
  warning: "#EAB308"
  info: "#3B82F6"
typography:
  h1:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: 2.4375rem
    fontWeight: 700
    lineHeight: 1.15
  h2:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: 1.9375rem
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 500
    lineHeight: 1.5
  mono:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.6
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 999px
spacing:
  2xs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
  5xl: 96px
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primaryForeground}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "40px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructiveForeground}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "40px"
  badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondaryForeground}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
    height: "24px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
---

## Overview

CSMA is a framework-free frontend architecture. JavaScript manages state via
events, CSS handles rendering via `data-*` attributes. No virtual DOM, no
build-step dependency, no framework lock-in.

The design system is token-driven. Every color, spacing value, radius, shadow,
and motion duration lives in `src/style/design-tokens.json` (DTCG format). Run
`npm run tokens` to regenerate `src/generated/tokens.css`. Never edit generated
CSS directly.

Visual identity: calm, intentional, hierarchy-first. Surfaces stay quiet. One
dominant action per major section. Accessibility is default — WCAG contrast,
focus rings, reduced motion support.

## Colors

### Light theme

| Token | Value | Usage |
|:------|:------|:------|
| **background** | `#FAFAFA` | Page background |
| **surface** | `#FFFFFF` | Card, panel, elevated surfaces |
| **foreground** | `#18181B` | Headlines, body text |
| **foregroundMuted** | `#71717A` | Captions, metadata, placeholders |
| **border** | `#E4E4E7` | Dividers, input borders |
| **primary** | `#27272A` | Primary actions, focus rings |
| **secondary** | `#F4F4F5` | Secondary actions, tags |
| **destructive** | `#EF4444` | Delete, error, danger |
| **success** | `#22C55E` | Completion, confirmation |
| **warning** | `#EAB308` | Caution, pending |
| **info** | `#3B82F6` | Information, links |

### Dark theme

Dark theme inverts luminance: `background` becomes `#09090B`, `surface`
becomes `#18181B`, `foreground` becomes `#FAFAFA`. All other tokens shift
proportionally. Toggle via `document.documentElement.dataset.theme = 'dark'`.

## Typography

| Token | Family | Size | Weight | Line Height |
|:------|:-------|:-----|:-------|:------------|
| **h1** | IBM Plex Sans | 39px / 2.4375rem | 700 | 1.15 |
| **h2** | IBM Plex Sans | 31px / 1.9375rem | 700 | 1.25 |
| **body** | IBM Plex Sans | 16px / 1rem | 400 | 1.6 |
| **label** | IBM Plex Sans | 13px / 0.8125rem | 500 | 1.5 |
| **mono** | IBM Plex Mono | 13px / 0.8125rem | 400 | 1.6 |

Hierarchy before decoration. Headlines use tight line-height; body uses base
for readability. Labels use medium weight for scanability.

## Layout & Spacing

### Spacing scale

| Token | Value | Usage |
|:------|:------|:------|
| **2xs** | 2px | Hairline dividers |
| **xs** | 4px | Tight internal gaps |
| **sm** | 8px | Compact padding, icon gaps |
| **md** | 12px | Standard component gaps |
| **lg** | 16px | Standard padding |
| **xl** | 24px | Section gaps |
| **2xl** | 32px | Large section gaps |
| **3xl** | 48px | Page-level spacing |
| **4xl** | 64px | Hero padding |
| **5xl** | 96px | Maximum vertical rhythm |

### Breakpoints

| Token | Value | Usage |
|:------|:------|:------|
| **sm** | 480px | Small phones |
| **md** | 768px | Tablets, large phones |
| **lg** | 1024px | Laptops |
| **xl** | 1280px | Desktops |

### Container widths

| Token | Value | Usage |
|:------|:------|:------|
| **containerNarrow** | 600px | Narrow content (forms, articles) |
| **container** | 900px | Default content |
| **containerWide** | 1200px | Full-width pages |
| **sidebar** | 240px | Fixed sidebar |

## Elevation & Depth

| Token | Value |
|:------|:------|
| **shadow-sm** | `0 1px 2px 0 rgba(0,0,0,0.05)` |
| **shadow-md** | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` |
| **shadow-lg** | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` |
| **shadow-xl** | `0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)` |

Elevation is reserved for modals, toasts, and hover states. Do not add shadow
to every card by default.

## Shapes

| Token | Value | Usage |
|:------|:------|:------|
| **none** | 0px | Tables, data grids |
| **sm** | 4px | Buttons, inputs, small chips |
| **md** | 8px | Cards, panels |
| **lg** | 12px | Modals, dialogs |
| **xl** | 16px | Large containers |
| **full** | 999px | Badges, pills, avatars |

## Components

### Type I — Pure CSS

No JavaScript required. Variants and states controlled by `data-*` attributes.
CSS handles all rendering.

**Badge**
```
badge/
  badge.css
```
- Props: `data-variant` (soft-primary, soft-success, soft-warning, soft-danger, soft-info), `data-size` (sm, md)
- No JS initialization
- Reference: `src/ui/components/badge/badge.css`

**Button**
```
button/
  button.css
```
- Props: `data-variant` (default, primary, secondary, ghost, destructive), `data-tone` (neutral, brand, danger), `data-size` (sm, md, lg), `data-shape` (default, pill, icon)
- No JS initialization
- Reference: `src/ui/components/button/button.css`

**Card**
```
card/
  card.css
```
- Props: `data-tone` (neutral, brand, danger)
- Slots: body, footer
- No JS initialization
- Reference: `src/ui/components/card/card.css`

**Field**
```
field/
  field.css
```
- Props: `data-label`, `data-helper`, `data-error`, `data-required`
- Slots: control (input, select, textarea)
- No JS initialization
- Reference: `src/ui/components/field/field.css`

**Input**
```
input/
  input.css
```
- Props: `data-type` (text, password, email, number, search, tel, url), `data-state` (default, hover, focus, active, disabled, error, loading), `data-autocomplete`
- No JS initialization
- Reference: `src/ui/components/input/input.css`

### Type II — EventBus-Driven

CSS + JS. JS exports `init[Name]System(eventBus)` returning a cleanup function.
The component subscribes to its own intents and publishes completion events.

**Toast**
```
toast/
  toast.css
  toast.js
```
- Props: `data-type` (default, success, error, warning), title, description, duration
- Init: `initToastSystem(eventBus)` — returns `() => unsubscribe()`
- Subscribes: `INTENT_TOAST_SHOW`
- Publishes: `TOAST_SHOWN`
- Runtime dependency: EventBus
- Reference: `src/ui/components/toast/toast.js`

**Theme Toggle**
```
theme-toggle/
  theme-toggle.css
```
- Props: `data-theme` (light, dark, contrast)
- No JS initialization (standalone script handles toggle)
- Reference: `src/ui/components/theme-toggle/theme-toggle.css`

## Layout Patterns

### Auth Split-Screen

```
+----------------------------------+
|  Brand / Illustration  |  Form   |
|        (50%)           |  (50%)  |
+----------------------------------+
```

- Grid: `grid-template-columns: 1fr 1fr`, gap `var(--space-xl)`
- Below `--breakpoint-md` (768px): stack to single column
- Left: brand background, large headline, supporting copy
- Right: form with `.stack` gap `var(--space-lg)`, field + input + button
- Uses `--layout-container-wide` (1200px) max-width

### Dashboard Grid

```
+----------------------------------+
|  Sidebar  |  Header               |
|  240px    +-----------------------+
|  (fixed)  |  Cards / Tables       |
|           |  grid 3-col on lg     |
+----------------------------------+
```

- Layout: `grid-template-columns: var(--layout-sidebar) 1fr`
- Sidebar: sticky, top `var(--space-lg)`, `.stack` navigation links
- Main: `.stack` with header + `.grid` content area
- Cards: `--shadow-sm`, `--radius-lg`, gap `var(--space-md)`
- Below `--breakpoint-lg` (1024px): hide sidebar behind toggle

### Settings Form

```
+----------------------------------+
|  Section Title                    |
|  .stack gap=lg                    |
|    field > input                  |
|    field > input                  |
|    cluster (buttons)              |
+----------------------------------+
```

- Container: `--layout-container-narrow` (600px) max-width, centered
- Section groups separated by `var(--space-2xl)`
- Fields in `.stack` with gap `var(--space-lg)`
- Action buttons in `.cluster`, right-aligned
- Uses `--layout-container-narrow` for readable line length

### Hero Section

```
+----------------------------------+
|  badge (eyebrow)                  |
|  h1 (headline)                    |
|  p (supporting text)              |
|  .cluster (CTA buttons)           |
+----------------------------------+
```

- Centered `.stack` on large screens, left-aligned on mobile
- Background: `--surface` or subtle `--backgroundMuted`
- CTA pair: primary + secondary button variants
- Max-width: `--layout-container` (900px)

## Runtime Contracts

Type II components use the EventBus for all interaction. The DOM layer publishes
`INTENT_*` events; the service layer validates and publishes `*_CHANGED` or
`*_COMPLETED` state updates.

### Event Naming Convention

| Prefix | Meaning | Example |
|:-------|:--------|:--------|
| `INTENT_*` | User action or component intent | `INTENT_TODO_CREATE` |
| `*_COMPLETED`, `*_UPDATED` | State change confirmed | `TODO_CREATED` |
| `SECURITY_*` | Security event | `SECURITY_VIOLATION` |

### Toast Contract

```yaml
INTENT_TOAST_SHOW:
  schema:
    id: string
    type: enum("default", "success", "error", "warning")
    title: string
    description: optional(string)
    duration: optional(number)  # ms, default 5000
  security:
    rateLimits:
      perSecond: 5
      perMinute: 30
TOAST_SHOWN:
  schema:
    toastId: string
    timestamp: number
```

### Pattern for Type II Components

```javascript
// DOM layer publishes intent
eventBus.publish('INTENT_TOAST_SHOW', {
  id: 'welcome-toast',
  type: 'success',
  title: 'Welcome',
  duration: 5000
});

// Service validates and publishes state change
// UI layer subscribes and updates CSS classes
eventBus.subscribe('TODO_STATE_CHANGED', (state) => {
  document.getElementById('todo-count').textContent = state.stats.total;
});
```

All payloads validated by Contracts. Invalid payloads are silently dropped and
logged as `SECURITY_VIOLATION`.

## Do's and Don'ts

### Do

- Use `var(--token)` for every visual value
- Use `data-*` attributes for component state and variants
- Use `className` or `dataset` for state changes
- Use `textContent` for user-generated text
- Validate all EventBus payloads with Contracts
- Clean up subscriptions on unmount (`return () => unsubscribe()`)
- Support `prefers-reduced-motion: reduce`
- Reference tokens, never hardcode pixels or hex colors

### Don't

- Use `element.style.opacity = '1'` or any inline styles for UI state
- Use `element.innerHTML` for user data (XSS risk)
- Use BEM modifier classes — `data-*` only
- Skip contract validation on EventBus events
- Leave subscriptions hanging without cleanup
- Edit `src/generated/tokens.css` directly
- Use `!important` in component CSS

## Interoperability

This DESIGN.md references the canonical token source at
`src/style/design-tokens.json` (DTCG format). Run `npm run tokens` to regenerate
custom properties.

To use this design in another project:

1. Copy `src/style/design-tokens.json` and adapt values
2. Run `npm run tokens` to generate CSS
3. Import `src/generated/tokens.css` in your app entry
4. Use component class names and `data-*` attributes as documented above
