---
name: csma-security
version: "1.0.0"
description: >-
  Expert guidance on the CSMA 6-layer security model. Covers CSP headers,
  contract validation, input sanitization, rate limiting, honeypot fields,
  schema spoofing protection, and security testing patterns. Use when building
  or auditing security-critical code in CSMA modules and services.
tags:
  - security
  - validation
  - contracts
  - csp
  - rate-limiting
  - sanitization
  - xss-prevention
related_files:
  - src/runtime/Contracts.js
  - src/runtime/EventBus.js
  - src/runtime/RateLimiter.js
  - src/runtime/validation/
  - src/config.js
---

# CSMA Security Skill
Guidance for understanding and implementing the 6-layer zero-trust security
model in the CSMA architecture.

## Security Philosophy

CSMA applies defense-in-depth: multiple independent security layers so
that no single bypass compromises the system. Every layer assumes all other
layers may have failed.

The 6 layers work together but are independently testable and replaceable.

## The 6 Security Layers

### Layer 1: CSP Headers

Content Security Policy restricts what the browser can load.

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http://localhost:5050;">
```

CSMA CSP rules:
- `default-src 'self'` -- only same-origin resources
- `script-src 'self'` -- no inline scripts, no CDN scripts
- `style-src 'self' 'unsafe-inline'` -- theme tokens require inline style access
- `img-src 'self' data:` -- data URIs for icons
- `connect-src` -- restricted to same-origin + known API endpoints

**When adding external resources**: Update the CSP meta tag in your HTML. Never weaken the default policy.

### Layer 2: Contract Validation

Every EventBus payload is validated against a schema before processing.

```javascript
import { contract } from '../../src/runtime/Contracts.js';
import { object, string, number, enums, optional, size } from '../../src/runtime/validation/index.js';

const MY_CONTRACT = contract({
  version: 1,
  type: 'intent',
  owner: 'my-module',
  description: 'User submits a form'
}, object({
  formId: string(),
  data: object({}),
  timestamp: number()
}));
```

Contracts enforce:
- Required fields must be present and correctly typed
- String length limits prevent buffer-style attacks
- Enum values prevent unexpected data injection
- Rate limits prevent event flooding

**Never bypass contract validation** -- even in internal code paths.

### Layer 3: Input Sanitization

All user input is sanitized before use.

```javascript
// CORRECT: textContent prevents XSS
element.textContent = userInput;

// WRONG: innerHTML allows script injection
element.innerHTML = userInput;
```

CSMA sanitization rules:
- Use `textContent` for all user-visible strings
- Use `dataset.*` for state -- never trust `className` for security decisions
- Trim and collapse whitespace: `text.replace(/\s+/g, ' ').trim()`
- Enforce maximum lengths on all string inputs
- Use `encodeURIComponent()` for URL parameters
- Parse and validate JSON before accessing properties

### Layer 4: Rate Limiting

The EventBus enforces rate limits per event type.

```javascript
// In Contracts.js
INTENT_MODAL_OPEN: {
  schema: object({ modalId: string() }),
  security: {
    rateLimits: {
      perSecond: 10,
      perMinute: 100
    }
  }
}
```

Rate limiting behavior:
- Events exceeding per-second limit are dropped (not queued)
- Events exceeding per-minute limit are dropped
- Rate limit counters reset at boundary
- Rate-limited events emit a `SECURITY_RATE_LIMITED` event

**Set appropriate rate limits for every user-facing event.** Background processing events can have higher limits.

### Layer 5: Honeypot Fields

Hidden form fields detect bot submissions.

```html
<form>
  <!-- Real field -->
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required>

  <!-- Honeypot: hidden from real users, visible to bots -->
  <div class="hp-field" aria-hidden="true" tabindex="-1">
    <label for="website">Website</label>
    <input id="website" name="website" tabindex="-1" autocomplete="off">
  </div>
