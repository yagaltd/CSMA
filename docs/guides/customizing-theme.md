# Customizing CSMA - Build Your Own UI

> **Philosophy**: Customizing CSMA's look is a top-down process. Start with design tokens (colors/spacing/radius), then components, then interactive features.
>
> **Foundation**: CSMA now uses **semantic naming** (`--primary`, `--background`, `--radius-md`) for clarity and shadcn/ui compatibility.

---

## The 5-Step Customization Process

When you want to give CSMA a **completely custom look** (not just tweak colors), follow this order:

### Step 1: Design Tokens (foundation/tokens.css) → 2-3 days
**Files**: `src/css/foundation/tokens.css` + `src/css/foundation/themes/*.css`

Start here! All components inherit these values. **Define tokens in the correct scope** to avoid bugs.

**What to change**:
```css
/* ====================================================================
   BASE TOKENS - Apply to ALL themes (light and dark)
   ==================================================================== */
:root {
  /* Border Radius - Apply to both themes */
  --radius: 0.625rem;                    /* Global base radius (10px) */
  --radius-sm: calc(var(--radius) - 0.25rem);  /* 6px */
  --radius-md: var(--radius);            /* 10px */
  --radius-lg: calc(var(--radius) + 0.25rem);  /* 14px */
  --radius-xl: calc(var(--radius) + 0.5rem);   /* 18px */
  --radius-full: 9999px;
  
  /* Spacing - Apply to both themes */
  --spacing-xs: 0.25rem;    /* 4px */
  --spacing-sm: 0.5rem;     /* 8px */
  --spacing-md: 0.75rem;    /* 12px */
  --spacing-lg: 1rem;       /* 16px */
  --spacing-xl: 1.25rem;    /* 20px */
  --spacing-2xl: 1.5rem;    /* 24px */
  
  /* Transitions - Apply to both themes */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  /* Shadows - Apply to both themes */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 12px 24px rgba(0, 0, 0, 0.15);
  --shadow-xl: 0 24px 48px rgba(0, 0, 0, 0.2);
}

/* ====================================================================
   LIGHT THEME - Colors only (inherits base tokens above)
   ==================================================================== */
:root[data-theme="light"],
:root:not([data-theme]) {
  /* Brand & Interactive Colors */
  --primary: hsl(222.2 47.4% 11.2%);          /* Primary brand/action color */
  --primary-foreground: hsl(210 40% 98%);     /* Text on primary */
  --secondary: hsl(210 40% 96.1%);            /* Subtle surfaces */
  --secondary-foreground: hsl(222.2 47.4% 11.2%); /* Text on secondary */
  --accent: hsl(210 40% 96.1%);               /* Hover states */
  --accent-foreground: hsl(222.2 47.4% 11.2%); /* Text on accent */
  
  /* Component Surfaces */
  --background: hsl(0 0% 100%);               /* Page background */
  --foreground: hsl(222.2 84% 4.9%);         /* Primary text */
  --card: hsl(0 0% 100%);                     /* Card background */
  --card-foreground: hsl(222.2 84% 4.9%);    /* Card text */
  --popover: hsl(0 0% 100%);                  /* Popover background */
  --popover-foreground: hsl(222.2 84% 4.9%); /* Popover text */
  --muted: hsl(210 40% 96.1%);                /* Muted backgrounds */
  --muted-foreground: hsl(215.4 16.3% 46.9%); /* Muted text */
  
  /* Status Colors */
  --destructive: hsl(0 84.2% 60.2%);          /* Error/red */
  --destructive-foreground: hsl(210 40% 98%);
  --success: hsl(142 71% 45%);                /* Success/green */
  --success-foreground: hsl(137 72% 94%);
  --warning: hsl(38 92% 50%);                 /* Warning/amber */
  --warning-foreground: hsl(48 96% 89%);
  --info: hsl(221 83% 53%);                   /* Info/blue */
  --info-foreground: hsl(210 40% 98%);
  
  /* Borders & Input */
  --border: hsl(214.3 31.8% 91.4%);
  --input: hsl(214.3 31.8% 91.4%);
  --ring: hsl(222.2 84% 4.9%);
}

/* ====================================================================
   DARK THEME - Colors only (inherits base tokens from :root above)
   ==================================================================== */
:root[data-theme="dark"] {
  --primary: hsl(210 40% 98%);
  --primary-foreground: hsl(222.2 47.4% 11.2%);
  --secondary: hsl(217.2 32.6% 17.5%);
  --secondary-foreground: hsl(210 40% 98%);
  --accent: hsl(217.2 32.6% 17.5%);
  --accent-foreground: hsl(210 40% 98%);
  
  --background: hsl(222.2 84% 4.9%);
  --foreground: hsl(210 40% 98%);
  --card: hsl(222.2 84% 4.9%);
  --card-foreground: hsl(210 40% 98%);
  --popover: hsl(222.2 84% 4.9%);
  --popover-foreground: hsl(210 40% 98%);
  --muted: hsl(217.2 32.6% 17.5%);
  --muted-foreground: hsl(215 20.2% 65.1%);
  
  --destructive: hsl(0 62.8% 30.6%);
  --destructive-foreground: hsl(210 40% 98%);
  --success: hsl(142 70% 45%);
  --success-foreground: hsl(20 95% 14%);
  --warning: hsl(38 92% 45%);
  --warning-foreground: hsl(48 96% 89%);
  --info: hsl(217 91% 60%);
  --info-foreground: hsl(222.2 84% 4.9%);
  
  --border: hsl(217.2 32.6% 17.5%);
  --input: hsl(217.2 32.6% 17.5%);
  --ring: hsl(212.7 26.8% 83.9%);
}
```

