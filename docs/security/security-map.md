# CSMA Security Architecture Map

> **🤖 AI Agent Notice**: This file defines the security boundaries and requirements for this CSMA project. ALL code changes must respect these policies.

---

## 1. Input Validation (MANDATORY)

### Rule: ALL user input MUST be validated

**Contract Validation**:
```javascript
// ✅ CORRECT: Use validation schemas
import { object, string, size } from './runtime/validation/index.js';

const schema = object({
    text: size(string(), 1, 16000)  // Max length enforced
});
```

**UI Input Sanitization**:
```javascript
// ✅ CORRECT: Use textContent, not innerHTML
element.textContent = userInput;

// ❌ NEVER: Direct innerHTML with user data
element.innerHTML = userInput;  // XSS VULNERABILITY!
```

**CSS Class Names from User Data**:
```javascript
// ✅ CORRECT: Validate against whitelist
import { sanitizeClassName } from './utils/sanitize.js';

const ALLOWED_CLASSES = new Set(['pending', 'completed', 'failed']);
element.className = sanitizeClassName(userStatus, ALLOWED_CLASSES);

// ❌ NEVER: Direct assignment
element.className = userInput;  // CSS INJECTION RISK!
```

---

## 2. CSP Headers (STRICT)

**Policy**: NO inline styles or scripts

```html
<!-- index.html - MUST NOT include 'unsafe-inline' -->
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self';
    style-src 'self';  <!-- NO 'unsafe-inline'! -->
">
```

**Required Actions**:
- ✅ All styles MUST be in external `.css` files
- ❌ NO `<style>` tags in HTML
- ❌ NO `style="..."` attributes
- ❌ NO `javascript:` URLs

---

## 3. Rate Limiting (ALL user intents)

**Rule**: Every user-triggered event MUST have rate limits

```javascript
// src/runtime/Contracts.js
export const INTENT_SUBMIT_FORM = {
    security: {
        rateLimits: {
            perUser: { requests: 10, window: 60000 }  // REQUIRED
        }
    },
    schema: object({ /* ... */ })
};
```

**Implementation**:
- ✅ Use `RateLimiter.js` (in-memory Map)
- ❌ DO NOT use localStorage (bypassable)
- ⚠️  Client-side only - for production with backend, implement server-side rate limiting

---

## 4. LLM Security (5-Layer Defense)

**If using LLM integration, implement ALL layers**:

1. **Input Sanitization**: Use `sanitizeLLMInput()` from `utils/sanitize.js`
2. **System Prompt Isolation**: Separate system/user prompts
3. **Output Validation**: Strict validation schemas
4. **Honeypot Detection**: Check for removed patterns
5. **Rate Limiting**: Max 5-10 requests/min

```javascript
// ✅ CORRECT: Multi-layer validation
import { sanitizeLLMInput } from './utils/ sanitize.js';
import { llmInput } from './runtime/validation/validators/security.js';

const userPrompt = sanitizeLLMInput(rawInput);
validate(userPrompt, llmInput());  // Throws if injection detected
```

---

## 5. File Organization Rules

**Allowed Edits by AI**:
- ✅ `src/services/` - Service implementations
- ✅ `src/ui/` - UI components
- ✅ `src/css/` - Stylesheets
- ✅ `src/modules/` - Optional feature modules

**Protected Files (Human Review Required)**:
- ⚠️  `src/runtime/EventBus.js` - Core security layer
- ⚠️  `src/runtime/Contracts.js` - Contract definitions
- ⚠️  `src/utils/sanitize.js` - Security utilities
- ⚠️  `index.html` - CSP headers

**Forbidden Operations by AI**:
- ❌ Removing validation schemas
- ❌ Adding `'unsafe-inline'` to CSP
- ❌ Using `innerHTML` with user data
- ❌ Bypassing rate limiting
- ❌ Removing security validators

---

## 6. Automated Checks

Run before every commit:

```bash
npm run security-check  # Runs scripts/check-security.js
```

