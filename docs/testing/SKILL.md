---
name: csma-testing
description: Writing tests for CSMA using vitest, jsdom, Playwright, and fast-check. Covers contracts, lifecycle tests, property tests, observability, accessibility, and E2E smoke tests. Use when writing or extending tests under tests/.
---

<!-- version: 1.2.0 | tags: testing, vitest, fast-check, contracts, modules, accessibility, e2e -->

# CSMA Testing Skill

Guidance for writing tests in the CSMA architecture using vitest, jsdom, and Playwright.

If you are deciding **how much** testing rigor a module needs, start with
`docs/rigor/SKILL.md`. This skill explains **how** to implement the
chosen testing strategy.

## Test Stack

| Layer | Tool | Scope | Location |
|-------|------|-------|----------|
| Unit | vitest + jsdom | Contracts, services, modules | `tests/*.test.js` |
| Property | vitest + `fast-check` | Stateful invariants, generated workflows | `tests/*.property.test.js` |
| Smoke | Playwright | Browser smoke flow | `tests/browser/sw-smoke.spec.js` |
| Accessibility | vitest + jsdom + axe-core | WCAG, contrast, keyboard nav | `tests/accessibility-*.test.js` |
| Example surfaces | vitest + fs/jsdom-style assertions | Demo/reference quality checks | `tests/example-surfaces.test.js` |
| Runtime lifecycle | vitest + jsdom | Bootstrap, unload, registry behavior | `tests/runtime-*.test.js`, `tests/extension-registries.test.js` |

## Running Tests

```bash
npm run test              # Full suite (watch mode)
npm run test:contracts   # Contract validation only
npm run test:validation  # Input validation only
npm run test:browser-smoke  # Playwright browser smoke test

```

## Choosing Test Depth

- Use ordinary example-based tests for simple modules and fixed regressions.
- Add property tests when the service has:
  - many input combinations
  - derived state or totals
  - retry/queue/optimistic behavior
  - invariants that should hold across many workflows
- Add service-local transition tests when a service has a real lifecycle with
  illegal edges.

Good property-test candidates:

- checkout
- cart totals and quantity invariants
- content workflow transition edges
- import/export parsing
- optimistic sync
- sync queue
- complex persisted form flows

Poor property-test candidates:

- simple UI toggles
- presentational components
- low-state helpers

## Test Conventions

### File Naming

- One test file per module/service: `tests/[module-name].test.js`
- Wave-level module coverage may live in `tests/wave*-modules.test.js` when validating a grouped implementation plan.
- Test helpers in `tests/helpers/`
- Browser smoke specs in `tests/browser/`
- Keep runtime diagnostics tests separate from outbound analytics tests
- For frontend/backend split modules, test the frontend contract only: state, optimistic behavior, adapter boundary, teardown, and rejection of invalid payloads. Do not mock backend authority as if CSMA owned it.

### Test Structure

```javascript
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';

describe('MyModule', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    // Unsubscribe all to prevent leaks between tests
    eventBus.clear?.();
  });

  it('should publish and receive events', () => {
    const handler = vi.fn();
    eventBus.subscribe('MY_EVENT', handler);
    eventBus.publish('MY_EVENT', { value: 42 });
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });
});
```

## Contract Testing

Every event contract must be tested for both valid and invalid payloads.

```javascript
import { Contracts, contract } from '../../src/runtime/Contracts.js';
import { object, string, number } from '../../src/runtime/validation/index.js';

describe('Contracts: INTENT_TODO_CREATE', () => {
  const schema = Contracts.INTENT_TODO_CREATE;

  it('accepts valid payload', () => {
    const payload = { title: 'Test todo', timestamp: Date.now() };
    const [error] = schema.schema.validate
      ? schema.schema.validate(payload)
      : [null, payload];
    expect(error).toBeNull();
  });

  it('rejects missing required fields', () => {
    const [error] = schema.schema.validate
      ? schema.schema.validate({})
      : [new Error('missing'), null];
    expect(error).toBeTruthy();
  });

  it('rejects wrong types', () => {
    const [error] = schema.schema.validate
      ? schema.schema.validate({ title: 123, timestamp: 'bad' })
      : [new Error('type'), null];
    expect(error).toBeTruthy();
  });
});
```

### Contract Test Checklist

For each contract, verify:
1. Accepts a valid, complete payload
2. Rejects missing required fields
3. Rejects wrong field types
4. Rejects out-of-range values (too long, too short, negative)
5. Ignores optional fields when absent
6. Validates optional fields when present

## Module Testing
Test the full module lifecycle: load -> contribute -> unload -> cleanup.

```javascript
import { ModuleManager } from '../../src/runtime/ModuleManager.js';

describe('ExampleModule', () => {
  let manager;

  beforeEach(() => {
    manager = new ModuleManager(eventBus);
  });

  afterEach(() => {
    manager.destroy();
  });

  it('loads module and registers contributions', () => {
    manager.load(exampleModule);
    const commands = manager.registries.commands.getAll();
    expect(commands).toHaveLength.greaterThan(0);
  });

  it('unloads module and removes contributions', () => {
    manager.load(exampleModule);
    manager.unload('example-module');
    const commands = manager.registries.commands.getAll();
    expect(commands).toHaveLength(0);
  });

  it('validates manifest on load', () => {
    const badModule = { /* missing id */ };
    expect(() => manager.load(badModule)).toThrow();
  });
});
```

