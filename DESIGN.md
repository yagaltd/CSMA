---
name: <your-app-name>
version: "1.0.0"
description: <brief description of your app>
colors:
  # Semantic colors — customize these, keep the names
  background: "#FAFAFA"
  surface: "#FFFFFF"
  foreground: "#18181B"
  foregroundMuted: "#71717A"
  border: "#E4E4E7"
  primary: "#27272A"
  primaryForeground: "#FAFAFA"
  secondary: "#F4F4F5"
  secondaryForeground: "#27272A"
  accent: "#F4F4F5"
  destructive: "#EF4444"
  success: "#22C55E"
  warning: "#EAB308"
  info: "#3B82F6"
typography:
  # Customize fonts and scale for your brand
  h1:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 2.4375rem
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  # Define your app's specific components here
  # Example:
  # card-primary:
  #   backgroundColor: "{colors.surface}"
  #   textColor: "{colors.foreground}"
  #   rounded: "{rounded.lg}"
  #   padding: "{spacing.md}"
---

## Overview

<!-- Agent: Fill this section with the user through conversation. -->

Describe the app's visual identity, brand personality, target audience, and the
emotional response the UI should evoke. Examples:

- "Professional SaaS dashboard — clean, dense, data-first"
- "Playful fitness app — energetic, bold, gamified"
- "Premium e-commerce — luxurious whitespace, editorial photography"

## Colors

<!-- Agent: Discuss palette choices with the user. -->

Describe the color strategy. Which colors drive action? Which provide calm?
How do semantic colors map to your app's concepts?

The CSMA token system supports light/dark/contrast themes via
`document.documentElement.dataset.theme`. All color values must reference the
tokens above or the full token system in `src/style/design-tokens.json`.

## Typography

<!-- Agent: Choose fonts and scale with the user. -->

Describe the type hierarchy. What font expresses your brand? How do sizes
scale? Any special treatments (all-caps labels, tight headlines, etc.)?

## Layout & Spacing

<!-- Agent: Define layout philosophy with the user. -->

Describe the layout approach. Grid-based or fluid? Dense or airy? Mobile-first
or desktop-first?

CSMA provides layout tokens:
- `--layout-container-narrow` (600px)
- `--layout-container` (900px)
- `--layout-container-wide` (1200px)
- `--layout-sidebar` (240px)

## Elevation & Depth

<!-- Agent: Define shadow/depth strategy. -->

How does the UI express depth? Shadows, borders, tonal shifts? When does
something lift?

## Shapes

<!-- Agent: Define corner radius philosophy. -->

Sharp, soft, or pill-shaped? Consistent across all elements or varied by
component type?

## Components

<!-- Agent: Define domain-specific components with the user. -->

This is where you name the UI vocabulary specific to YOUR app. Not generic
"Button" — name the button variants your app actually uses.

Examples from other apps:
- `glass-card-standard` — frosted card for weather metrics
- `card-walk-stat` — high-contrast data card for dog walking stats
- `list-item-walker` — walker profile row with hover state

For each component, specify:
- `backgroundColor`, `textColor`, `rounded`, `padding`
- Hover/active variants (e.g., `button-primary-hover`)
- CSMA type: Type I (Pure CSS) or Type II (EventBus-driven)

## Layout Patterns

<!-- Agent: Define recurring page layouts with the user. -->

Describe the spatial recipes your app uses repeatedly.

Examples:
- **Auth Split-Screen** — Brand left, form right, stacks on mobile
- **Dashboard Grid** — Fixed sidebar, main content grid
- **Settings Form** — Narrow centered container, stacked fields

## CSMA Requirements

The following rules are non-negotiable. The agent must enforce them when
building components and pages.

### State Changes = CSS Classes Only

```javascript
// CORRECT
element.className = 'card completed';
element.dataset.state = 'loading';

// WRONG — never use inline styles
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

- Use `textContent`, never `innerHTML`, for user data
- Validate all EventBus payloads with Contracts
- Clean up subscriptions on unmount
- Support `prefers-reduced-motion: reduce`

### Token Workflow

1. Edit `src/style/design-tokens.json` for token values
2. Run `npm run tokens` to regenerate CSS
3. Reference tokens in CSS: `var(--primary)`, `var(--space-lg)`
4. Never edit `src/generated/tokens.css` directly
