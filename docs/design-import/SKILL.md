---
name: csma-design-import
description: Translate an external or uploaded DESIGN.md into CSMA's token, brief, pattern, and primitive model. Use when the user asks to import, translate, convert, or apply a generic DESIGN.md to this CSMA repo.
---

<!-- version: 1.0.0 | tags: design, DESIGN.md, import, translation, tokens, patterns -->

# CSMA Design Import Skill

## Purpose

Use this skill when a user provides an external `DESIGN.md` and wants it
translated into CSMA.

The uploaded file is an input brief, not a runtime source. CSMA keeps the base
token seed in `src/style/design-tokens.json`, applies project-specific changes
through `src/style/token-overrides.json`, regenerates `src/generated/tokens.css`
with `npm run tokens:patch`, and records agent-facing composition decisions in
root `DESIGN.md`.

## Import Contract

| External DESIGN.md content | CSMA destination |
|:---------------------------|:-----------------|
| YAML front matter token values | `src/style/token-overrides.json` |
| Color/type/spacing rationale | Root `DESIGN.md` `Token Usage` table |
| Visual style guidance | Root `DESIGN.md` `Visual Distinctiveness` table |
| Do's, don'ts, constraints | Root `DESIGN.md` `App Anti-Patterns` table |
| Component descriptions | Root `DESIGN.md` `Component Recipes` table and existing primitives |
| Layout descriptions | Root `DESIGN.md` `Layout Recipes` and `docs/patterns/SKILL.md` recipes |
| Interactive behavior | Type I/II decision plus EventBus/Contracts if Type II |

Never copy an uploaded `DESIGN.md` over CSMA's root `DESIGN.md` blindly. Merge
the useful intent into the CSMA template and preserve the CSMA Requirements
section.

## Required Reading

Before translating:

1. Read the uploaded/external `DESIGN.md` completely.
2. Read root `DESIGN.md`.
3. Read `docs/design/SKILL.md`.
4. Read `docs/patterns/SKILL.md`.
5. If components or interactions will be created, read `docs/architecture/SKILL.md`.

## Workflow

### Step 1: Classify The Source

Identify what the uploaded `DESIGN.md` contains.

| Source shape | Action |
|:-------------|:-------|
| YAML tokens plus markdown sections | Extract tokens and prose separately. |
| Markdown only | Infer token candidates from prose; mark assumptions. |
| Tokens only | Populate `token-overrides.json`; create minimal CSMA brief tables. |
| Style-library file with many examples | Select the relevant style only; do not import unrelated variants. |
| Conflicting instructions | Prefer CSMA architecture and ask only if the visual intent is ambiguous. |

### Step 2: Extract Token Candidates

Collect candidate values for:

- colors: background, surface, text, primary, secondary, accent, status
- typography: font families, sizes, weights, line heights, tracking
- spacing: compact/control gaps, component padding, section rhythm
- radius: field, button, card, modal, pill
- shadows/elevation: border-only, tonal surfaces, shadow scale
- themes: light, dark, contrast, and any named theme

Do not write generated CSS. All app-specific token edits go through
`src/style/token-overrides.json`.

### Step 3: Map Tokens To CSMA

Use this mapping as the default. Preserve source intent, but normalize names to
CSMA token families.

| External token names | CSMA target |
|:---------------------|:------------|
| `background`, `bg`, `canvas`, `page` | `background` |
| `backgroundMuted`, `surface-muted`, `subtleBackground` | `backgroundMuted` / muted background token |
| `surface`, `card`, `panel`, `container` | `surface` |
| `surfaceVariant`, `surfaceRaised`, `panelAlt` | `surfaceMuted` / muted surface token |
| `foreground`, `text`, `on-surface`, `textPrimary` | `foreground` |
| `muted`, `textSecondary`, `textMuted`, `caption` | `foregroundMuted` |
| `border`, `outline`, `stroke`, `divider` | `border` |
| `primary`, `brand`, `cta`, `action` | `primary` |
| `on-primary`, `primaryForeground`, `primaryText` | `primaryForeground` |
| `secondary` | `secondary` |
| `on-secondary`, `secondaryForeground` | `secondaryForeground` |
| `accent`, `highlight`, `focusAccent` | `accent` |
| `danger`, `error`, `negative`, `critical` | `destructive` |
| `success`, `positive`, `complete` | `success` |
| `warning`, `caution`, `pending` | `warning` |
| `info`, `link`, `interactive` | `info` or app-specific link rule |
| `radius`, `rounded`, `corner` | radius token scale |
| `spacing`, `space`, `gap` | spacing token scale |
| `font`, `typography`, `type` | typography token families |
| `shadow`, `elevation`, `depth` | shadow tokens or border-only elevation rule |

If the external file uses direct CSS variable names, translate intent rather
than preserving incompatible names.

### Step 4: Normalize Themes

CSMA expects theme-aware semantic tokens. If the uploaded file defines only one
theme:

| Source theme coverage | CSMA action |
|:----------------------|:------------|
| Light only | Map light values, derive dark/contrast conservatively, record assumption. |
| Dark only | Map dark values, derive light/contrast conservatively, record assumption. |
| Light + dark | Map both, derive contrast from high-contrast intent. |
| Many named themes | Import primary intended theme set only unless user asks for all. |
| No theme data | Use existing CSMA theme values and record visual intent in `DESIGN.md`. |

