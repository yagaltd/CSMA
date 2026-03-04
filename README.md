# CSMA Kit

A lean, secure, and reactive application kit using the CSMA (Client-Side Microservices Architecture) pattern.

## Features

✅ **Zero frameworks** - Pure vanilla JavaScript<br>
✅ **17KB gzipped** - Minimal bundle size<br>
✅ **CSS-class reactivity** - 10x faster than manual DOM manipulation<br>
✅ **Zero-trust security** - CSP, contracts, sanitization, honeypot, rate limiting<br>
✅ **Type-safe EventBus** - Contract-validated pub/sub<br>
✅ **Homemade analytics** - LogAccumulator with CSS tracking  
✅ **SEO-ready** - MetaManager for meta tags<br>
✅ **Dark mode** - Theme switching via CSS custom properties<br>  

## Quick Start

### Use Without CLI (Current Recommended Path)

Use this repository directly:

```bash
npm install
npm run dev
```

### Use With CLI (When `csma-ssma-cli` is available)

Scaffold first, then run inside generated project:

```bash
csma-ssma
cd <your-project>
npm install
npm run dev
```

## Template IDs (CLI Source of Truth)

The CLI should discover templates from `templates/*/template.manifest.json`.

- `csma-base-web`: base CSMA web scaffold
- `csma-web-plus-ssma-client`: CSMA web scaffold preconfigured for SSMA sync use cases

Validate template metadata:

```bash
npm run validate:templates
```

## AI System Map (`ai-system-map.json`)

`ai-system-map.json` is a machine-readable snapshot of the CSMA runtime structure intended for automation and AI/code agents.

- Location: `ai-system-map.json` at repository root
- Generator script: `scripts/generate-ai-map.js`
- Script command: `npm run generate-map`
- Auto refresh: runs during `npm install` via `postinstall`

Regenerate manually whenever contracts, modules, or runtime layout changes:

```bash
npm run generate-map
```

Reference docs: [`docs/operations/ai-system-map.md`](docs/operations/ai-system-map.md)

## Repository Policy

This repository is template-first source.

- Keep source files, docs source, and minimal examples.
- Do not commit generated outputs:
  - `dist/`
  - `platforms/desktop-neutralino/resources/assets/`
  - `platforms/mobile-capacitor/www/assets/`

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your API keys (if using LLM features)
# VITE_OPENAI_API_KEY=your_key_here
```

### 2. Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test
```

## Project Structure

```
CSMA/
├── index.html              # Entry point with CSP headers
├── package.json
├── vite.config.js
├── src/
│   ├── main.js             # Application bootstrap
│   ├── runtime/            # Core CSMA runtime (~12KB)
│   │   ├── EventBus.js
│   │   ├── ServiceManager.js
│   │   ├── Contracts.js
│   │   ├── MetaManager.js
│   │   └── LogAccumulator.js
│   ├── services/           # Business logic services
│   │   └── ExampleService.js
│   ├── ui/                 # UI Components & Patterns
│   │   ├── components/     # Atomic Components
│   │   │   └── button/
│   │   └── patterns/       # Composite UI Patterns
│   │       └── sidebar/
│   ├── css/                # Styling
│   │   ├── foundation/     # Tokens, themes, utilities
│   │   │   ├── tokens.css
│   │   │   ├── themes/
│   │   │   └── components/
│   │   └── base.css        # Reset & Utilities
│   └── utils/              # Utilities
│       └── sanitize.js     # Security helpers
└── tests/                  # Tests
    └── contracts.test.js
```

## 📚 Documentation Map

**New Guide Structure**: Consolidated from 6 docs to 4 clear guides

| Goal | Read This | Purpose |
| :--- | :--- | :--- |
| **Quick overview (5 min)** | [`csma-in-a-nutshell.md`](docs/guides/csma-in-a-nutshell.md) | 6 rules, 3 patterns, one-pager |
| **Build components manually** | [`building-components.md`](docs/guides/building-components.md) | Step-by-step + patterns + examples |
| **Use LLM to generate code** | [`for-llms.md`](docs/guides/for-llms.md) | System prompt + workflows + checklist |
| **Deep dive (comprehensive)** | [`complete-csma-guide.md`](docs/complete-csma-guide.md) | Full architecture reference |

