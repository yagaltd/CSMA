# Portable LLM Architecture: Frontend → Backend API Gateway

> **Goal**: Make LLM calls secure across Chrome Extension MV3, Cloudflare Workers, Bun/Deno while keeping LLMService.js portable

---

## 1. Current Problem: API Keys in Frontend

### LLMService.js (Current - Insecure)
```javascript
// ❌ INSECURE: API keys in frontend
async callLLM({ system, user }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,  // ❌ Exposed in client bundle
    },
    body: JSON.stringify({ messages: [{role: 'system', content: system}, {role: 'user', content: user}] })
  })
}
```

### Security Issues
1. **API keys in bundle**: Anyone can extract from Chrome Extension source
2. **No API key service**: Keys stored in `config.js` or `.env` (exposed)
3. **No rate limiting**: Users can spam LLM API without restriction
4. **No tier enforcement**: Free tier users can use paid LLMs
5. **No analytics**: Can't track usage per user

---

## 2. Target Architecture: API Gateway Pattern

```
┌─────────────┐
│  Frontend   │  LLMService.js
│             │  (Call adapter, no API keys)
└──────┬──────┘
       │ HTTP / WebSocket / Message
       ↓
┌─────────────────────────┐
│  API Gateway Adapter    │  Routes to platform backend
│                         │  - Chrome Extension: runtime.sendMessage
│                         │  - Cloudflare Worker: fetch()
│                         │  - Bun/Deno: fetch() or HTTP client
└──────┬──────────────────┘
       │
       ↓
┌─────────────────────────┐
│  Backend Service        │  Stores API keys
│  (Platform-specific)    │  Validates user tier
│                         │  Enforces rate limits
└──────┬──────────────────┘
       │
       ↓
┌─────────────────────────┐
│  LLM Provider API       │  OpenAI / Anthropic / Gemini
└─────────────────────────┘
```

---

## 3. Portable Adapter Pattern

### LLMService v2: Frontend Adapter
```javascript
// modules/llm/services/LLMService.js (PORTABLE)
export class LLMService {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus;
    this.gateway = options.gateway || this.detectGateway();
  }
  
  detectGateway() {
    // Auto-detect platform
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      return 'chrome-extension';
    } else if (typeof Deno !== 'undefined') {
      return 'deno';
    } else if (typeof WorkerGlobalScope !== 'undefined') {
      return 'cloudflare-worker';
    } else {
      return 'bun';  // Or fallback to remote API
    }
  }
  
  // Universal call method (no API keys here)
  async callLLM({ system, user, provider = 'openai', model = 'gpt-4' }) {
    const request = {
      provider,
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      timestamp: Date.now(),
      userId: await this.getUserIdLocally()
    };
    
    // Route to platform-specific backend
    switch (this.gateway) {
      case 'chrome-extension':
        return this.callChromeExtension(request);
      case 'cloudflare-worker':
        return this.callCloudflareWorker(request);
      case 'bun':
      case 'deno':
        return this.callBunDenoServer(request);
      default:
        throw new Error(`Unsupported gateway: ${this.gateway}`);
    }
  }
  
  // Chrome Extension: Use Service Worker
  async callChromeExtension(request) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'LLM_CALL', payload: request },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  }
  
  // Cloudflare Worker: HTTP request to Worker endpoint
  async callCloudflareWorker(request) {
    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }
    
    return response.json();
  }
  
  // Bun/Deno Server: HTTP request to local server
  async callBunDenoServer(request) {
    const serverUrl = import.meta.env.VITE_LLM_GATEWAY_URL || 'http://localhost:3000/api/llm';
    
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    return response.json();
  }
  
  // Get user ID from local storage (no auth = anonymous)
  async getUserIdLocally() {
    try {
      const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
      return user.id || 'anonymous';
    } catch {
      return 'anonymous';
    }
  }
}
```

**Key feature**: **No API keys in this file**. Backend has keys.

---

## 4. Platform-Specific Backends

