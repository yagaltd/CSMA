# CSMA Showcase Website - Implementation Plan

**Status:** Planned (v1.1-v1.3)  
**Purpose:** Interactive playground proving CSMA's speed, simplicity, and production readiness  
**URL Target:** `/showcase/*` (deployed to static host)

---

## Positioning: "See CSMA in Action"

The showcase is an **interactive testing ground** where developers can:
- ✅ See 100+ components update at 60fps without lag
- ✅ Upload massive files without UI freezing
- ✅ Run Lighthouse audits on real CSMA code
- ✅ Explore how modules work under the hood
- ✅ Understand CSMA/C-DAD/ECCA principles in practice
- ⚡ Compare with TanStack/React (one section, not the whole focus)

**Philosophy:** Show, don't tell. Let developers *feel* the performance difference.

---

## Core Demo Pages (Performance First)

### 1. Live Performance Lab
**URL:** `/showcase/performance`

**Interactive Tests:**
- **Component Stress Test:** Spawn 50, 100, 500 reactive components → Watch FPS counter stay at 60
- **State Management Simplicity:** Show EventBus code vs React useState + useReducer + Redux
- **CSS Reactivity Demo:** Toggle classes 60x/second → Show DevTools Performance tab (0 dropped frames)
- **Memory Test:** Create/destroy 1000 components → Track heap size (should stay flat)

**Real-time Metrics:**
- FPS counter (updates every frame)
- Component count
- EventBus events/second
- DOM update latency (time from publish to paint)
- Memory usage graph

**Code Example Display:**
```javascript
// CSMA: Simple EventBus
eventBus.publish('COUNTER_INCREMENT', { id: 'counter-1' });

// React: Boilerplate jungle
const [state, dispatch] = useReducer(counterReducer, initialState);
dispatch({ type: 'INCREMENT', id: 'counter-1' });
```

---

### 2. Non-Blocking UI Demos
**URL:** `/showcase/non-blocking`

**Interactive Side-by-Side Comparisons:**

**A) File Upload (Heavy I/O)**
- **Left:** Main thread FileReader + thumbnail generation → UI freezes visibly
- **Right:** Worker thread processing → UI stays completely responsive
- **Test:** Click "Submit" button during uploads → Left doesn't respond, Right responds instantly

**B) Heavy Computation**
- **Task:** Process 10M array operations with sorting/filtering
- **Left:** Main thread → UI freezes, progress bar doesn't update
- **Right:** WebWorker → Progress updates in real-time, "Cancel" button works

**C) Multiple Heavy Operations**
- Concurrent: File upload + image processing + data analysis
- **Test:** Try to open a modal while 3 operations run → Demo thread isolation

**Real-time Metrics:**
- Main thread blocking time (ms)
- Long task warnings (>50ms)
- UI response time (button click → visual feedback)
- FPS during operations

**Why It Matters:** Users can *feel* the difference, not just see numbers.

---

### 3. Principles in Practice
**URL:** `/showcase/principles`

**Demonstrates CSMA Core Principles:**

**6 Rules Showcase (Interactive Playground):**
1. **State Changes = CSS Classes Only**
   - Buttons to change visual states
   - No JavaScript touching element.style directly
   - Show CSS handles all rendering

2. **Define States in CSS**
   - `.todo.pending`, `.todo.completed`, `.todo[high-priority]`
   - All variations defined, JS just assigns class

3. **JavaScript Publishes Events**
   - Live EventBus inspector (like Redux DevTools)
   - See every event: `INTENT_TODO_CREATE` → `TODO_CREATED`

4. **Always Validate**
   - Try to send invalid event → See validation error
   - Show schema violations caught before publish

5. **Data Attributes for Complex State**
   - Multi-dimensional state: `data-priority`, `data-category`, `data-status`
   - Avoid class soup: `class="todo high-priority urgent work pending"`

6. **Self-Contained Components**
   - Component subscribes to its own intents
   - Demo: open dialog → component handles everything

**C-DAD/ECCA Explained:**
- **C-DAD:** Contract validation layer preventing invalid events
- **ECCA:** Type-safety without TypeScript (runtime contracts)
- Interactive demo: Try to spoof event → Rejected at validation layer

**Code Examples:**
```javascript
// Show before/after
❌ Before (Traditional): element.style.opacity = '1';
✅ After (CSMA): element.className = 'todo completed';
```

