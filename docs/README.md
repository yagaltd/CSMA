# CSMA Kit Documentation

Welcome to the CSMA (Client-Side Microservices Architecture) Kit documentation.

The current template keeps the default UI surface intentionally small: Button, Badge, and Toast ship as starter components, while richer behavior should live in modules under `src/modules/`.

---

## Quick Start

```bash
git clone <your-repo-url> csma && cd csma
npm install
npm run dev              # http://localhost:5173 with HMR
npm run test             # vitest unit tests
bun run generate-tokens  # regenerate CSS from design-tokens.json
```

See `README.md` in the project root for full setup details.

---

## Skills (for AI Agents)

- **[Architecture](csma-architecture/SKILL.md)** - 6 rules, EventBus, contracts, tokens
- **[Patterns](csma-patterns/SKILL.md)** - Composite UI section composition
- **[Services](csma-service-pattern/SKILL.md)** - Service templates and state management
- **[Runtime](csma-runtime/SKILL.md)** - Bootstrap lifecycle, feature flags, registries, module catalog
- **[Testing](csma-testing/SKILL.md)** - Test conventions and patterns
- **[Security](csma-security/SKILL.md)** - 6-layer security model

## Examples

- **Todo App** (`examples/todo-app/`) - Full CRUD app demonstrating EventBus, Contracts, and CSS-driven reactivity

## Platforms

- **Capacitor** - See `platforms/mobile-capacitor/DEPLOYMENT.md`
- **Neutralino** - See `platforms/desktop-neutralino/DEPLOYMENT.md`

---

## Project Structure
```
src/
├── main.js                      # App entry point
├── config.js                    # Feature flags
├── bootstrap/                   # Runtime creation, features, theme
├── css/
│   ├── main.css                 # CSS entry point
│   ├── generated/tokens.css     # Auto-generated design tokens
│   ├── theme.css                # Thin legacy file
│   └── foundation/              # Utilities, motion, print, hardening
├── runtime/
│   ├── EventBus.js              # Publish/subscribe event system
│   ├── Contracts.js             # Event/intent schemas
│   ├── ModuleManager.js         # Module lifecycle
│   └── validation/              # Payload validation
├── ui/
│   ├── init.js                  # Component initialization
│   └── components/
│       ├── button/              # Type I starter (CSS only)
│       ├── badge/               # Type I starter (CSS only)
│       └── toast/               # Type II starter (CSS + JS)
├── modules/                     # Feature modules (ai, modal-system, checkout, etc.)
└── services/                    # Core services (ExampleService, FileUploadService, PlatformService)

design-tokens.json               # DTCG token source of truth
scripts/generate-tokens.js       # JSON -> CSS pipeline (requires Bun)
```