### Backend 1: Chrome Extension Service Worker
```javascript
// service-worker.js (background script)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LLM_CALL') {
    handleLLMCall(message.payload, sendResponse);
    return true;  // Keep channel open for async response
  }
});

async function handleLLMCall(request, sendResponse) {
  try {
    // Service Worker HAS access to API keys (stored in chrome.storage)
    const { apiKey } = await chrome.storage.local.get('llm_api_key');
    
    const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages
      })
    });
    
    const result = await response.json();
    sendResponse(result);
    
  } catch (error) {
    sendResponse({ error: error.message });
  }
}
```

### Backend 2: Cloudflare Worker
```javascript
// workers/api-llm.js
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/llm') {
      return this.handleLLMRequest(request, env);
    }
    return new Response('Not found', { status: 404 });
  },
  
  async handleLLMRequest(request, env) {
    const payload = await request.json();
    
    // 1. Rate limiting (per user)
    const rateLimit = await checkRateLimit(env, payload.userId);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: rateLimit.retryAfter
      }), { status: 429 });
    }
    
    // 2. User tier validation (check quotas)
    if (payload.userId !== 'anonymous') {
      const tier = await getUserTier(env, payload.userId);
      const canUse = await checkQuota(env, tier, payload.provider);
      if (!canUse) {
        return new Response(JSON.stringify({
          error: 'Provider not available for your tier'
        }), { status: 403 });
      }
    }
    
    // 3. Get API key from secrets
    const apiKey = env[`${payload.provider.toUpperCase()}_API_KEY`];
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'Provider API key not configured'
      }), { status: 500 });
    }
    
    // 4. Call LLM (with streaming support)
    const llmResponse = await fetch(getLLMEndpoint(payload.provider), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: payload.model,
        messages: payload.messages
      })
    });
    
    // 5. Stream response back to client
    return new Response(llmResponse.body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
}

function getLLMEndpoint(provider) {
  const endpoints = {
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages',
    gemini: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent'
  };
  return endpoints[provider] || endpoints.openai;
}
```

### Backend 3: Bun/Deno Server
```javascript
// server/api/llm.ts (Deno)
import { Application, Router } from 'https://deno.land/x/oak/mod.ts';

const router = new Router();

router.post('/api/llm', async (ctx) => {
  const payload = await ctx.request.body.json();
  
  // 1. Authentication (if user is logged in)
  const authHeader = ctx.request.headers.get('Authorization');
  let userTier = 'free';
  let userId = payload.userId;
  
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const verifier = ctx.app.state.jwtVerifier;
    const result = verifier.verifyToken(token);
    
    if (result.valid) {
      userId = result.payload.sub;
      userTier = result.payload.tier || 'free';
    }
  }
  
  // 2. Rate limiting (per user tier)
  const rateLimiter = ctx.app.state.rateLimiter;
  const allowed = await rateLimiter.check(userId, {
    tier: userTier,
    provider: payload.provider
  });
  
  if (!allowed) {
    ctx.response.status = 429;
    ctx.response.body = { error: 'Rate limit exceeded' };
    return;
  }
  
  // 3. Quota check (LLM credits)
  if (userTier === 'free' && payload.provider === 'anthropic') {
    ctx.response.status = 403;
    ctx.response.body = { error: 'Claude requires Pro tier' };
    return;
  }
  
  // 4. Call LLM (Deno.env has API keys)
  const apiKey = Deno.env.get(`${payload.provider}_API_KEY`);
  if (!apiKey) {
    ctx.response.status = 500;
    ctx.response.body = { error: 'Provider not configured' };
    return;
  }
  
  // 5. Forward to LLM provider
  const response = await fetch(getLLMEndpoint(payload.provider), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: payload.model,
      messages: payload.messages
    })
  });
  
  // 6. Stream back to client
  ctx.response.headers.set('Content-Type', 'application/json');
  ctx.response.body = response.body;
});

const app = new Application();
app.use(router.routes());
await app.listen({ port: 3000 });
```

---

## 5. Configuration per Platform

### Chrome Extension (manifest.json)
```json
{
  "manifest_version": 3,
  "background": {
    "service_worker": "service-worker.js"
  },
  "permissions": ["storage"],
  "host_permissions": [
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
    "https://generativelanguage.googleapis.com/*"
  ]
}
```

