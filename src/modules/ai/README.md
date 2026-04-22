# CSMA AI Module

## Overview

Frontend AI orchestration for CSMA.

This module owns:
- frontend chat/session orchestration
- generation and streaming lifecycle
- provider/backend transport abstraction
- tool registration and execution telemetry

This module does **not** own CSMA-specific UI capability validation. That belongs to `library/modules/ai-ui/`.

## Architecture

```
ai/
├── index.js
├── client/
│   ├── AIClient.js
│   ├── ChatSession.js
│   └── ToolRegistry.js
├── providers/
│   ├── AIProvider.js
│   ├── SSMAGatewayProvider.js
│   ├── GeminiProvider.js
│   └── TransformersProvider.js
└── README.md
```

## Recommended Role

Default deployment split:
- frontend chat/UI calls `ai`
- `ai` sends normalized requests to SSMA
- SSMA talks to cloud or local models
- SSMA returns or streams results back to `ai`
- `ai-ui` validates model output into CSMA command/view operations

`ai` can still support direct providers where needed, but the primary CSMA + SSMA integration path is the SSMA-backed provider.

## Current Pieces

- `AIClient` coordinates providers and tool execution
- `ChatSession` manages multi-turn history
- `SSMAGatewayProvider` connects the frontend to SSMA's public query boundary
- `ToolRegistry` handles frontend tool registration/execution

## Related Module

- `library/modules/ai-ui/` exports CSMA command/view capabilities and validates AI UI actions before execution

## Example Configuration

```js
window.csma.config = {
  ai: {
    providers: {
      ssma: {
        queryName: 'ai.generate'
      }
    }
  }
};
```
