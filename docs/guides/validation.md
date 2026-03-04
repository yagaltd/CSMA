# CSMA Validation Library Guide

## Overview

The CSMA starter template includes a **homemade validation library** forked from Superstruct v2.0.2 and enhanced with CSMA-specific features. This library provides runtime contract validation with zero external dependencies.

## Why Homemade?

- ✅ **Zero dependencies** - No external packages
- ✅ **Full control** - Can add CSMA-specific features
- ✅ **Smaller bundle** - ~4KB gzipped (tree-shakeable)
- ✅ **Security-first** - Prompt injection detection, XSS prevention built-in
- ✅ **ECCA integration** - Native support for contract metadata

---

## Directory Structure

```
src/runtime/validation/
├── index.js                    # Main exports
├── struct.js                   # Core Struct class
├── error.js                    # StructError class
├── utils.js                    # Validation engine
├── contract.js                 # CSMA contract() helper
├── types/
│   ├── primitives.js           # Basic types (string, number, etc.)
│   └── refinements.js          # Constraints (size, pattern, etc.)
└── validators/
    ├── semantic.js             # Domain validators (email, url, uuid)
    └── security.js             # Security validators (llmInput, sanitizedHTML)
```

---

## Core API

### Basic Validation

```javascript
import { string, number, object } from './runtime/validation/index.js';

const PersonSchema = object({
    name: string(),
    age: number()
});

// Validate
const [error, validated] = PersonSchema.validate({ name: 'John', age: 30 });
if (error) {
    console.error('Validation failed:', error.message);
} else {
    console.log('Valid:', validated);
}

// Assert (throws on failure)
PersonSchema.assert({ name: 'John', age: 30 });

// Boolean check
if (PersonSchema.is(data)) {
    // Data is valid
}
```

---

## Primitive Types

### `string()`
Validates string values.

```javascript
const NameSchema = string();
NameSchema.validate('hello'); // ✅ PASS
NameSchema.validate(123);     // ❌ FAIL
```

### `number()`
Validates numeric values (excluding NaN).

```javascript
const AgeSchema = number();
AgeSchema.validate(25);   // ✅ PASS
AgeSchema.validate(NaN);  // ❌ FAIL
```

### `boolean()`
Validates boolean values.

```javascript
const FlagSchema = boolean();
FlagSchema.validate(true);    // ✅ PASS
FlagSchema.validate('true');  // ❌ FAIL
```

### `enums(values)`
Validates against an array of allowed values.

```javascript
const StatusSchema = enums(['pending', 'completed', 'failed']);
StatusSchema.validate('pending');    // ✅ PASS
StatusSchema.validate('invalid');    // ❌ FAIL
```

### `array(ElementSchema)`
Validates arrays with typed elements.

```javascript
const TagsSchema = array(string());
TagsSchema.validate(['tag1', 'tag2']); // ✅ PASS
TagsSchema.validate(['tag', 123]);     // ❌ FAIL
```

### `object(schema)`
Validates objects with defined properties.

```javascript
const UserSchema = object({
    id: string(),
    email: string(),
    role: enums(['admin', 'user'])
});
```

### `optional(schema)`
Allows undefined values.

```javascript
const ConfigSchema = object({
    name: string(),
    description: optional(string())  // Can be undefined
});
```

### `nullable(schema)`
Allows null values.

```javascript
const ResultSchema = nullable(string());
ResultSchema.validate(null);    // ✅ PASS
ResultSchema.validate('text');  // ✅ PASS
```

---

## Refinements

### `size(schema, min, max)`
Enforces length/size constraints on strings, arrays, Maps, or Sets.

```javascript
const TitleSchema = size(string(), 1, 200);
TitleSchema.validate('Hello');        // ✅ PASS
TitleSchema.validate('');             // ❌ FAIL (too short)
TitleSchema.validate('a'.repeat(201)); // ❌ FAIL (too long)
```

### `pattern(schema, regexp)`
Validates strings against a regular expression.

