# CSMA UI Components Skill

Expert guidance on building UI components for CSMA, including CSS token system, component structure, and theming.

## Design System Foundation

CSMA UI uses a token-based design system similar to shadcn/ui.

### Token Location
`src/css/foundation/tokens.css` - Single source of truth

### Color Tokens
```css
/* Semantic colors */
--fx-color-bg: hsl(0 0% 100%);
--fx-color-fg: hsl(222.2 84% 4.9%);
--fx-color-surface: hsl(0 0% 100%);
--fx-color-border: hsl(214.3 31.8% 91.4%);

/* Semantic variants */
--fx-color-primary: hsl(222.2 47.4% 11.2%);
--fx-color-on-primary: hsl(210 40% 98%);
--fx-color-secondary: hsl(210 40% 96.1%);
--fx-color-danger: hsl(0 84.2% 60.2%);
--fx-color-success: hsl(142 71% 45%);
--fx-color-warning: hsl(38 92% 50%);
--fx-color-info: hsl(221 83% 53%);
```

### Spacing Scale
```css
--fx-space-2xs: 0.125rem;  /* 2px */
--fx-space-xs: 0.25rem;    /* 4px */
--fx-space-sm: 0.5rem;     /* 8px */
--fx-space-md: 0.75rem;    /* 12px */
--fx-space-lg: 1rem;       /* 16px */
--fx-space-xl: 1.5rem;     /* 24px */
--fx-space-2xl: 2rem;      /* 32px */
--fx-space-3xl: 3rem;      /* 48px */
```

### Border Radii
```css
--fx-radius-sm: 0.25rem;
--fx-radius-md: 0.5rem;
--fx-radius-lg: 0.75rem;
--fx-radius-xl: 1rem;
--fx-radius-full: 999px;
```

### Typography
```css
--fx-font-family-base: "Inter", system-ui, sans-serif;
--fx-font-family-mono: "JetBrains Mono", monospace;
--fx-font-size-xs: 0.75rem;
--fx-font-size-sm: 0.875rem;
--fx-font-size-md: 1rem;
--fx-font-size-lg: 1.125rem;
```

## Component Structure

Each component lives in `src/ui/components/[name]/`:

```
button/
├── button.css        # Styles (required)
├── button.js         # Behavior (Type II/III only)
├── button.demo.html  # Demo page
└── manifest.json     # Metadata (optional)
```

## CSS Component Pattern

### Use data-* Attributes for Variants
```css
/* Base styles */
.button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--fx-space-xs);
  border: 1px solid var(--fx-color-border);
  border-radius: var(--fx-radius-lg);
  padding: var(--fx-space-sm) var(--fx-space-xl);
  font-family: var(--fx-font-family-base);
  cursor: pointer;
  transition: all var(--fx-transition-fast);
}

/* Variants via data-variant */
.button[data-variant="primary"] {
  background: var(--fx-color-primary);
  color: var(--fx-color-on-primary);
  border-color: transparent;
}

.button[data-variant="secondary"] {
  background: var(--fx-color-surface-muted);
  color: var(--fx-color-fg);
}

.button[data-variant="destructive"] {
  background: var(--fx-color-danger);
  color: var(--fx-color-on-danger);
}

/* Sizes via data-size */
.button[data-size="sm"] {
  padding: var(--fx-space-xs) var(--fx-space-lg);
  font-size: var(--fx-font-size-xs);
}

.button[data-size="lg"] {
  padding: var(--fx-space-md) var(--fx-space-2xl);
  font-size: var(--fx-font-size-md);
}

/* States via data-state or attributes */
.button[disabled] {
  cursor: not-allowed;
  opacity: 0.55;
}

.button[data-loading="true"] {
  pointer-events: none;
}
```

## HTML Pattern

```html
<!-- Base button -->
<button class="button">Default</button>

<!-- Primary button -->
<button class="button" data-variant="primary">Primary</button>

<!-- Small destructive button -->
<button class="button" data-variant="destructive" data-size="sm">
  Delete
</button>

<!-- Loading state -->
<button class="button" data-variant="primary" data-loading="true">
  Saving...
</button>

<!-- Icon button -->
<button class="button" data-variant="ghost" data-shape="icon" aria-label="Settings">
  <svg><!-- icon --></svg>
</button>
```

## Theme System

### Light Theme (Default)
Defined in `tokens.css` under `:root`

### Dark Theme
Defined in `src/css/foundation/themes/dark.css`:

```css
:root[data-theme="dark"] {
  --fx-color-bg: hsl(222.2 84% 4.9%);
  --fx-color-fg: hsl(210 40% 98%);
  --fx-color-surface: hsl(222.2 84% 4.9%);
  --fx-color-border: rgba(148, 163, 184, 0.35);
  /* ... more overrides */
}

/* System preference fallback */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    /* Same dark values */
  }
}
```

### Theme Toggle Implementation
```javascript
function toggleTheme() {
  const html = document.documentElement;
  const current = html.dataset.theme || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  html.dataset.theme = next;
  localStorage.setItem('theme', next);
  eventBus.publish('THEME_CHANGED', { theme: next });
}
```

## State Management Pattern

### Use data-state for Component State
```css
.dialog-overlay[data-state="open"] {
  display: flex;
}

.dialog-overlay[data-state="closed"] {
  display: none;
}

.input[data-state="error"] {
  border-color: var(--fx-color-danger);
}

.input[data-state="success"] {
  border-color: var(--fx-color-success);
}
```

### Complex State with Multiple Attributes
```css
.card[data-priority="high"][data-status="pending"] {
  border-left: 4px solid var(--fx-color-danger);
}

.card[data-priority="low"][data-status="completed"] {
  border-left: 4px solid var(--fx-color-success);
  opacity: 0.8;
}
```

## Existing Components

| Component | Type | CSS File | JS File |
|-----------|------|----------|---------|
| Accordion | II | accordion.css | accordion.js |
| Alert Dialog | II | alert-dialog.css | alert-dialog.js |
| Avatar | I | avatar.css | - |
| Badge | I | badge.css | - |
| Breadcrumb | I | breadcrumb.css | - |
| Button | I | button.css | - |
| Card | I | card.css | - |
| Carousel | II | carousel.css | carousel.js |
| Chat | I | chat.css | - |
| Checkbox | II | checkbox.css | checkbox.js |
| Datepicker | II | datepicker.css | datepicker.js |
| Dialog | II | dialog.css | dialog.js |
| Dropdown | II | dropdown.css | dropdown.js |
| File Upload | II | file-upload.css | file-upload.js |
| Input | II | input.css | input.js |
| Navbar | II | navbar.css | navbar.js |
| OTP | II | otp.css | otp.js |
| Pagination | II | pagination.css | pagination.js |
| Popover | II | popover.css | popover.js |
| Progress | II | progress.css | progress.js |
| Radio | II | radio.css | radio.js |
| Select | I | select.css | - |
| Separator | I | separator.css | - |
| Skeleton | I | skeleton.css | - |
| Slider | III | slider.css | slider.js + SliderService.js |
| Switch | II | switch.css | switch.js |
| Tabs | II | tabs.css | tabs.js |
| Textarea | II | textarea.css | textarea.js |
| Toast | II | toast.css | toast.js |
| Tooltip | II | tooltip.css | tooltip.js |

## Missing Components (Priority)

### High Priority
- Command (Command Palette)
- Context Menu
- Drawer/Sheet
- Form (Field, Label, Description)
- Multi-Select
- Number Field
- Scroll Area
- Table

### Medium Priority
- Alert
- Calendar
- Collapsible
- Hover Card
- Menubar
- Navigation Menu
- Resizable