**What it checks**:
- ✅ CSP headers (no `'unsafe-inline'`)
- ✅ Contract validation (validation library usage)
- ✅ Rate limiting (RateLimiter, not localStorage)
- ✅ Schema spoofing protection
- ✅ Sanitization functions exist

---

## 7. Security Violation Responses

**ALL security violations MUST**:
1. Publish `SECURITY_VIOLATION` event
2. Log to LogAccumulator
3. Reject the operation (throw error)
4. NOT expose error details to user

```javascript
// ✅ CORRECT
eventBus.publish('SECURITY_VIOLATION', {
    type: 'rate-limit',
    eventName,
    timestamp: Date.now()
});
throw new Error('Rate limit exceeded');  // Generic message

// ❌ NEVER expose internals
throw new Error(`Internal validation failed: ${details}`);
```

---

## 8. LLM Coding Assistant Instructions

**When generating code:**

1. **Check existing contracts** in `src/runtime/Contracts.js`
2. **ALL new events need validation schemas**
3. **User inputs need** `size()` and `enums()` validators
4. **Use `textContent`**, never `innerHTML` for user data
5. **Add rate limits** to user intents
6. **Run `npm run security-check`** after changes

**Example: Creating a new feature**

```javascript
// STEP 1: Add contract
export const INTENT_NEW_FEATURE = {
    security: {
        rateLimits: {
            perUser: { requests: 5, window: 60000 }
        }
    },
    schema: object({
        title: size(string(), 1, 200),
        description: optional(string())
    })
};

// STEP 2: Implement service
class NewFeatureService {
    handleIntent(payload) {
        // Input is already validated by EventBus
        const  sanitized = sanitizeHTML(payload.description);
        // ... safe to use
    }
}

// STEP 3: UI component
// ✅ CORRECT
element.textContent = note.title;

// ❌ NEVER
element.innerHTML = note.title;
```

---

## 9. Schema Spoofing Protection

**EventBus automatically checks for**:
- Prototype pollution (`__proto__`)
- Constructor manipulation
- Unknown fields (warns in console)

**What this means for you**:
- ✅ Payloads MUST be plain objects
- ❌ NO class instances as event payloads
- ❌ NO adding extra fields not in schema

---

## 10. Deprecation Workflow

**When deprecating contracts**:

```javascript
// STEP 1: Add to DeprecatedEvents
export const DeprecatedEvents = new Set([
    'OLD_EVENT_NAME'
]);

// STEP 2: Add lifecycle metadata
export const OLD_EVENT_NAME = {
    lifecycle: 'deprecated',
    deprecation: {
        since: '2024-12-01',
        removeBy: '2025-03-01',
        reason: 'Security vulnerability fixed in v2',
        replacement: 'NEW_EVENT_NAME',
        migrationGuide: 'Simply rename, payload is identical'
    },
    schema: object({ /* ... */ })
};
```

EventBus will automatically warn in console when deprecated events are published.

---

## Security Checklist for AI Code Generation

Before submitting any code:

- [ ] All user inputs validated with validation schemas
- [ ] No `innerHTML` used with user data
- [  ] No `'unsafe-inline'` in CSP
- [ ] Rate limits defined for user intents
- [ ] Security validators used for LLM inputs (if applicable)
- [ ] No localStorage used for rate limiting
- [ ] `npm run security-check` passes
- [ ] No prototype pollution vulnerabilities
- [ ] All events have contracts

---

## Emergency: If You Break Security

If you accidentally introduce a security vulnerability:

1. **RUN**: `npm run security-check` - it will catch most issues
2. **CHECK**: Browser console for CSP violations
3. **REVERT**: Your changes if checks fail
4. **CONSULT**: This document for correct patterns
5. **TEST**: With malicious inputs before submitting

---

**Remember**: Security is NOT optional. Every omitted validation is a potential exploit.

**Questions?** Review:
- `VALIDATION.md` - Validator usage
- `THE_complete-csma-guide.md` - Security layers
- `implementation_plan.md` - Security enhancements