---

### 4. Modules & Services Explorer
**URL:** `/showcase/modules`

**Interactive Module Browser:**
- List all 25+ modules (Storage, Router, AI, etc.)
- Click module → See: size, dependencies, use cases, API
- **Toggle ON/OFF:** Add/remove modules, watch live bundle size update
- **Bundle Visualization:** Interactive treemap of current selection

**Live Bundle Counter:**
```
Current Bundle: 17KB (Core only)
Add Storage: +2KB → 19KB
Add AI Module: +12KB → 31KB
Add Sync Queue: +3KB → 34KB
```

**Services Deep-Dive:**
- CacheManager: See caching in action, hit/miss rates
- APIWrapper: Mock network requests, see retry logic
- DataAggregator: Combine multiple data sources
- ThreadManager: Visual thread pool, task distribution
- LogAccumulator: Analytics + monitoring (see next section)

**Module Decision Tree:**
```
Building a blog? → Storage + Search = 27KB
Building photo app? → + File System + Media = 63KB
Building SaaS? → + Form + Auth + Sync = 48KB
```

---

### 5. LogAccumulator Analytics Dashboard
**URL:** `/showcase/analytics`

**Show LogAccumulator is More Than Logs:**

**Live Event Stream:**
- Every EventBus event displayed in real-time
- Filter by: User actions, System events, Security, Analytics
- Click event → See full payload (redacted in production mode)

**Analytics Features:**
- Page view tracking (without Google Analytics)
- Feature usage metrics (which buttons users click)
- Performance metrics (slow actions detected)
- Error tracking (caught exceptions)
- Session replay (event timeline)

**Web Analytics Without Third Parties:**
```javascript
// Automatic tracking:
LOGUX: User created todo (id: todo-123, time: 15ms)
ANALYTICS: Page view (/dashboard, duration: 45s)
SECURITY: Rate limit triggered (user: abc123, action: INTENT_TODO_CREATE)
PERFORMANCE: Slow event detected (TODO_CREATED took 120ms)
```

**Export Capabilities:**
- Download JSON of session logs
- Analytics dashboard (counts, averages, trends)
- Generate reports for stakeholders

**Privacy-First:**
- No data leaves browser unless configured
- GDPR compliant (no third-party scripts)
- User can opt-out, data stays local

---

### 6. Interactive Testing Tools
**URL:** `/showcase/testing`

**Let Users Run Their Own Tests:**

**A) Lighthouse Runner:**
```
Run Lighthouse on this page
Results: Performance 98, Accessibility 100, Best Practices 100, SEO 95
Bundle: 17KB gzipped (React starter: 164KB)
```

**B) Custom Component Tester:**
- Input: "I want 200 cards that update every frame"
- Click: "Generate"
- Result: Verified 60fps, memory stable

**C) Stress Configurator:**
- Sliders: Component count (10-1000), Update frequency (1-60fps)
- Toggle: Worker on/off, Caching on/off
- See: Live impact on metrics

**D) Comparison Suite:**
- Checkbox: "Show React equivalent code"
- Display: Side-by-side with CSMA version
- Metrics: LOC count, bundle size, performance

**E) Mobile Simulator:**
- Throttle CPU: 4x slowdown (simulates mid-range phone)
- Throttle Network: Slow 3G
- Show: CSMA still performs well under constraints

---

### 7. Zero-Bundle-Size DevTools
**URL:** `/showcase/devtools`

**Prove DevTools are Free in Production:**

**Live Bundle Analysis:**
```
Development Build: 23KB
- Core: 17KB
- DevTools: 6KB (loaded dynamically)
- Showcase: 0KB (loaded on demand)

Production Build: 17KB
- Core: 17KB
- DevTools: 0KB (tree-shaken)
- Showcase: 0KB (not included)
```

**DevTools Features:**
- EventBus inspector (real-time events)
- Contract validator (show validation errors)
- Performance profiler (slow events highlighted)
- State viewer (current app state)
- Log viewer (filter/search events)

**Implementation:**
```javascript
// Dynamic import in dev only
if (process.env.NODE_ENV === 'development') {
  import('./runtime/devtools/DevPanel.js').then(({initDevPanel}) => {
    initDevPanel(eventBus);
  });
}
// In production: this code is removed by bundler
```

