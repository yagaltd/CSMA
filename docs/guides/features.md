# CSMA Kit - Features Guide

## Overview

The CSMA kit comes with optional features that can be enabled/disabled via `src/config.js`. All features are tree-shakeable - if you don't use them, they won't be in your production bundle!

---

## Core Features (Always Enabled)

### ✅ **Event Validation**
**Size**: ~4.5KB  
**Location**: `src/runtime/validation/`

Homemade validation library forked from Superstruct with CSMA enhancements:
- 11 primitive types
- 6 semantic validators (email, url, uuid, phone, hexColor, isoDate)
- 5 security validators (llmInput, sanitizedHTML, sanitizedURL, sqlSafe, strongPassword)
- Contract helper with ECCA metadata

**Read more**: [Validation Guide](./validation.md)

### ✅ **EventBus**
**Size**: ~1KB  
**Location**: `src/runtime/EventBus.js`

Type-safe pub/sub with contract validation and rate limiting.

### ✅ **ServiceManager**
**Size**: ~0.5KB  
**Location**: `src/runtime/ServiceManager.js`

Service lifecycle and dependency injection.

---

## Optional Features

### 🔧 **PWA Support**
**Toggle**: `FEATURES.PWA = true/false`  
**Size**: +3KB (service worker)  
**Files**:
- `public/manifest.json`
- `public/sw.js`
- `public/offline.html`

**Features**:
- Offline caching (cache-first strategy)
- "Add to Home Screen" (web only - Capacitor/Neutralino handle native)
- Offline fallback page
- Background sync ready

**Usage**:
```javascript
// Enable in config.js
export const FEATURES = {
    PWA: true  // Enable service worker
};

// Auto-registers service worker if enabled
```

---

### 🧭 **Router**
**Toggle**: `FEATURES.ROUTER = true/false`  
**Size**: +2KB  
**File**: `src/runtime/Router.js`

Hash-based SPA routing with EventBus integration.

**Features**:
- Dynamic routes (`/user/:id`)
- Navigation guards
- Route metadata
- Back/forward navigation
- 404 handling

**Usage**:
```javascript
import { createRouter } from './runtime/Router.js';

const router = createRouter(eventBus);

// Register routes
router.register('/', () => renderHome());
router.register('/user/:id', (route) => {
    renderUser(route.params.id);
});

// Navigate
router.push('/user/123');
```

---

###  **Storage (IndexedDB)**
**Toggle**: `FEATURES.INDEXEDDB = true/false`  
**Size**: +1.5KB  
**File**: `src/runtime/Storage.js`

Simple IndexedDB wrapper for offline data storage.

**Features**:
- CRUD operations
- Schema migrations
- Indexes and queries
- EventBus integration

**Usage**:
```javascript
import { createStorage } from './runtime/Storage.js';

const storage = createStorage(eventBus, 'my-db', 1);

// Initialize with schema
await storage.init({
    notes: {
        keyPath: 'id',
        indexes: {
            byCategory: 'category'
        }
    }
});

// CRUD
await storage.add('notes', { id: '1', title: 'Hello', category: 'personal' });
const note = await storage.get('notes', '1');
const personal = await storage.query('notes', 'byCategory', 'personal');
```

---

### 🌍 **i18n (Internationalization)**
**Toggle**: `FEATURES.I18N = true/false`  
**Size**: +1.5KB  
**File**: `src/runtime/I18n.js`  
**Translations**: `public/locales/`

Translation system with interpolation and pluralization.

**Features**:
- Translation loading
- Parameter interpolation
- Pluralization rules
- Fallback locale
- Language switcher

**Usage**:
```javascript
import { createI18n } from './runtime/I18n.js';

const i18n = createI18n(eventBus, 'en');

// Load translations
await i18n.loadLocale('en', await fetch('/locales/en.json').then(r => r.json()));
await i18n.loadLocale('es', await fetch('/locales/es.json').then(r => r.json()));

// Translate
i18n.t('app.title');                                    // "CSMA App"
i18n.t('validation.required', { field: 'Email' });      // "Email is required"
i18n.plural('items', 5);                                // "5 items"

// Switch language
i18n.setLocale('es');
```

---