```javascript
const UsernameSchema = pattern(string(), /^[a-z0-9_]+$/);
UsernameSchema.validate('john_doe'); // ✅ PASS
UsernameSchema.validate('John Doe'); // ❌ FAIL
```

### `refine(schema, name, validator)`
Adds custom validation logic.

```javascript
const PositiveNumber = refine(number(), 'positive', (value) => {
    return value > 0 || 'Expected a positive number';
});
```

---

## CSMA Contract Helper

The `contract()` helper wraps schemas with ECCA metadata for governance and security.

### Basic Usage

```javascript
import { contract, object, string, size } from './runtime/validation/index.js';

export const NOTE_SAVED = contract({
    // ECCA Metadata
    version: 1,
    type: 'event',
    owner: 'storage-service',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'pii',
    description: 'Published when a note is saved',
    
    // Schema
    schema: object({
        id: string(),
        title: size(string(), 1, 200),
        content: optional(string())
    })
});

// Use it
const [error, validated] = NOTE_SAVED.validate(payload);
```

### With Rate Limiting

```javascript
export const INTENT_CREATE_ITEM = contract({
    version: 1,
    type: 'intent',
    owner: 'ui-service',
    stability: 'stable',
    compliance: 'public',
    
    // Security metadata
    security: {
        rateLimits: {
            perUser: { requests: 10, window: 60000 }  // 10/min
        }
    },
    
    schema: object({ /* ... */ })
});

// Check rate limits in EventBus
if (INTENT_CREATE_ITEM.hasRateLimits()) {
    const limits = INTENT_CREATE_ITEM.getRateLimits();
    // Apply rate limiting logic
}
```

### Helper Methods

```javascript
// Check for rate limiting
contract.hasRateLimits()  // boolean

// Get rate limit config
contract.getRateLimits()  // { perUser: { requests, window } } | null

// Check compliance level
contract.requiresPII()     // boolean
contract.isExperimental()  // boolean
contract.isDeprecated()    // boolean
```

---

## Semantic Validators

Domain-specific validators for common data types.

### `email(message?)`
Validates email addresses.

```javascript
import { email } from './runtime/validation/index.js';

const EmailSchema = email();
EmailSchema.validate('user@example.com'); // ✅ PASS
EmailSchema.validate('not-an-email');     // ❌ FAIL
```

### `url(message?)`
Validates URLs.

```javascript
import { url } from './runtime/validation/index.js';

const UrlSchema = url();
UrlSchema.validate('https://example.com'); // ✅ PASS
UrlSchema.validate('not a url');           // ❌ FAIL
```

### `uuid(version?, message?)`
Validates UUIDs (v4 by default).

```javascript
import { uuid } from './runtime/validation/index.js';

const IdSchema = uuid();
IdSchema.validate('550e8400-e29b-41d4-a716-446655440000'); // ✅ PASS
```

### `phone(message?)`
Validates phone numbers (E.164 format).

```javascript
import { phone } from './runtime/validation/index.js';

const PhoneSchema = phone();
PhoneSchema.validate('+1234567890');  // ✅ PASS
PhoneSchema.validate('(123) 456-7890'); // ✅ PASS (auto-cleaned)
```

### `hexColor(message?)`
Validates hex color codes.

```javascript
import { hexColor } from './runtime/validation/index.js';

const ColorSchema = hexColor();
ColorSchema.validate('#ff0000'); // ✅ PASS
ColorSchema.validate('#fff');    // ✅ PASS
```

### `isoDate(message?)`
Validates ISO 8601 date strings.

```javascript
import { isoDate } from './runtime/validation/index.js';

const DateSchema = isoDate();
DateSchema.validate('2025-12-01T10:00:00Z'); // ✅ PASS
```

---

## Security Validators

Security-first validators for zero-trust architecture.

### `llmInput(maxTokens?)`
Validates LLM input with **prompt injection detection**.