---

### 8. TanStack Comparison (One Section, Not Focus)
**URL:** `/showcase/comparisons`

**Not the main event - just another data point:**

**Quick Stats (Not a Sales Pitch):**
```
CSMA Complete:    110KB
TanStack + React: 341KB
Savings:          67% smaller

Features:
✅ Query      (Sync Queue)
✅ Table      (Data Table)
✅ Form       (Form Manager)
✅ Router     (Router)
✅ AI Module  (TanStack doesn't have)
✅ Offline    (Sync Queue)
✅ Mobile     (Capacitor)
```

**Interactive:**
- Toggle: "Show React boilerplate" → See code complexity difference
- Click: "Bundle breakdown" → Treemap comparison
- Note: "Choose based on your needs, not marketing"

**Philosophy:** Informational, not confrontational. Let developers decide.

---

## Architecture

```
src/examples/showcase/
├── index.html              # Entry point
├── main.js                 # Initialize showcase
├── modules/
│   ├── BenchmarkRunner.js  # Performance measurement
│   ├── StressTest.js       # Component spawning logic
│   ├── FileUploadDemo.js   # Worker vs main thread
│   ├── LogAccumulatorViz.js # Analytics visualization
│   └── PrinciplesDemo.js   # 6 rules interactive
├── demo-data/
│   ├── sample-todos.json
│   ├── heavy-files/ (10MB+ test files)
│   └── stress-configs.js
└── pages/
    ├── performance.js      # Performance lab
    ├── non-blocking.js     # WebWorker demos
    ├── principles.js       # 6 rules + C-DAD/ECCA
    ├── modules.js          # Module explorer
    ├── analytics.js        # LogAccumulator demo
    ├── testing.js          # Interactive tools
    └── comparisons.js      # TanStack comparison
```

---

## Design Principles

### 1. No Custom Components (Only Existing Ones)
Showcase should use **only** the 25+ components already in CSMA:
- progress, card, badge, toast, button, switch, dialog, input, etc.

**If missing:** Component library is incomplete → Fix library, not demos

### 2. Real Code, Real Metrics
Every demo uses actual production code from:
- `src/ui/components/`
- `src/runtime/`
- `src/services/`

Not synthetic benchmarks. If it performs well in showcase, it performs well in production.

### 3. Interactive, Not Static
Users should:
- Click buttons → See immediate results
- Change parameters → See live updates
- Run tests → Get real numbers

No "trust us" - verify yourself.

### 4. Education, Not Marketing
Each demo includes:
- What it measures
- Why it matters
- How CSMA achieves it
- How users can replicate in their apps

---

## Timeline (v1.1 - v1.3)

### v1.1: Performance Foundation (4 weeks)
- Performance Lab (component spawning, FPS tracking)
- Non-blocking UI demos (File upload, heavy computation)
- Core principles visualization (6 rules)

### v1.2: Modules & Analytics (3 weeks)
- Module explorer with bundle visualization
- LogAccumulator analytics dashboard
- Interactive testing tools (Lighthouse runner)

### v1.3: Polish & Comparison (3 weeks)
- DevTools demonstration
- TanStack comparison page (informational)
- Stress test configurator

**Total:** 10 weeks post v1.0

---

## Success Metrics

### Developer Experience
- Can spawn 500 components and UI stays fluid
- Can upload 10MB file and click buttons immediately
- Can understand C-DAD/ECCA through interactive demos
- Can see bundle size change as they toggle modules
- Can run Lighthouse and get 95+ performance score

### Framework Validation
- Showcase is built entirely from existing CSMA components
- No custom components needed (proves library completeness)
- Real production code used throughout (proves quality)
- Interactive testing (proves confidence)

---

## Related Documents

- **v1.1-v1.3 Roadmap:** `../v1.1-to-v1.21-modules.md`
- **TanStack Comparison (Original):** `../../_legacy/showcase-plan-original.md`
- **Core Principles:** `../../guides/csma-in-a-nutshell.md`
- **Security:** `../../security/security-map.md`
- **Bundle Analysis:** `../../../enhancement-plan.md` (Complete feature list)

---

## Core Message

**"CSMA is fast, simple, and production-ready. Try it yourself."**

Not: "CSMA is better than TanStack."

Let developers experience the speed, explore the modules, understand the principles, and **draw their own conclusions**.
