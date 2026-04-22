# CSMA

**CSMA** (Client-Side Microservices Architecture) is a design-token-first vanilla JS template.

Copy it, adapt the runtime, edit `src/style/design-tokens.json`, and let your coding agent compose the UI.

## What Lives Here

| Path | Purpose |
|------|---------|
| `src/runtime/` | EventBus, ServiceManager, Contracts, Router, and core utilities |
| `src/modules/` | Feature modules (AI, analytics, storage, camera, checkout, etc.) |
| `src/ui/components/` | Primitive UI building blocks — copy and extend as needed |
| `src/style/` | Canonical `design-tokens.json` + base CSS partials |
| `demo/` | Working reference demo (todo app) |
| `tooling/` | Token generator and JSON schemas |
| `docs/` | Agent skills — design, architecture, security, testing, patterns |

## Design Workflow

All visual work is driven by tokens:

1. **Chat with your agent** about the desired look and feel.
2. **Agent updates** `src/style/design-tokens.json` (DTCG format).
3. **Run** `npm run tokens` to regenerate `src/generated/tokens.css`.
4. **Agent composes** layouts and pages using the generated token values.

Never edit generated CSS directly. Always change the JSON source and regenerate.

## Quick Start

```bash
npm install
npm run tokens    # generate CSS from design tokens
npm run dev       # start Vite dev server
```

## Token System

- **Colors**: `--background`, `--surface`, `--foreground`, `--border`, `--primary`, `--secondary`, `--accent`, `--destructive`, `--success`, `--warning`, `--info`
- **Spacing**: `--space-2xs` (2px) through `--space-5xl` (96px)
- **Radius**: `--radius-sm` through `--radius-full`
- **Typography**: `--font-family-base`, `--font-family-mono`; `--font-size-xs` through `--font-size-3xl`
- **Motion**: `--transition-fast` (120ms), `--transition-normal` (200ms), `--transition-slow` (320ms)
- **Shadows**: `--shadow-xs` through `--shadow-xl`
- **Breakpoints**: `--breakpoint-sm` (480px) through `--breakpoint-xl` (1280px)

## Core Architecture

- **State changes = CSS classes only.** JavaScript publishes events; CSS handles rendering via `data-*` attributes.
- **EventBus** for pub/sub between services and UI.
- **Contracts** for payload validation and rate limiting.
- **Modules-first** — feature modules register contributions lifecycle-safely via `ModuleManager`.
- **Security-first** — CSP, input sanitization, schema validation, honeypot fields.

## Primitive Components

The template ships with a minimal starter set:

- **Badge** (Type I — pure CSS)
- **Button** (Type I — pure CSS)
- **Toast** (Type II — EventBus-driven)

Additional primitives (card, field, input, theme-toggle) exist as examples. Copy and adapt them freely.

## Agent Skills

Agent-facing documentation lives in `docs/`:

- `docs/design/SKILL.md` — token system, visual principles, layout rules, component usage
- `docs/architecture/SKILL.md` — EventBus, Contracts, component types, CSS conventions
- `docs/security/SKILL.md` — 6-layer security model, CSP, input sanitization
- `docs/testing/SKILL.md` — test conventions, contract testing, module testing
- `docs/patterns/SKILL.md` — layout recipes and spatial patterns

## License

MIT
