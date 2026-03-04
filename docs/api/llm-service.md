# CSMA Instructor

> Structured LLM extraction using CSMA validation - Zero dependencies, ~5KB

## What is it?

**CSMA Instructor** extracts **structured, validated data** from LLM text responses.

Instead of raw text:
```
"John Doe is 30 years old and lives in New York"
```

You get typed, validated objects:
```javascript
{
  name: "John Doe",
  age: 30,
  location: "New York"
}
```

---

## Features

✅ **CSMA validation** (homemade library)  
✅ **Zero dependencies** (just fetch API)  
✅ **Automatic retries** on validation failures  
✅ **Streaming support** for real-time updates  
✅ **EventBus integration** (CSMA-native)  
✅ **~5KB** vs instructor-js's ~60KB  

---

## Installation

Already included! Just enable the feature:

```javascript
// src/config.js
export const FEATURES = {
    LLM_INSTRUCTOR: true  // Enable LLM extraction
};
```

Set your API key:
```bash
export OPENAI_API_KEY="sk-..."
```

---

## Quick Start

```javascript
import { createInstructor } from './services/llm/Instructor.js';
import { object, string, number } from './runtime/validation/index.js';
import { email } from './runtime/validation/validators/semantic.js';

// 1. Create instructor
const instructor = createInstructor(eventBus, {
    apiKey: process.env.OPENAI_API_KEY
});

// 2. Define schema with CSMA validation
const UserSchema = object({
    name: string(),
    age: number(),
    email: email()
});

// 3. Extract!
const user = await instructor.extract({
    schema: UserSchema,
    prompt: 'John Doe, 30, john@example.com'
});

console.log(user);
// { name: "John Doe", age: 30, email: "john@example.com" }
```

---

## How It Works

1. **Schema → JSON Schema** - Converts validation schema to OpenAI-compatible format
2. **LLM Extraction** - Calls OpenAI with function calling
3. **Validation** - Validates output with CSMA validation library
4. **Retry on Failure** - Automatically retries with error feedback
5. **EventBus Events** - Publishes `LLM_EXTRACTION_COMPLETED/FAILED`

---

## API Reference

### `createInstructor(eventBus, options)`

Create an instructor instance.

**Options**:
- `apiKey` - OpenAI API key (or set `OPENAI_API_KEY` env var)
- `baseURL` - API endpoint (default: `https://api.openai.com/v1`)
- `model` - Model name (default: `gpt-4`)
- `maxRetries` - Max retry attempts (default: `3`)
- `debug` - Enable debug logging (default: `false`)

**Returns**: `Instructor` instance

---

### `instructor.extract({ schema, prompt, name, model })`

Extract structured data from text.

**Parameters**:
- `schema` **(required)** - CSMA validation schema
- `prompt` **(required)** - User prompt/text to extract from
- `name` - Function name for extraction (default: `'extract_data'`)
- `model` - Override default model
- `systemPrompt` - Custom system prompt

**Returns**: `Promise<Object>` - Validated data

**Throws**: Error after max retries exceeded

---

### `instructor.extractStream({ schema, prompt, name, model })`

Stream extraction with progressive updates.

**Parameters**: Same as `extract()`

**Returns**: `AsyncGenerator` - Yields partial results

---

## Examples

See [LLM Instructor](../advanced/llm-instructor.md) for:
- Basic extraction
- Streaming
- Error handling
- EventBus integration
- ECCA contracts
- Complex nested structures
- Production configuration

---

## EventBus Events

### `LLM_EXTRACTION_COMPLETED`

Published when extraction succeeds.

```javascript
{
    name: 'extract_user',
    data: { ... },  // Validated result
    attempts: 1,
    model: 'gpt-4',
    timestamp: 1234567890
}
```

### `LLM_EXTRACTION_FAILED`

Published when extraction fails after max retries.

```javascript
{
    name: 'extract_user',
    error: 'Validation failed: ...',
    attempts: 3,
    lastError: '...',
    timestamp: 1234567890
}
```

---

## Bundle Size

| Component | Size |
|-----------|------|
| Instructor.js | ~3KB |
| schemaToJSONSchema util | ~2KB |
| **Total** | **~5KB** |

vs. instructor-js: **~60KB** (12x smaller!) ✅

---

## Supported Providers

- ✅ OpenAI (gpt-4, gpt-3.5-turbo)
- ✅ Groq (mixtral, llama)  
- ✅ Together AI (mixtral, llama)
- ✅ Any OpenAI-compatible API

Just change `baseURL`:
```javascript
createInstructor(eventBus, {
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'mixtral-8x7b-32768'
});
```

---

## Limitations

**Not Included** (vs instructor-js):
- ❌ TypeScript types (pure JavaScript)
- ❌ LangSmith integration
- ❌ Complex schema streaming (zod-stream)
- ❌ Multi-modal (images) - text only

**Why?** 
- Keep it simple and small (~5KB vs ~60KB)
- Most CSMA apps don't need these features
- Focused on structured text extraction

---

## FAQ

### Q: Why not use instructor-js?

**A**: Different philosophy!
- instructor-js: Feature-rich, TypeScript, Zod, ~60KB
- CSMA Instructor: Minimal, JavaScript, CSMA validation, ~5KB

We built this for CSMA apps that want lightweight LLM extraction without heavy dependencies.

### Q: Can I use both validation libraries?

**A**: No! Stick with the CSMA validation library for consistency.

CSMA Instructor uses the same validation library as your contracts, keeping everything unified.

### Q: What about local LLMs (Ollama)?

**A**: Works with any OpenAI-compatible API!

```javascript
createInstructor(eventBus, {
    baseURL: 'http://localhost:11434/v1',  // Ollama
    model: 'llama2'
});
```

### Q: How does retry logic work?

**A**: On validation failure:
1. Send error message back to LLM
2. LLM tries again with feedback
3. Repeat up to `maxRetries` times

This dramatically improves accuracy!

---

## Best Practices

### ✅ DO:

```javascript
// Use descriptive schema fields
const schema = object({
    email: email().describe('User email address'),
    age: number().describe('User age in years')
});

// Handle errors
try {
    const data = await instructor.extract({ schema, prompt });
} catch (error) {
    // Log or fallback
}

// Use EventBus
eventBus.subscribe('LLM_EXTRACTION_COMPLETED', handleData);
```

### ❌ DON'T:

```javascript
// Don't expose API keys in frontend
const instructor = createInstructor(eventBus, {
    apiKey: 'sk-hardcoded'  // NEVER!
});

// Don't ignore validation
const data = await instructor.extract({ ... });
// Always wrap in try/catch

// Don't use in tight loops
for (let i = 0; i < 1000; i++) {
    await instructor.extract({ ... });  // Expensive!
}
```

---

## Troubleshooting

### "API key required"

Set `OPENAI_API_KEY` environment variable or pass `apiKey` option.

### "Max retries exceeded"

LLM couldn't produce valid output. Try:
- Simpler schema
- Better prompt
- Another model
- More retries

### "No tool call in response"

LLM didn't use function calling. Check:
- Model supports function calling (gpt-4, gpt-3.5-turbo)
- Schema is valid
- Prompt is clear

---

## License

MIT - Same as CSMA starter template

---

## Learn More

- [LLM Instructor](../advanced/llm-instructor.md) - Usage examples
- [Validation Guide](../guides/validation.md) - Validation library guide
- [Features Guide](../guides/features.md) - Feature flags