```javascript
import { llmInput } from './runtime/validation/index.js';

const PromptSchema = llmInput(4000); // Max ~4K tokens

// Safe input
PromptSchema.validate('Please summarize this text'); // ✅ PASS

// Prompt injection attempt
PromptSchema.validate('Ignore previous instructions'); // ❌ BLOCKED!
```

**Detects**:
- "ignore previous instructions"
- "disregard previous"
- "system: you are"
- "[SYSTEM]", "[ADMIN]" tags
- ChatGPT delimiters
- Excessive repetition

### `sanitizedHTML()`
Validates HTML content for XSS prevention.

```javascript
import { sanitizedHTML } from './runtime/validation/index.js';

const HtmlSchema = sanitizedHTML();

HtmlSchema.validate('<p>Safe content</p>');           // ✅ PASS
HtmlSchema.validate('<script>alert("XSS")</script>'); // ❌ BLOCKED!
```

**Blocks**:
- `<script>` tags
- `<iframe>`, `<object>`, `<embed>`
- Event handlers (`onclick=`, `onerror=`)
- `javascript:` URIs

### `sanitizedURL()`
Validates URLs for scheme safety.

```javascript
import { sanitizedURL } from './runtime/validation/index.js';

const SafeUrlSchema = sanitizedURL();

SafeUrlSchema.validate('https://example.com');    // ✅ PASS
SafeUrlSchema.validate('javascript:alert(1)');    // ❌ BLOCKED!
SafeUrlSchema.validate('data:text/html,...');     // ❌ BLOCKED!
```

**Blocks**:
- `javascript:` scheme
- `data:` scheme
- `vbscript:` scheme
- `file:` scheme

### `sqlSafe()`
Validates strings for SQL injection prevention.

```javascript
import { sqlSafe } from './runtime/validation/index.js';

const InputSchema = sqlSafe();

InputSchema.validate('user input');           // ✅ PASS
InputSchema.validate("'; DROP TABLE users--"); // ❌ BLOCKED!
```

### `strongPassword(minLength?)`
Validates password strength.

```javascript
import { strongPassword } from './runtime/validation/index.js';

const PasswordSchema = strongPassword(12);

// Requires 12+ chars + 3 of: uppercase, lowercase, digits, special
PasswordSchema.validate('MyP@ssw0rd123'); // ✅ PASS
PasswordSchema.validate('weakpass');       // ❌ FAIL
```

---

## Complete Example: Secure Email Service

```javascript
import { 
    contract, 
    object, 
    string, 
    size,
    email,
    sanitizedHTML 
} from './runtime/validation/index.js';

export const INTENT_SEND_EMAIL = contract({
    version: 1,
    type: 'intent',
    owner: 'email-service',
    stability: 'stable',
    compliance: 'pii',
    description: 'User intent to send email',
    
    security: {
        rateLimits: {
            perUser: { requests: 5, window: 60000 }  // 5 emails/min max
        }
    },
    
    schema: object({
        to: email(),                           // Semantic validator
        subject: size(string(), 1, 200),
        body: sanitizedHTML(),                 // Security validator
        userId: string()
    })
});

// Usage in service
class EmailService {
    async sendEmail(payload) {
        // Validate
        const [error, validated] = INTENT_SEND_EMAIL.validate(payload);
        if (error) {
            throw new Error(`Invalid email: ${error.message}`);
        }
        
        // Check rate limits
        if (INTENT_SEND_EMAIL.hasRateLimits()) {
            const limits = INTENT_SEND_EMAIL.getRateLimits();
            // Apply rate limiting via EventBus
        }
        
        // Send email with validated data
        await this.send(validated);
    }
}
```

---

## Integration with EventBus

The validation library integrates seamlessly with EventBus for automatic contract validation.

```javascript
// EventBus checks contracts automatically
class EventBus {
    publish(eventName, payload) {
        const contract = Contracts[eventName];
        
        // Automatic validation
        const [error, validated] = contract.validate(payload);
        if (error) {
            throw new Error(`Contract violation: ${error.message}`);
        }
        
        // Check rate limits
        if (contract.hasRateLimits()) {
            const limits = contract.getRateLimits();
            this.checkRateLimit(eventName, payload.userId, limits);
        }
        
        // Publish validated payload
        this.notifySubscribers(eventName, validated);
    }
}
```