### Module Test Checklist
1. Loads with valid manifest
2. Rejects invalid manifest (missing id, name, or version)
3. Registers all declared contributions on load
4. Removes all contributions on unload
5. Service cleanup called on unload
6. No leftover listeners after unload

## Service Lifecycle Testing
Every service must clean up: listeners, state, timers, observers.

```javascript
describe('MyService', () => {
  let service;

  beforeEach(() => {
    service = new MyService(eventBus);
  });

  afterEach(() => {
    service.cleanup();
  });

  it('unsubscribes from all events on cleanup', () => {
    const handler = vi.fn();
    eventBus.subscribe('MY_EVENT', handler);
    service.cleanup();
    eventBus.publish('MY_EVENT', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('clears state on cleanup', () => {
    service.state.set('key', 'value');
    service.cleanup();
    expect(service.state.size).toBe(0);
  });
});
```

Observability lifecycle rule:
- `LogAccumulator` cleanup must release listeners/observers without touching analytics service state
- `AnalyticsService` cleanup must stop timers/flush loops without mutating local diagnostics

## Property Testing

Use `fast-check` inside Vitest for modules where invariants matter more than
single examples.

Pattern:

```javascript
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Checkout property tests', () => {
  it('preserves totals across generated workflows', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.commands(commandArbitraries, { maxCommands: 30 }),
        async (commands) => {
          await fc.asyncModelRun(() => createHarness(), commands);
        }
      ),
      {
        seed: 20260413,
        numRuns: 150,
        endOnFailure: true
      }
    );
  });
});
```

Recommended rules:

- keep seeds fixed for reproducibility
- keep run counts moderate
- test invariants, not snapshots of incidental behavior
- prefer a small explicit model over introspecting production state too loosely
- start with manual arbitraries before trying metadata-driven generation

### Property Test Checklist

1. Generated inputs stay within meaningful business ranges
2. Invariants are asserted after every command
3. Failures shrink to short actionable sequences
4. The model stays simpler than the service under test
5. The property test replaces repetitive edge-case tests rather than duplicating them

## EventBus Testing

```javascript
describe('EventBus', () => {
  it('supports subscribe/publish cycle', () => {
    const received = [];
    eventBus.subscribe('TEST_EVENT', (payload) => received.push(payload));
    eventBus.publish('TEST_EVENT', { id: 1 });
    expect(received).toHaveLength(1);
  });

  it('returns unsubscribe function', () => {
    const handler = vi.fn();
    const unsub = eventBus.subscribe('TEST_EVENT', handler);
    unsub();
    eventBus.publish('TEST_EVENT', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('validates against contract when contracts are set', () => {
    eventBus.contracts = { TEST_EVENT: { schema: object({ id: string() }) } };
    const violations = [];
    eventBus.subscribe('CONTRACT_VIOLATION', (payload) => violations.push(payload));
    eventBus.publish('TEST_EVENT', { id: 123 });
    expect(violations).toHaveLength(1);
  });
});
```

## Observability Testing

The repo now has a strict split between local diagnostics and outbound
analytics. Test them separately.

### Local diagnostics

Use:
- `tests/error-handling.test.js`
- `tests/runtime-bootstrap.test.js`
- `tests/runtime-lifecycle.test.js`

Verify:
1. `LogAccumulator` keeps only local logging APIs
2. contract violations and security events are recorded locally
3. runtime diagnostics remain exposed through `window.csma.diagnose()`
4. diagnostic export flows use structured snapshot/output APIs

### Outbound analytics

Use:
- `tests/consent-service.test.js`
- `tests/consent-ui.test.js`
- `tests/runtime-bootstrap.test.js`
- `tests/contracts.test.js`

Verify:
1. page views and custom events are handled by `AnalyticsService`, not `LogAccumulator`
2. critical telemetry can bypass normal batch timing
3. aggregation/classification/security-scan paths are exercised directly
4. runtime exposes analytics, consent, and `seoAudit()` on `window.csma` when enabled
5. consent gates outbound categories only
6. disabling consent does not suppress local diagnostic logs

### Snapshot and contract expectations

When snapshot or telemetry shapes change:
- add explicit assertions for the new fields
- avoid broad `toMatchObject` assertions that hide schema drift
- test both runtime-facing shape and emitted analytics payload shape if they differ

For analytics contracts, always cover:
1. valid payload with optional `seo`
2. invalid nested `seo` field types
3. local contract-violation visibility through `LogAccumulator`

## Accessibility Testing
Use `axe-core` via vitest + jsdom for automated a11y checks.

```javascript
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

describe('Accessibility: Button', () => {
  it('has no axe violations', async () => {
    // Render component
    const button = document.createElement('button');
    button.className = 'button';
    button.textContent = 'Click';
    document.body.replaceChildren(button);
    const results = await axe.run(document.body);
    expect(results.violations).toHaveLength(0);
  });
});
```

Key checks:
- Color contrast ratios (WCAG AA minimum 4.5:1)
- Focus management (tab order, focus trapping in dialogs)
- ARIA attributes (roles, labels, states)
- Keyboard navigation (Enter, Escape, arrow keys)
- Touch target sizes (minimum 44px)



## What To Watch For
- Do not skip `afterEach` cleanup -- every test must clean up its EventBus, services, and DOM
- Do not test implementation details -- test behavior, not private methods
- Do not rely on timing -- use vi.mock and event-driven assertions instead of timeouts
- Do not forget to test both valid and invalid inputs for every contract
- Do not test only the happy path -- cover error states, empty states, and edge cases