### Cloudflare Worker (wrangler.toml)
```toml
name = "llm-gateway"
main = "workers/api-llm.js"
compatibility_date = "2025-01-01"

[vars]
OPENAI_API_KEY = "sk-..."
ANTHROPIC_API_KEY = "sk-ant-..."
GEMINI_API_KEY = "AIza..."

[[env.production.vars]]
OPENAI_API_KEY = "sk-prod-..."  # Override in production
```

### Bun/Deno (.env)
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
DATABASE_URL=postgres://...
```

---

## 6. Security Benefits

### Before (Insecure)
```javascript
// Front-end has API keys
const OPENAI_API_KEY = 'sk-...';  // ❌ Extractable from bundle
```

### After (Secure)
```javascript
// Front-end has NO keys
// Backend has keys in secure storage:
// - Chrome: chrome.storage.local (encrypted)
// - Cloudflare: env secrets (encrypted at rest)
// - Bun/Deno: .env file (server-side only)
```

### Rate Limiting per Platform
```javascript
// Chrome Extension: Simple in-memory
const requests = new Map();

// Cloudflare Worker: KV store
const rateLimit = await env.LLM_RATE_LIMIT.get(userId);

// Bun/Deno: Redis or in-memory
const redis = await connectRedis();
const count = await redis.incr(`llm:${userId}`);
```

---

## 7. Implementation Steps

### Step 1: Update LLMService.js (2 hours)
```bash
# Replace direct API calls with adapter pattern
# Copy code from section 3 above
# Remove all API keys from this file
```

### Step 2: Create Platform Backends (4 hours)
```bash
# service-worker.js (Chrome Extension)
# workers/api-llm.js (Cloudflare Worker)  
# server/api/llm.ts (Bun/Deno)
```

### Step 3: Store API Keys Securely (1 hour)
```bash
# Chrome: chrome.storage.local.set({llm_api_key: '...'})
# Cloudflare: wrangler secret put OPENAI_API_KEY
# Bun/Deno: .env file (server-side only)
```

### Step 4: Update config.js (30 minutes)
```javascript
// Indicate backend is required
FEATURES.LLM_BACKEND = true;
```

**Total time**: 7.5 hours

---

## 8. Code Reuse Across Platforms

### What Stays the Same (Portable)
- **LLMService.js**: Frontend adapter (no platform-specific code)
- **Validation**: sanitizeLLMInput, system prompts (portable)
- **EventBus**: Same events across all platforms
- **Contracts**: TEXT_CLASSIFIED, INTENT_CLASSIFY_TEXT (portable)

### What Changes per Platform (Platform Adapter)
- **Service Worker**: Handles auth, API keys
- **Cloudflare Worker**: KV for rate limiting, env secrets
- **Bun/Deno**: Full server with JWT auth, PostgreSQL for quotas

**Result**: 80% code reuse, 20% platform-specific

---

## 9. Testing Strategy

### Chrome Extension
```javascript
// Test in extension
chrome.runtime.sendMessage({
  type: 'LLM_CALL',
  payload: { provider: 'openai', messages: [...] }
})
```

### Cloudflare Worker
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/api/llm \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","messages":[...]}'
```

### Bun/Deno
```bash
curl -X POST http://localhost:3000/api/llm \
  -H "Content-Type: application/json" \
  -d '{"userId":"user123","provider":"openai","messages":[...]}'
```

---

## 10. Summary

### ✅ Yes, LLMService.js should change
- **Remove**: Direct API calls with exposed keys
- **Add**: Adapter pattern that routes to backends
- **Benefit**: API keys secured, rate limiting, tier enforcement

### ✅ Portable across all platforms
- **LLMService.js**: Stays in frontend, no API keys
- **Backends**: Platform-specific (Chrome SW, CF Worker, Bun/Deno)
- **API Gateway**: Unified interface, different implementations
- **Bundle size**: 
- Frontend LLMService.js: +2KB (adapter pattern)
- Chrome Extension backend: +5KB (service worker)
- Cloudflare Worker backend: +8KB (KV + rate limiting)
- Bun/Deno backend: +10KB (full server features)

### Implementation Priority
1. **Chrome Extension**: Easiest (service worker)
2. **Cloudflare Worker**: Medium (KV, rate limiting)
3. **Bun/Deno**: Complex (full server, DB, auth)

**Recommendation**: Start with Chrome Extension → Cloudflare Worker → Bun/Deno