---

## Performance

### Bundle Size
- Core validation: ~3KB gzipped
- CSMA features: +1KB gzipped
- Semantic validators: +0.5KB gzipped
- **Total**: ~4.5KB gzipped

### Tree-Shaking
Vite automatically removes unused validators:

```javascript
// Only import what you need
import { string, number, email } from './runtime/validation/index.js';

// Not imported = not in bundle:
// - uuid, phone, hexColor, isoDate
// - llmInput, sanitizedHTML, sqlSafe
// - Entire refinements.js if not used
```

**Result**: Production bundle only includes what you actually use!

---

## Migration from External Superstruct

If you were using external Superstruct:

**Before**:
```javascript
import { object, string } from 'superstruct';
```

**After**:
```javascript
import { object, string } from './runtime/validation/index.js';
```

All code remains the same - 100% backward compatible!

---

## Best Practices

### 1. Always Use contract() Helper
```javascript
// ✅ GOOD: With ECCA metadata
export const NOTE_SAVED = contract({
    version: 1,
    type: 'event',
    owner: 'storage-service',
    // ... metadata
    schema: object({ /* ... */ })
});

// ❌ BAD: Raw schema without metadata
export const NOTE_SAVED = object({ /* ... */ });
```

### 2. Use Semantic Validators When Available
```javascript
// ✅ GOOD
const UserSchema = object({
    email: email(),
    website: url()
});

// ❌ BAD (manual regex)
const UserSchema = object({
    email: pattern(string(), /regex/)
});
```

### 3. Add Rate Limits to User Intents
```javascript
// ✅ GOOD: Rate limited
export const INTENT_CREATE_ITEM = contract({
    type: 'intent',
    security: {
        rateLimits: { perUser: { requests: 10, window: 60000 } }
    },
    schema: /* ... */
});
```

### 4. Use Security Validators for External Data
```javascript
// ✅ GOOD: Uses llmInput
const ClassifyIntent = object({
    text: llmInput(4000),  // Blocks prompt injection!
    userId: string()
});

// ❌ BAD: No injection protection
const ClassifyIntent = object({
    text: size(string(), 1, 16000),
    userId: string()
});
```

---

## Extending the Library

### Create Custom Validators

```javascript
import { refine, string } from './runtime/validation/index.js';

// Custom validator for username
export function username() {
    return refine(
        size(string(), 3, 20),
        'username',
        (value) => {
            if (!/^[a-z0-9_]+$/.test(value)) {
                return 'Username must be lowercase alphanumeric with underscores';
            }
            return true;
        }
    );
}
```

### Add to validators/semantic.js
Place custom validators in `src/runtime/validation/validators/semantic.js` and export from `index.js`.

---

## FAQ

**Q: Why not use Zod or Yup?**  
A: They're larger (~15KB) and we want full control for CSMA-specific features.

**Q: Does validation run in production?**  
A: Yes! Runtime validation is a security layer - never remove it.

**Q: How do I add custom error messages?**  
A: Most validators accept an optional `message` parameter.

**Q: Can I disable unknown key checking in objects?**  
A: No - strict validation prevents data leakage and security issues.

**Q: What about TypeScript?**  
A: The library is pure JavaScript but can be used in TypeScript projects. Types can be inferred from schemas.

---

## Summary

The CSMA validation library provides:

- ✅ **11 primitive types** - Building blocks
- ✅ **4 refinements** - Constraints
- ✅ **1 contract helper** - ECCA integration
- ✅ **6 semantic validators** - Common domains
- ✅ **5 security validators** - Zero-trust

**Total**: 27 exports in ~900 lines of code, ~4.5KB gzipped.

**Zero external dependencies. Production-ready. Security-first.**