**Critical Rules**:
- ✅ **Radius/Spacing/Shadows**: Define in `:root` (base level) - applies to both themes
- ✅ **Colors Only**: Define in `:root[data-theme="light"]` and `:root[data-theme="dark"]`
- ✅ **Never hardcode**: Always use `var(--token-name)` in components

**Verify**:
- Open `src/ui/components/demos.html` - check buttons, cards have rounded corners
- Toggle theme - radius should work in both light and dark
- No square corners anywhere

---

### Step 2: Base Styles (base.css) → 1 day
**File**: `src/css/base.css`

Global typography, reset, and layout styles.

**What to change**:
```css
body {
  font-family: ui-sans-serif, system-ui, -apple-system; /* Your font */
  line-height: 1.5;  /* Your line height */
  font-size: 14px;   /* Your base size (already using --font-size-base) */
  color: var(--foreground);    /* ✅ Use semantic token */
  background: var(--background); /* ✅ Use semantic token */
}

h1, h2, h3 {
  font-weight: 600;  /* Your heading weight */
  letter-spacing: -0.025em; /* Your letter spacing */
}
```

**Verify**:
- Text looks different
- Spacing between elements adjusted
- Headings match your design
- Both themes work correctly

---

### Step 3: Type I - Pure CSS Components (Week 1)
**Examples**: Badge, Card, Avatar, Divider

**Why Type I first?**
- No JavaScript - easy to test
- Fast progress (2-3 hours each)
- Depends on foundation tokens + theme overrides
- Foundation for Type II/III

**How to build**:
1. Reference foundation tokens, never hardcode:
   ```css
   /* ✅ CORRECT - Uses foundation tokens */
   .badge {
     background: var(--secondary);
     padding: var(--spacing-xs) var(--spacing-sm);
     border-radius: var(--radius-full);
     color: var(--secondary-foreground);
   }
   
   /* ❌ WRONG - Hardcoded values */
   .badge {
     background: #f0f0f0;        /* ❌ Hardcoded color */
     padding: 4px 8px;           /* ❌ Hardcoded spacing */
     border-radius: 9999px;      /* ❌ Should use var(--radius-full) */
   }
   ```

2. Create component structure following existing patterns
3. Update `src/ui/components/demos.html` with link
4. Create demo page

**Order matters**: Build in this sequence:
1. Visual-only: Badge, Avatar, Divider
2. Layout: Card, Container

---

### Step 4: Type II - Self-Contained Components (Week 2-3)
**Examples**: Accordion, Dropdown, Toast, Tabs, Navbar

**Why Type II second?**
- Depends on Type I components (buttons, badges)
- Simple JavaScript via EventBus
- No external services needed

**How to build**:
1. Create CSS using foundation tokens (same as Type I)
2. Create init function that returns cleanup:
   ```javascript
   // src/ui/components/navbar/navbar.js
   export function initNavbarSystem(eventBus) {
     // Setup event listeners
     const cleanup = () => { /* remove listeners */ };
     return cleanup;
   }
   ```
3. Register in your app initialization

**Order matters**: Build after dependencies ready:
1. Needs Type I: Dropdown (uses Button), Toast (uses Badge)
2. Standalone: Accordion, Tabs, Navbar
3. Complex: Modal, Popover

---

### Step 5: Type III - Service-Backed Components (Week 3-4)
**Examples**: Calendar, File Upload, Drawer

**Why Type III last?**
- Most complex logic
- Requires Type I & II working
- Needs service architecture

**How to build**:
1. Create service with business logic
2. Register service
3. Create Type II component that uses the service
4. Use foundation tokens in CSS

---

## Why This Order Matters