### 🛠️ **DevTools + Web Analytics (Development + Production)**
**Toggle**: `FEATURES.DEVTOOLS = import.meta.env.DEV` (auto) + `FEATURES.LOG_ACCUMULATOR = true`  
**Size**: 0KB dev-only panel + ~2KB analytics (production)  
**Included in**: `src/runtime/LogAccumulator.js`

**Combined error tracking, developer tools, and web analytics.**

#### **Development Features**:
- Event viewer (all EventBus events)
- Error log (with stack traces)
- Contract violations tracker
- Analytics viewer
- Filter and search
- Export logs
- Collapsible panel

#### **Web Analytics Features** (Production):
- **Page view tracking** (automatic on route changes)
- **Custom event tracking** (button clicks, form submissions, etc.)
- **User identification** (associate events with users)
- **Batching** (10 events or 30s intervals)
- **Beacon API** (guaranteed delivery even on page unload)
- **Platform detection** (web, Capacitor, Neutralino)

**Usage**:
```javascript
// Initialize analytics (optional, production)
logAccumulator.init({
    endpoint: '/api/analytics',
    maxBatchSize: 10,
    batchInterval: 30000
});

// Track page views (automatic)
eventBus.publish('PAGE_CHANGED', { title: 'Home' });

// Track custom events
logAccumulator.track('Button Clicked', {
    buttonId: 'cta-signup',
    page: '/homepage'
});

// Identify users
logAccumulator.setUser('user-123', {
    email: 'user@example.com',
    plan: 'premium'
});

// Manual flush (usually automatic)
logAccumulator.flush();
```

**Platform Support**:
- ✅ **Web**: Full support with Beacon API
- ✅ **Capacitor (iOS/Android)**: Full support
- ✅ **Neutralino**: Full support
- ❌ **NativeScript**: Not supported (no WebView)

