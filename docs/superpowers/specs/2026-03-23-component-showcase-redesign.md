# Component Showcase Redesign

**Date:** 2026-03-23
**Status:** Draft
**Target:** `src/ui/components/index.html`

## Problem

The current Component Explorer crams component previews into fixed-height iframes (320px), which:
- Restricts component visibility, especially for larger or interactive components
- Doesn't showcase CSMA's design quality to stakeholders
- Creates a cramped, documentation-like feel rather than a design showcase

## Goal

Transform the explorer into a **design showcase** where components are displayed with proper breathing room, allowing stakeholders to appreciate the quality and polish of CSMA's UI system.

## Design

### Layout

Three-zone layout:

```
┌─────────────────────────────────────────────────┐
│  Header (fixed)                                 │
│  [≡] CSMA Components    [search]    [Patterns] [🌙]
├──────────┬──────────────────────────────────────┤
│ Sidebar  │  Main Area (scrollable)              │
│ (fixed)  │                                      │
│          │      Component Name                  │
│ ▸ Forms  │                                      │
│   Button │      ┌──────────────────────────┐   │
│   Input  │      │                          │   │
│   Select │      │    Live Component Demo   │   │
│          │      │    (full width, natural  │   │
│ ▸ Overlay│      │     height, no iframe)   │   │
│   Dialog │      │                          │   │
│   Drawer │      └──────────────────────────┘   │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

**Header:** Logo, search, link to Patterns, theme toggle (unchanged from current)

**Sidebar:**
- Fixed on desktop, collapsible overlay on mobile
- Categories as section headers
- Component names as navigation links
- Active link highlighted

**Main Area:**
- Scrollable canvas
- Single component displayed at a time
- Component renders directly in DOM (no iframe)
- Minimal chrome: just component name + demo

### Component Switching (SPA Behavior)

Single-page app with dynamic content swapping:

1. User clicks sidebar link
2. Call current `cleanup()` from previous `initUI()`
3. Clear main area DOM
4. Insert selected component's HTML from registry
5. Call `initUI(eventBus)` to wire up new component's JS
6. Update URL hash (e.g., `#button`) for shareable links
7. Update active state in sidebar

**First load:**
- If URL has hash matching a component, load that component
- Otherwise, load the first component in the registry

**EventBus:**
- Single EventBus instance persists across switches
- Components subscribe/unsubscribe through their own lifecycle
- No need to recreate the bus

### Component Registry

Each entry contains:
- `id` — URL-safe identifier (e.g., `"button"`)
- `name` — Display name (e.g., `"Button"`)
- `category` — Grouping for sidebar (e.g., `"Form"`)
- `html` — Full showcase demo markup

**Key change from current:**
- Current: `preview` is small snippet in iframe
- New: `html` is a **full showcase demo** — component shown in its best light, natural sizing, multiple states if appropriate

**Example:**
```javascript
{
  id: 'button',
  name: 'Button',
  category: 'Form',
  html: `
    <div class="showcase-demo">
      <button class="button">Primary Action</button>
      <button class="button" data-variant="secondary">Secondary</button>
      <button class="button" data-variant="ghost">Ghost</button>
      <button class="button" disabled>Disabled</button>
    </div>
  `
}
```

### Main Area Styling

**Component name header:**
- Small, muted, above the demo
- Uses existing typography tokens
- Just enough context, not intrusive

```css
.showcase-header {
  margin-bottom: var(--space-xl);
}

.showcase-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--foreground-muted);
}
```

**Demo container:**
- Uses existing surface tokens
- Generous padding
- No border/shadow — neutral gallery space

```css
.showcase-canvas {
  padding: var(--space-2xl);
  min-height: 60vh;
}
```

### Sidebar Navigation

**Structure:**
- Categories as section headers (CSS-Only, Form, Interactive, Overlay, Navigation, Data, Layout)
- Component links below each category
- Active link highlighted with primary color accent

**Active state:**
```css
.sidebar-nav-link.active {
  background: var(--explorer-sidebar-link-active-bg);
  color: var(--explorer-sidebar-link-active-fg);
  border-left: var(--explorer-sidebar-link-border-width) solid var(--primary);
}
```

**Search:**
- Filters sidebar links (hides non-matching)
- If only one match, auto-select it
- If multiple matches, main area shows first match or stays on current if it matches
- Zero matches: show "No components found" in main area

### Responsive Behavior

**Desktop (≥768px):**
- Sidebar visible, fixed width
- Main area flexible

**Mobile (<768px):**
- Sidebar hidden by default
- Hamburger toggle in header opens sidebar as overlay
- Clicking a component link closes sidebar
- Backdrop click closes sidebar

### Edge Cases

**Invalid hash:**
- Redirect to first component in registry
- No visible error state

**Component render failure:**
- Try/catch around HTML insertion
- Show simple error message in main area
- Log to console for debugging

**Theme switching:**
- Handled by existing theme toggle
- Components inherit theme automatically (no iframe isolation)

## Files to Modify

| File | Change |
|------|--------|
| `src/ui/components/index.html` | Rewrite for SPA showcase pattern |
| `src/ui/components/index.css` | New showcase layout styles |
| `src/ui/components/component-registry.js` | Update entries with fuller `html` demos |

## Success Criteria

- [ ] Single component displayed at a time with full width/height freedom
- [ ] Sidebar navigation with active state
- [ ] URL hash updates for shareable links
- [ ] Cleanup/reinit lifecycle works correctly when switching
- [ ] Search filters sidebar correctly
- [ ] Mobile responsive with collapsible sidebar
- [ ] Theme toggle works for displayed component
- [ ] No iframes — components render directly
