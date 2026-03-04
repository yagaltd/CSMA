# CSMA AI Module (v1.21)

## Overview

Unified AI client with multi-provider support (cloud APIs + local browser models), automatic fallback, and capabilities-based routing.

**Status**: Skeleton - Ready for implementation  
**Bundle Impact**: +12KB (see enhancement-plan.md 6.8)  
**Priority**: HIGH  

## Architecture

```
ai/
├── index.js                      # Main export: createAIClient()
├── providers/
│   ├── AIProvider.js            # Abstract base class
│   ├── stubs/
│   │   ├── GeminiProvider.js    # Cloud - to be adapted from voice-note-app
│   │   └── TransformersProvider.js # Local - to be implemented
├── client/
│   ├── AIClient.js              # Provider orchestrator
│   └── Chat.js                  # Chat session (future)
└── README.md                    # This file
```

## Quick Reference

**See enhancement-plan.md section 6.8 for:**
- Complete API documentation
- Provider implementation details
- EventBus contracts
- Integration examples
- Use cases

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| AIClient | ⏳ Stub | Basic structure created |
| AIProvider (base) | ✅ Complete | Abstract class ready |
| GeminiProvider | ⏳ Stub | Adapt from voice-note-app/src/providers/GeminiProvider.js |
| TransformersProvider | ❌ Not started | Use @huggingface/transformers |
| EventBus integration | ❌ Not started | Replace console.log with eventBus.publish |
| Streaming | ❌ Not started | Add to GeminiProvider & AIClient |
| Chat history | ❌ Not started | Create Chat.js client |
| Tools system | ❌ Not started | TanStack-inspired function calling |

## Next Steps

1. **Adapt GeminiProvider**: Copy from voice-note-app, add EventBus events
2. **Implement TransformersProvider**: Use @huggingface/transformers for local models
3. **Add streaming**: Support real-time token streaming
4. **Create Chat.js**: Multi-turn conversation management
5. **Add tools**: Type-safe function calling system
6. **Test with voice-note-app**: Verify transcription/classification works

## Provider Priority

Local providers (priority 100) are tried first:
- Transformers.js (browser models)
- Ollama (local server)

Cloud providers (priority 50) are fallback:
- Gemini
- OpenAI
- Anthropic

## Example Usage

```javascript
import { createAIClient } from './modules/ai/index.js';

const ai = createAIClient(eventBus, {
  providers: {
    gemini: { apiKey: 'AIza...' },
    transformers: { enabled: true }
  }
});

const response = await ai.generateText({
  prompt: 'Explain CSS Grid',
  stream: true
});
```

## Bundle Breakdown

- Base AI module: 5KB
- GeminiProvider: 3KB
- Tool system: 3KB
- Security: 1KB
- **Total: 12KB**

---

**For detailed documentation, see enhancement-plan.md section 6.8**