### ✅ Starting with foundation tokens (correctly scoped)
- All components automatically use new tokens
- No refactoring needed later
- Visual consistency from day 1
- **No square corners in dark mode!**

### ✅ Type I before Type II
- Type II uses Type I components
- Test CSS in isolation first
- Foundation must be solid

### ❌ Wrong order = Rework
- **If tokens scoped wrong**: Components break in dark mode
- **If you skip theme**: Refactor every component later
- **If you hardcode**: Components don't adapt to themes

---

## Quick Reference: Foundation Tokens

| Token Category | Where Defined | Examples | Use For |
|----------------|---------------|----------|---------|
| **Colors** | Theme sections (light/dark) | `--primary`, `--background`, `--border` | All colors |
| **Radius** | Base `:root` | `--radius`, `--radius-md`, `--radius-full` | Border radius |
| **Spacing** | Base `:root` | `--spacing-md`, `--spacing-lg` | Padding/margins |
| **Shadows** | Base `:root` | `--shadow-md`, `--shadow-lg` | Box shadows |
| **Typography** | Base `:root` | `--font-size-sm`, `--font-family` | Fonts/sizes |

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Defining radius in theme sections
```css
/* WRONG - Radius won't work in dark mode */
:root[data-theme="light"] { --radius: 0.625rem; }
:root[data-theme="dark"] { --radius: 0.625rem; }

/* ✅ CORRECT - Define in base :root */
:root { --radius: 0.625rem; }
```

### ❌ Mistake 2: Hardcoding values in components
```css
/* WRONG - Won't adapt to theme changes */
.card {
  border-radius: 8px;           /* ❌ Hardcoded */
  padding: 16px;                /* ❌ Hardcoded */
  background: #ffffff;          /* ❌ Hardcoded */
}

/* ✅ CORRECT - Uses foundation tokens */
.card {
  border-radius: var(--radius-md);  /* ✅ Token */
  padding: var(--spacing-md);        /* ✅ Token */
  background: var(--card);           /* ✅ Token */
}
```

### ❌ Mistake 3: Using old literal token names
```css
/* WRONG - Old naming, less clear */
--fx-color-bg: hsl(...);
--fx-color-fg: hsl(...);
--corner-md: 0.5rem;

/* ✅ CORRECT - Semantic naming */
--background: hsl(...);
--foreground: hsl(...);
--radius-md: var(--radius);
```

---

## Example: Google Material Design in CSMA

### Step 1: foundation/tokens.css (correctly scoped)
```css
/* Base tokens - both themes */
:root {
  --fx-radius-md: 0.25rem;          /* Material uses 4px */
  --fx-space-md: 1rem;              /* 16px grid */
}

/* Light theme */
:root[data-theme="light"] {
  --fx-color-primary: #1976d2;      /* Material Blue */
  --fx-color-secondary: #f5f5f5;    /* Light gray */
  --fx-color-accent: #ff4081;       /* Pink accent */
}

/* Dark theme */
:root[data-theme="dark"] {
  --fx-color-primary: #90caf9;      /* Light blue */
  --fx-color-secondary: #424242;    /* Dark gray */
  --fx-color-accent: #ff80ab;       /* Light pink */
}
```

### Step 2: Component CSS
```css
/* Material buttons */
.button {
  border-radius: var(--fx-radius-md);     /* ✅ Material 4px */
  padding: var(--fx-space-md);           /* ✅ 16px */
  text-transform: uppercase;        /* Material style */
  letter-spacing: 0.0892857143em;   /* Material style */
  background: var(--fx-color-primary);   /* ✅ Theme-adaptive */
}
```

---

## Testing Your Customization

After each step:
1. **Run dev server**: `npm run dev`
2. **Check light theme**: Open in browser
3. **Check dark theme**: Click theme toggle
4. **Verify no square corners**: All elements should be rounded
5. **Verify no hardcoded values**: All CSS uses `var(--*)`

**If you see square corners in dark mode:**
- You defined radius in theme section instead of base `:root`
- Fix: Move `--radius-*` tokens to top-level `:root`

---

## Key Files

- **Foundation Tokens**: `src/css/foundation/tokens.css` - Global scales + aliases
- **Theme Overrides**: `src/css/foundation/themes/*.css` - Light/dark palettes
- **Globals**: `src/css/base.css` - Typography, reset, layout
- **Migration Guide**: `src/css/THEME_MIGRATION_GUIDE.md` - Detailed token mapping
- **Components**: `src/ui/components/[name]/[name].css` - Component styles

---

## Next Steps

- Read `building-components.md` for component patterns
- Read `for-llms.md` for AI-assisted coding
- See `complete-csma-guide.md` for full architecture

**Follow this order and token scoping rules and you'll build a consistent, theme-adaptive UI!** 🎯