**Privacy**:
- GDPR-friendly (opt-in via `init()`)
- Your data (not Google's)
- No cookies by default
- User consent required

**Dev Panel Usage**:
Automatically appears in bottom-right corner in development mode. Click toggle to expand/collapse.

**Tabs**:
- **Events**: All EventBus events in real-time
- **Errors**: JavaScript errors and promise rejections
- **Contracts**: Contract validation failures
- **Analytics**: Analytics events preview

**Read more**: [Core Services API](../api/core-services.md)

---

## Tier 3: Core Services (Optional)

Production-ready services for data, API, and form management. All are tree-shakeable!

### 💾 **CacheManager**
**Toggle**: `FEATURES.CACHE_MANAGER = true/false`  
**Size**: +4KB  
**File**: `src/services/core/CacheManager.js`

Multi-strategy caching with TTL expiration.

**Features**:
- 3 caching strategies: cache-first, network-first, stale-while-revalidate
- 3 storage backends: memory, localStorage, IndexedDB
- TTL expiration and pattern-based invalidation
- Hit/miss statistics

**Usage**:
```javascript
const cache = serviceManager.get('cacheManager');

// Cache API responses
const users = await cache.fetch('/api/users',
    () => api.get('/api/users'),
    { strategy: 'cache-first', ttl: 5 * 60 * 1000 }
);

// Invalidate by pattern
cache.invalidate(/^\/api\/users/);
```

**EventBus Events**: `CACHE_HIT`, `CACHE_MISS`, `CACHE_SET`, `CACHE_INVALIDATED`

---

### 🔀 **DataAggregator**
**Toggle**: `FEATURES.DATA_AGGREGATOR = true/false`  
**Size**: +2KB  
**File**: `src/services/core/DataAggregator.js`

Orchestrate multiple API calls in parallel.

**Features**:
- Parallel composition (multiple APIs at once)
- Waterfall (sequential with result passing)
- Batch requests with deduplication
- Graceful partial failure handling

**Usage**:
```javascript
const aggregator = serviceManager.get('dataAggregator');

// Load dashboard from multiple endpoints
const { results, errors } = await aggregator.compose('dashboard', {}, {
    stats: () => api.get('/api/stats'),
    orders: () => api.get('/api/orders'),
    notifications: () => api.get('/api/notifications')
});

// Even if one fails, you get the others!
renderDashboard(results);
```

**EventBus Events**: `DATA_AGGREGATION_STARTED`, `DATA_AGGREGATION_COMPLETED`, `DATA_AGGREGATION_FAILED`

---

### 🌐 **APIWrapper**
**Toggle**: `FEATURES.API_WRAPPER = true/false`  
**Size**: +3.5KB  
**File**: `src/services/core/APIWrapper.js`

Unified HTTP client with interceptors and auto-retry.

**Features**:
- HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Request/response interceptors
- Exponential backoff retry (up to 3x)
- Request cancellation and timeout
- Error handling

**Usage**:
```javascript
const api = serviceManager.get('api');

// Simple requests
const users = await api.get('/api/users');
await api.post('/api/users', { name: 'John' });

// Add interceptors
api.addRequestInterceptor((config) => {
    config.headers['X-Custom'] = 'value';
    return config;
});

// Auto-retry on failure
const data = await api.get('/api/flaky-endpoint');
// Retries with backoff: 1s, 2s, 4s
```

**EventBus Events**: `API_REQUEST_START`, `API_REQUEST_SUCCESS`, `API_REQUEST_ERROR`, `API_REQUEST_RETRY`

---

### 🔐 **AuthService**
**Toggle**: `FEATURES.AUTH_SERVICE = true/false`  
**Size**: +4KB  
**File**: `src/services/core/AuthService.js`  
**Requires**: `API_WRAPPER` enabled

JWT authentication with auto-refresh.

**Features**:
- JWT token management
- Login/logout/register flows
- **Auto-refresh** before token expiry
- RBAC (roles + permissions)
- Session persistence (localStorage/IndexedDB)

**Usage**:
```javascript
const auth = serviceManager.get('auth');

// Login
await auth.login({
    email: 'user@example.com',
    password: 'password'
});

// Check authentication
if (auth.isAuthenticated()) {
    console.log('User:', auth.getCurrentUser());
}

// Role-based access
if (auth.hasRole('admin')) {
    showAdminPanel();
}

// Auto-logout on expiry
eventBus.subscribe('SESSION_EXPIRED', () => {
    router.navigate('/login');
});
```

**Auto-Integration**: Auth headers automatically injected into all API requests!

**EventBus Events**: `USER_LOGGED_IN`, `USER_LOGGED_OUT`, `TOKEN_REFRESHED`, `SESSION_EXPIRED`, `AUTH_ERROR`

---

### ✅ **FormValidator**
**Toggle**: `FEATURES.FORM_VALIDATOR = true/false`  
**Size**: +2.8KB  
**File**: `src/services/core/FormValidator.js`

Real-time form validation with contract integration.

**Features**:
- Field-level and form-level validation
- Debounced real-time validation (300ms)
- Reuse existing CSMA validation schemas
- ARIA accessibility support
- Auto-bind to forms

**Usage**:
```javascript
import { object, string } from './runtime/validation/index.js';
import { email } from './runtime/validation/validators/semantic.js';

const formValidator = serviceManager.get('formValidator');

// Register form schema
formValidator.register('contact-form', object({
    name: string(),
    email: email()
}));

// Auto-bind (easiest!)
const form = document.getElementById('contact-form');
formValidator.bindToForm(form, 'contact-form');

// Listen for validated data
form.addEventListener('validated', async (e) => {
    // Data is already validated!
    await api.post('/contact', e.detail);
});
```

**EventBus Events**: `FIELD_VALIDATION_PASSED/FAILED`, `FORM_VALIDATION_PASSED/FAILED`

---

### 📦 **Tier 3 Bundle Impact**

| Services Enabled | Size (gzipped) |
|------------------|----------------|
| None | ~8KB (core only) |
| CacheManager | ~12KB |
| + DataAggregator | ~14KB |
| + APIWrapper | ~17.5KB |
| + AuthService | ~21.5KB |
| + FormValidator | ~24KB |

**Full Featured** (all Tier 3 + Tier 2): ~28KB

**Read more**: [Core Services API](../api/core-services.md)

---

## Error Recovery

Enhanced LogAccumulator includes automatic error recovery UI.

**Features**:
- Detects critical errors
- Shows user-friendly error modal
- Stack trace (dev mode only)
- "Reload" or "Dismiss" actions
- Auto-dismiss for non-critical errors (10s)

**Triggered by**:
- "Cannot read property"
- "undefined is not"
- "Failed to fetch"
- Other critical JavaScript errors

---

## Feature Configuration

**File**: `src/config.js`

```javascript
export const FEATURES = {
    // Core (always enabled)
    VALIDATION: true,
    EVENT_BUS: true,
    SERVICE_MANAGER: true,
    
    // Optional Tier 2
    PWA: false,           // Service Worker + offline
    ROUTER: false,        // SPA routing
    I18N: false,          // Translations
    INDEXEDDB: false,     // Local database
    
    // LLM (Tier 2.5)
    LLM_INSTRUCTOR: false,  // Structured LLM extraction
    
    // Core Services (Tier 3)
    CACHE_MANAGER: true,      // Recommended: caching
    DATA_AGGREGATOR: true,    // Recommended: API orchestration
    API_WRAPPER: true,        // Recommended: HTTP client
    AUTH_SERVICE: false,      // Optional: if auth needed
    FORM_VALIDATOR: false,    // Optional: form validation
    
    // Dev tools (auto in development)
    DEVTOOLS: import.meta.env.DEV,
    
    // Analytics
    LOG_ACCUMULATOR: true,
    META_MANAGER: true
};
```

**How It Works**:

```javascript
// In main.js
import { FEATURES } from './config.js';

if (FEATURES.PWA) {
    // Only loads if enabled
    const { registerServiceWorker } = await import('./runtime/PWA.js');
    registerServiceWorker();
}

if (FEATURES.ROUTER) {
    const { Router } = await import('./runtime/Router.js');
    router = new Router(eventBus);
}
```

**Tree-Shaking**: If you set `FEATURES.ROUTER = false` and don't import it, Vite will completely remove it from the production bundle!

---

## Bundle Size Summary

| Feature | Size (gzipped) | Tree-shakeable? |
|---------|----------------|--------------------|
| **Core (Tier 1)** | | |
| Validation | ~4.5KB | Partially (unused validators removed) |
| EventBus | ~1KB | No (core) |
| ServiceManager | ~0.5KB | No (core) |
| LogAccumulator + Analytics | ~5KB | No (core) |
| **Core Total** | **~11KB** | - |
| **Optional (Tier 2)** | | |
| Router | +2KB | ✅ Yes |
| Storage | +1.5KB | ✅ Yes |
| I18n | +1.5KB | ✅ Yes |
| PWA (SW) | +3KB | ✅ Yes |
| DevTools | 0KB | ✅ Yes (dev-only) |
| **Tier 2 Total** | **+8KB** | - |
| **Core Services (Tier 3)** | | |
| CacheManager | +4KB | ✅ Yes |
| DataAggregator | +2KB | ✅ Yes |
| APIWrapper | +3.5KB | ✅ Yes |
| AuthService | +4KB | ✅ Yes |
| FormValidator | +2.8KB | ✅ Yes |
| **Tier 3 Total** | **+16.3KB** | - |
| **Full Bundle** | **~35KB** | - |

**Recommended Minimal**: ~11KB (core only with analytics)  
**Recommended Default**: ~23KB (core + CacheManager + DataAggregator + APIWrapper)  
**Maximum**: ~35KB (everything enabled)

---

## What's Next?

### Enable Features You Need:

1. **Building SPA?** → Enable `ROUTER`
2. **Need offline?** → Enable `PWA` + `INDEXEDDB`
3. **Multi-language?** → Enable `I18N`
4. **Just starting?** → Use defaults (core only)

### Selective Imports:

You can also import features directly without using config flags:

```javascript
// Import only what you need
import { createRouter } from './runtime/Router.js';
import { createStorage } from './runtime/Storage.js';
import { createI18n } from './runtime/I18n.js';
```

Vite will tree-shake the rest automatically!

---

## Additional Documentation

- **Validation**: See [Validation Guide](./validation.md)
- **Web Analytics**: See [Core Services API](../api/core-services.md)
- **Tier 3 Core Services**: See [Core Services API](../api/core-services.md)
- **Architecture**: See [Complete CSMA Guide](../complete-csma-guide.md)
- **Contracts**: See `src/runtime/Contracts.js`
- **Getting Started**: See [Getting Started](./getting-started.md)
- **Project Overview**: See [CSMA in a Nutshell](./csma-in-a-nutshell.md)

---

**Questions?** Check the complete CSMA guide or open an issue!