</form>
```

```css
.hp-field {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
```

```javascript
// Validate: if honeypot is filled, reject silently
if (formData.get('website')) {
  // Bot detected -- ignore submission
  return;
}
```

**Honeypot fields must**: be invisible to humans, accessible to screen readers (with `aria-hidden`), and named attractively to bots.

### Layer 6: Schema Spoofing Protection

Prevent prototype pollution and schema manipulation attacks.

```javascript
// CSMA validation uses Object.create(null) for safe object creation
// Prevents __proto__ pollution
const safeObject = Object.create(null);
Object.assign(safeObject, userInput);

// Validation rejects dangerous keys
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
function hasDangerousKeys(obj) {
  return DANGEROUS_KEYS.some(key => key in obj);
}
```

Protection mechanisms:
- Objects created with `Object.create(null)` -- no inherited prototype
- Dangerous keys (`__proto__`, `constructor`, `prototype`) rejected in validation
- Deep freeze on validated payloads
- No `eval()` or `Function()` constructor usage

## Security Event Monitoring

CSMA emits security events for monitoring:

```javascript
eventBus.subscribe('SECURITY_VIOLATION', (payload) => {
  console.warn('[Security]', payload.type, payload.details);
});

eventBus.subscribe('SECURITY_RATE_LIMITED', (payload) => {
  console.warn('[Rate Limit]', payload.eventType, payload.count);
});
```

Security event types:
- `SECURITY_VIOLATION` -- contract validation failure
- `SECURITY_RATE_LIMITED` -- rate limit exceeded
- `SECURITY_INPUT_REJECTED` -- sanitized input rejected

## Writing Secure Modules

### Module Security Checklist

```javascript
export const manifest = {
  id: 'my-module',
  security: {
    // Declare what events this module handles
    handledEvents: ['INTENT_MY_ACTION'],
    // Declare rate limits
    rateLimits: {
      'INTENT_MY_ACTION': { perSecond: 5, perMinute: 30 }
    }
  }
};
```

For every module:
1. All events have contracts with schemas
2. All user inputs are sanitized (textContent + trim + length limit)
3. Rate limits are set on user-triggered events
4. Forms use honeypot fields where applicable
5. No `innerHTML` for user data
6. No `eval()` or dynamic code execution

## Security Testing Patterns

### Test Contract Rejection

```javascript
it('rejects malicious payloads', () => {
  const malicious = {
    title: '<script>alert("xss")</script>',
    __proto__: { polluted: true }
  };
  expect(() => handleCreate(malicious)).toThrow();
});
```

### Test Rate Limiting

```javascript
it('enforces rate limits', () => {
  const handler = vi.fn();
  eventBus.subscribe('TEST_EVENT', handler);

  // Publish within limit
  for (let i = 0; i < 10; i++) {
    eventBus.publish('TEST_EVENT', { i });
  }
  expect(handler).toHaveBeenCalledTimes(10);

  // Exceed limit
  handler.mockClear();
  eventBus.publish('TEST_EVENT', { overflow: true });
  expect(handler).toHaveBeenCalledTimes(0); // dropped
});
```

### Test Input Sanitization

```javascript
it('strips HTML from user input', () => {
  const input = '<img onerror="alert(1)" src=x>hello';
  const result = sanitize(input);
  expect(result).not.toContain('<');
  expect(result).toBe('hello');
});
```

### Test Prototype Pollution

```javascript
it('rejects __proto__ in payloads', () => {
  const payload = JSON.parse('{"__proto__":{"admin":true},"id":"valid"}');
  expect(() => validate(payload)).toThrow();
});
```

## What To Watch For
- Do not weaken CSP to add convenience -- update the allowlist instead
- Do not skip contract validation for "internal" events -- all events are validated
- Do not use `innerHTML` even for "trusted" data -- use textContent always
- Do not store secrets in localStorage -- use sessionStorage or memory only
- Do not log sensitive data (tokens, passwords, PII) -- redact before logging
- Do not disable rate limiting in production -- only in controlled testing
- Do not expose security events to user-facing UI -- log server-side only
