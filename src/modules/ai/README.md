# AI Module

## Purpose

Multi-provider AI orchestration for generation, chat sessions, provider fallback, streaming, and frontend tool calls.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `ai` via `AIService` |
| Contracts | AI provider, generation, chat, tool, and security events from `contracts/ai-contracts.js`. |

## Runtime Integration

Loaded with `FEATURES.AI_MODULE`; runtime config lives under `runtimeConfig.ai` and can resolve SSMA query endpoints.

## Storage / Side Effects

May call configured AI providers or SSMA endpoints; keeps chat/session state in memory.

## Tests

Covered through contract/runtime tests; add dedicated AI service tests when provider behavior changes.
