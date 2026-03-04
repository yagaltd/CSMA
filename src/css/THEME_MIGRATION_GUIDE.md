# CSMA Theme Migration Guide

## Overview

CSMA has migrated from literal color naming (`--fx-color-bg`) to **semantic naming** (`--background`) based on shadcn/ui's proven convention. This makes the theme system clearer and more maintainable.

## Key Changes

### New Token Structure

**Before:**
```css
--fx-color-primary: hsl(222.2 47.4% 11.2%);
--fx-color-bg: hsl(0 0% 100%);
--fx-color-fg: hsl(222.2 84% 4.9%);
```

**After:**
```css
--primary: hsl(222.2 47.4% 11.2%);
--primary-foreground: hsl(210 40% 98%);
--background: hsl(0 0% 100%);
--foreground: hsl(222.2 84% 4.9%);
```

## Semantic Tokens Explained

| Token | Usage Example | Old Equivalent |
|-------|--------------|----------------|
| `--background` | Page background | `--fx-color-bg` |
| `--foreground` | Primary text | `--fx-color-fg` |
| `--primary` | Brand color, CTAs | `--fx-color-primary` |
| `--primary-foreground` | Text on primary | `--fx-color-on-primary` |
| `--secondary` | Subtle surfaces | `--fx-color-accent` |
| `--secondary-foreground` | Text on secondary | (new) |
| `--accent` | Hover states | `--fx-color-surface-muted` |
| `--muted` | Muted backgrounds | `--fx-color-bg-muted` |
| `--border` | Borders | `--fx-color-border` |
| `--ring` | Focus rings | `--fx-color-primary` |

## Migration Strategy

### Phase 1: Automatic (Current)
All components continue working via backward compatibility mapping at the bottom of `src/css/foundation/tokens.css`:

```css
--fx-color-primary: var(--primary);
--fx-color-bg: var(--background);
/* ... etc */
```

### Phase 2: Gradual Migration
Update components one at a time. Example for navbar:

```css
/* Old */
.navbar {
    background: var(--fx-color-bg);
    color: var(--fx-color-fg);
}

/* New - Semantic */
.navbar {
    background: var(--background);
    color: var(--foreground);
}

/* Nav link */
.navbar-link {
    color: var(--muted-foreground);  /* Was: color-text-secondary */
}
.navbar-link:hover {
    background: var(--accent);        /* Was: color-bg-secondary */
    color: var(--primary);            /* Was: color-primary */
}
```

### Phase 3: Remove Legacy (Future)
After all components migrated, remove the backward compatibility section.

## Benefits

1. **Clarity**: `var(--background)` vs `var(--fx-color-bg)` - immediately obvious
2. **Consistency**: Matches shadcn/ui, a proven design system
3. **Flexibility**: Easier to customize themes without breaking components
4. **Modern**: Uses current best practices for design tokens
5. **Maintainable**: New developers understand the system faster

## Testing

To verify the theme works:

```bash
npm run dev
```

Open browser dev tools and toggle `data-theme` attribute on `<html>` element between `"light"` and `"dark"`.

## Next Steps

1. Update component demos to showcase semantic tokens
2. Gradually migrate component libraries
3. Update documentation and design tokens
4. Eventually remove backward compatibility layer

## References

- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- Original CSMA theme structure in `COMPLETE_CSMA_GUIDE.md`