Contrast theme must remain readable. Do not preserve low-contrast source values
just because they were supplied.

### Step 5: Translate Prose Into CSMA Tables

Update root `DESIGN.md` instead of pasting prose wholesale.

| CSMA section | What to write |
|:-------------|:--------------|
| `Overview` | Product type, audience, emotional direction, density, references. |
| `Token Usage` | Source color/type/spacing decisions mapped to CSMA tokens. |
| `Visual Distinctiveness` | Primary moment, hierarchy layers, motif, density, container rule, interaction feel. |
| `App Anti-Patterns` | External do-not rules plus any CSMA-specific alternatives. |
| `Component Recipes` | Domain component names, existing primitives, states, Type I/II. |
| `Layout Recipes` | Recurring page structures and responsive behavior. |
| `Responsive Behavior` | Source breakpoint/collapse intent normalized to CSMA layout tokens. |
| `Spacing Relationships` | Relationship-based spacing, not isolated numeric dumps. |
| `Type I/II Decisions` | Pure CSS vs EventBus-driven behavior. |

Keep `CSMA Requirements` intact.

### Step 6: Map Components To Existing Primitives

Prefer existing primitives and layout utilities.

| External component | CSMA starting point |
|:-------------------|:--------------------|
| Button, CTA, action | `.button` variants |
| Badge, tag, chip, label pill | `.badge` |
| Card, panel, tile | `.card` |
| Input, textarea, select-like field | `.field` + `.input` |
| Form group | `.field` and `.stack` |
| Toolbar, action group | `.cluster` + `.button` |
| Grid/list collection | `.grid`, `.stack`, responsive CSS |
| Metric/stat block | `metric-panel` signature primitive recipe |
| Status accent or priority rail | `status-strip` signature primitive recipe |
| Activity feed/history | `timeline-row` signature primitive recipe |
| Search/command input | `command-bar` signature primitive recipe |
| Review/diagnostic card | `inspection-card` signature primitive recipe |
| Toast/snackbar | Existing toast if required; inline status if source forbids popups |

Create a new primitive only when the source style cannot be represented by
existing CSMA primitives plus a small app-specific class.

### Step 7: Classify Interaction Type

| Source behavior | CSMA type | Rule |
|:----------------|:----------|:-----|
| Static visual variant | Type I | CSS classes and `data-*` only. |
| Hover/focus/selected style | Type I | Use CSS selectors, ARIA, and `data-*`. |
| Toggle changes local or global state | Type II | Publish `INTENT_*`; validate payload with Contracts. |
| Async save/load/delete | Type II | Render `data-loading` or `data-state` from state transitions. |
| Notification | Type II | Use toast system or inline status according to the imported style. |
| Theme switching | Type II | Set `document.documentElement.dataset.theme`; persist outside CSS. |
| User-provided content | Type I or II | Use `textContent`, never `innerHTML`. |

All EventBus payloads need Contracts.

### Step 8: Handle Conflicts

CSMA rules win over imported assumptions.

| Imported instruction | CSMA resolution |
|:---------------------|:----------------|
| Edit CSS variables or generated CSS directly | Edit `src/style/token-overrides.json`, then run `npm run tokens:patch`. |
| Use inline styles for state | Convert to classes, ARIA, or `data-*`. |
| Use `innerHTML` for content | Use `textContent` for user data. |
| Add arbitrary framework dependency | Stay vanilla unless user explicitly approves. |
| Use raw hex colors in component CSS | Convert to tokens or semantic variables. |
| Use card sections everywhere | Apply the container rule: spacing, divider, border, then card. |
| Use inaccessible contrast | Adjust token values and record the deviation. |
| Use multiple competing motifs | Pick one signature motif and record it. |
| Component needs behavior but no event model is supplied | Classify Type II and define intent/state events. |

If a conflict changes the visual meaning substantially, state the assumption in
the final answer.

### Step 9: Generate Tokens And Verify

After editing `src/style/token-overrides.json`:

```bash
npm run tokens:patch
npm run lint:styles
```

Then inspect `/showcase/token-showcase.html` in light, dark, and contrast
themes. The showcase should reflect the imported token decisions without copying
the external `DESIGN.md` or treating front matter as runtime tokens.

Run additional checks based on blast radius:

| Change | Verification |
|:-------|:-------------|
| Tokens only | `npm run tokens:patch`, `npm run lint:styles` |
| Component CSS | `npm run lint:styles`; inspect component demos if present |
| EventBus behavior | Contract tests or focused `vitest` tests |
| Page/demo changes | Start `npm run dev`; inspect responsive and theme behavior |
| Imported visual system | Inspect `/showcase/token-showcase.html` across light, dark, and contrast |
| Security-sensitive input | `npm run security-check` plus validation tests |

## Import Report

In the final response, summarize:

1. Source file imported.
2. Token families mapped.
3. `DESIGN.md` sections updated.
4. Components mapped to existing primitives.
5. Any assumptions or conflicts.
6. Commands run and results.

## Guardrails

- Do not create generated files by hand.
- Do not copy a foreign `DESIGN.md` over CSMA root `DESIGN.md`.
- Do not add scripts or compilers unless the user explicitly asks.
- Do not introduce runtime dependencies for style translation.
- Do not invent new primitives before checking existing components and
  signature primitive recipes.
- Preserve user or unrelated worktree changes.
- Keep imported visual values tokenized and theme-compatible.
