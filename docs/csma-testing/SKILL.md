---
name: csma-testing
version: "1.1.0"
description: >-
  Expert guidance on writing tests for the CSMA architecture. Covers test conventions,
  contract and module testing, service lifecycle testing, observability testing,
  accessibility testing, and E2E smoke testing. Use when writing or extending
  tests under tests/.
tags:
  - testing
  - vitest
  - contracts
  - modules
  - accessibility
  - e2e
related_files:
  - tests/
  - vitest.config.js
  - src/runtime/Contracts.js
  - src/runtime/EventBus.js
  - src/runtime/ModuleManager.js
  - src/runtime/LogAccumulator.js
  - src/modules/analytics/services/AnalyticsService.js
---

# CSMA Testing Skill

Guidance for writing tests in the CSMA architecture using vitest, jsdom, and Playwright.

## Test Stack

| Layer | Tool | Scope | Location |
|-------|------|-------|----------|
| Unit | vitest + jsdom | Contracts, services, modules | `tests/*.test.js` |
| Smoke | vitest + jsdom | Todo-app CRUD flow | `tests/todo-app.smoke.test.js` |
| Accessibility | vitest + jsdom + axe-core | WCAG, contrast, keyboard nav | `tests/accessibility-*.test.js` |
| E2E | Playwright | Full browser flows | `tests/e2e/` |
| Performance | vitest | Bundle size budget | `tests/perf-budget.test.js` |

## Running Tests

```bash
npm run test              # Full suite (watch mode)
npm run test:contracts   # Contract validation only
npm run test:validation  # Input validation only
npm run test:smoke       # Todo-app smoke test
npm run test:e2e        # Full E2E (requires build first)
```

## Test Conventions

### File Naming

- One test file per module/service: `tests/[module-name].test.js`
- Test helpers in `tests/helpers/`
- E2E specs in `tests/e2e/`
- Keep runtime diagnostics tests separate from outbound analytics tests

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
    expect(() => eventBus.publish('TEST_EVENT', { id: 123 })).toThrow();
  });
});
```

## Observability Testing

The repo now has a strict split between local diagnostics and outbound
analytics. Test them separately.

### Local diagnostics

Use:
- `tests/log-accumulator.test.js`
- `tests/error-boundary.test.js`
- `tests/devpanel.test.js`
- `tests/diagnostic-snapshot.test.js`

Verify:
1. `LogAccumulator` keeps only local logging APIs
2. contract violations and security events are recorded locally
3. `ErrorBoundary` behavior is sanitized and environment-aware
4. diagnostic export and copy flows call `diagnosticSnapshot()`

### Outbound analytics

Use:
- `tests/analytics-service.test.js`
- `tests/analytics-module.test.js`
- `tests/seo-audit.test.js`
- `tests/consent-service.test.js`
- `tests/analytics-consent-ui.test.js`

Verify:
1. page views and custom events are handled by `AnalyticsService`, not `LogAccumulator`
2. critical telemetry can bypass normal batch timing
3. aggregation/classification/security-scan paths are exercised directly
4. page-view payloads include SEO audit data when expected
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
    document.body.innerHTML = '<button class="button">Click</button>';
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

## E2E Testing
Playwright tests run against a built app.

```javascript
// playwright.shared.config.js
import { test } from '@playwright/test';

test('todo-app: full CRUD flow', async ({ page }) => {
  await page.goto('http://localhost:4173/examples/todo-app/index.html');

  // Create
  await page.fill('[name="title"]', 'My first todo');
  await page.click('button[type="submit"]');

  // Verify
  await expect(page.locator('.todo-item')).toBeVisible();
});
```

E2E tests require:
```bash
npm run build && npm run test:e2e
```

## What To Watch For
- Do not skip `afterEach` cleanup -- every test must clean up its EventBus, services, and DOM
- Do not test implementation details -- test behavior, not private methods
- Do not rely on timing -- use vi.mock and event-driven assertions instead of timeouts
- Do not forget to test both valid and invalid inputs for every contract
- Do not test only the happy path -- cover error states, empty states, and edge cases