**Consolidated**: Merged `LLM_WORKFLOWS.md`, `LLM_INSTRUCTIONS.md`, `BUILDING_COMPONENTS.md`, `UI_INIT_PATTERNS.md` into clear, focused guides

## Architecture

### CSMA Pattern

Services communicate via EventBus with contract validation:

```javascript
// Publish event
eventBus.publish('ITEM_SAVED', {
  id: '123',
  title: 'Example',
  status: 'pending',
  timestamp: Date.now()
});

// Subscribe to event
eventBus.subscribe('ITEM_SAVED', (item) => {
  console.log('Item saved:', item);
});
```

### CSS-Class Reactivity

State changes update CSS classes, CSS handles all visual changes:

```javascript
// Change state - just update className
element.className = 'card completed high-priority';
```

```css
/* CSS defines all states */
.card.completed { opacity: 1; border-left: 4px solid green; }
.card.pending { opacity: 0.7; border-left: 4px solid orange; }
.card.high-priority { box-shadow: var(--shadow-lg); }
```

**10x faster** than manual DOM manipulation!

### Security

- ✅ CSP headers in `index.html`
- ✅ Contract validation with CSMA validation library
- ✅ Input sanitization (`sanitize.js`)
- ✅ XSS prevention (`textContent` only)
- ✅ Honeypot spam protection
- ✅ Rate limiting

## Customization

### Theme Colors

Edit CSS custom properties in `src/css/foundation/tokens.css` (shared scales) and `src/css/foundation/themes/{light,dark}.css` (palette overrides):

```css
:root {
  --fx-color-primary: #3b82f6;    /* Change primary color */
  --fx-color-success: #10b981;     /* Change success color */
  --spacing-md: 16px;           /* Change spacing */
  /* ... */
}
```

### Add New Service

1. Create service in `src/services/`:

```javascript
export class MyService {
  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }
  
  init() {
    this.eventBus.subscribe('MY_EVENT', this.handleEvent.bind(this));
  }
  
  handleEvent(data) {
    // Handle event
  }
}
```

2. Register in `src/main.js`:

```javascript
import { MyService } from './services/MyService.js';
serviceManager.register('my-service', new MyService());
```

3. Define contract in `src/runtime/Contracts.js`:

```javascript
MY_EVENT: {
  schema: object({
    id: string(),
    data: string()
  })
}
```

## Analytics

Access analytics data:

```javascript
// In browser console
window.csma.exportAnalytics();
```

View logs in localStorage:

```javascript
localStorage.getItem('analytics');
```

## Platform Targets

Supported targets in this template:

- Mobile: Capacitor
- Desktop: Neutralino

Platform build scripts package the main CSMA app (`index.html` + `src/main.js`) from `dist/`, not `examples/todo-app`.

### Mobile (Capacitor)

Deploy as native iOS/Android app:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "CSMA App" com.example.csma
npx cap add android
npx cap add ios

# Build and copy
npm run build
npx cap copy

# Open in native IDE
npx cap open android
npx cap open ios
```

### Desktop - Lightweight (Neutralino)

Deploy as lightweight desktop app (webview only):

```bash
npm install -g @neutralinojs/neu
neu create myapp
# Copy dist/ to resources/
neu run
neu build
```

See `docs/complete-csma-guide.md` Section 11 for detailed platform strategy.

### PWA (Progressive Web App)

**Note**: PWA icons must be generated before installation works.

```bash
# Quick setup - generate icons from logo
npx pwa-asset-generator public/logo.png public/icons --icon-only
```

See `docs/guides/pwa-setup.md` for complete PWA setup instructions.

---

## License

MIT

## Learn More

See `docs/complete-csma-guide.md` for comprehensive documentation.
