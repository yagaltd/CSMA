# CSMA Core Services

> Production-ready services for data, API, and form management

## Overview

This directory contains 5 optional core services for CSMA applications:

| Service | Purpose | Bundle Size | Status |
|---------|---------|-------------|--------|
| [CacheManager](#cachemanager) | Multi-strategy caching | ~4KB | ✅ Stable |
| [DataAggregator](#dataaggregator) | Parallel API orchestration | ~2KB | ✅ Stable |
| [APIWrapper](#apiwrapper) | HTTP client with interceptors | ~3.5KB | ✅ Stable |
| [AuthService](#authservice) | JWT authentication | ~4KB | ✅ Stable |
| [FormValidator](#formvalidator) | Real-time form validation | ~2.8KB | ✅ Stable |

**Total**: ~16KB (all services, gzipped)

---

## Quick Start

### 1. Enable Services

```javascript
// src/config.js
export const FEATURES = {
    CACHE_MANAGER: true,      // Offline-first caching
    DATA_AGGREGATOR: true,    // Parallel API calls
    API_WRAPPER: true,        // HTTP client
    AUTH_SERVICE: true,       // Authentication (requires API_WRAPPER)
    FORM_VALIDATOR: true,     // Form validation
};
```

### 2. Use Services

All services are registered with `ServiceManager` and available via:

```javascript
const cache = serviceManager.get('cacheManager');
const aggregator = serviceManager.get('dataAggregator');
const api = serviceManager.get('api');
const auth = serviceManager.get('auth');
const formValidator = serviceManager.get('formValidator');
```

---

## CacheManager

**Multi-strategy caching with TTL expiration**

### Features
- 3 caching strategies (cache-first, network-first, stale-while-revalidate)
- 3 storage backends (memory, localStorage, IndexedDB)
- TTL expiration
- Pattern-based invalidation
- Hit/miss statistics

### Usage

```javascript
const cache = serviceManager.get('cacheManager');

// Cache-first: return cached if available
const users = await cache.fetch('/api/users',
    () => api.get('/api/users'),
    { strategy: 'cache-first', ttl: 5 * 60 * 1000 }
);

// Invalidate by pattern
cache.invalidate(/^\/api\/users/);

// Get statistics
const stats = cache.getStats();
console.log('Hit rate:', stats.hitRate);
```

### EventBus Events
- `CACHE_HIT` - Cache hit occurred
- `CACHE_MISS` - Cache miss, fetcher called
- `CACHE_SET` - Value cached
- `CACHE_INVALIDATED` - Pattern invalidation

---

## DataAggregator

**Orchestrate multiple API calls in parallel**

### Features
- Parallel composition (Promise.allSettled)
- Waterfall (sequential with passing results)
- Batch requests with deduplication
- Race (first successful wins)
- Graceful partial failure handling

### Usage

```javascript
const aggregator = serviceManager.get('dataAggregator');

// Parallel composition
const { results, errors } = await aggregator.compose('dashboard', {}, {
    stats: () => api.get('/api/stats'),
    orders: () => api.get('/api/orders/recent'),
    notifications: () => api.get('/api/notifications')
});

// Even if notifications fails, you get stats + orders!
renderDashboard(results);
```

### EventBus Events
- `DATA_AGGREGATION_STARTED` - Composition started
- `DATA_AGGREGATION_COMPLETED` - Composition finished
- `DATA_AGGREGATION_FAILED` - Composition failed

---

## APIWrapper

**Unified HTTP client with interceptors and auto-retry**

### Features
- HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Request/response interceptors
- Exponential backoff retry (up to 3x)
- Request cancellation
- Timeout handling
- Error handling

### Usage

```javascript
const api = serviceManager.get('api');

// Simple requests
const users = await api.get('/api/users');
await api.post('/api/users', { name: 'John' });
await api.put('/api/users/1', { name: 'Jane' });
await api.delete('/api/users/1');

// Add interceptor
api.addRequestInterceptor((config) => {
    config.headers['X-Custom-Header'] = 'value';
    return config;
});

// Auto-retry on failure (with exponential backoff)
const data = await api.get('/api/flaky-endpoint');
// Retries: 1s delay, 2s delay, 4s delay (max)
```

### EventBus Events
- `API_REQUEST_START` - Request initiated
- `API_REQUEST_SUCCESS` - Request succeeded
- `API_REQUEST_ERROR` - Request failed
- `API_REQUEST_RETRY` - Retry attempt

---

## AuthService

**JWT authentication with auto-refresh**

### Features
- JWT token management
- Login/logout/register flows
- **Auto-refresh** before expiry
- RBAC (roles + permissions)
- Session persistence
- Token expiry detection
- Publishes `AUTH_SESSION_UPDATED` on every change so transport-aware services (ChannelManager, Checkout, Optimistic Sync) can re-evaluate access in real time.
- Uses cookie-based sessions (`credentials: 'include'`) so the same token automatically rides with `/optimistic/ws` upgrades.

### Usage

```javascript
const auth = serviceManager.get('auth');

// Login
const { user } = await auth.login({
    email: 'user@example.com',
    password: 'secure-password'
});

// Check authentication
if (auth.isAuthenticated()) {
    console.log('Logged in as:', auth.getCurrentUser().name);
}

// Role-based access
if (auth.hasRole('admin')) {
    showAdminPanel();
}

// Logout
await auth.logout();
```

#### Session cookies & transport

- Every request sent through `AuthService` includes `credentials: 'include'`, so the SSMA cookie (`ssma_session` by default) stays up to date without manually attaching headers.
- `AUTH_SESSION_UPDATED` fires whenever `register`, `login`, `logout`, or `refreshSession` runs. Subscribe to it if you need to flip UI state or re-register optimistic intents:

```js
eventBus.subscribe('AUTH_SESSION_UPDATED', ({ user }) => {
  channelManager.reevaluateAccess();
  checkoutService?.syncOptimisticMode?.(user);
});
```

#### Guest fallback coordination

Some modules (e.g., checkout) now downgrade to synchronous EventBus handling when `auth.isAuthenticated()` is `false` unless you explicitly opt-in to guest optimistic sync (`window.csma.config.optimisticSync.allowGuestCheckout = true`). The AuthService role helpers (`getRole`, `hasRole`) let you build the same guardrails in your own features.

### Auto-Integration with APIWrapper

When `AUTH_SERVICE` is enabled, auth headers are **automatically** injected:

```javascript
// No need to manually add auth headers!
const profile = await api.get('/api/user/profile');
// Authorization: Bearer eyJ... (auto-added!)
```

401 responses trigger automatic token refresh:

```javascript
// Token expired? Auto-refresh and retry!
const data = await api.get('/api/protected');
// Transparent refresh, no user intervention needed
```

### EventBus Events
- `USER_LOGGED_IN` - Login successful
- `USER_LOGGED_OUT` - Logout occurred
- `USER_REGISTERED` - New user registered
- `TOKEN_REFRESHED` - Token auto-refreshed
- `SESSION_EXPIRED` - Session expired
- `AUTH_ERROR` - Auth error occurred
- `AUTH_SESSION_UPDATED` - Fired for every change (login, logout, auto-refresh, explicit `refreshSession()` call)

---

## FormValidator

**Real-time form validation with contract integration**

### Features
- Field-level validation
- Form-level validation
- Debounced real-time validation (300ms)
- Contract integration (reuse schemas!)
- ARIA accessibility
- Auto-bind to forms

### Usage

```javascript
import { object, string, number } from './runtime/validation/index.js';
import { email } from './runtime/validation/validators/semantic.js';

const formValidator = serviceManager.get('formValidator');

// Register form
formValidator.register('contact-form', object({
    name: string(),
    email: email(),
    age: number()
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

### EventBus Events
- `FIELD_VALIDATION_STARTED` - Field validation started
- `FIELD_VALIDATION_PASSED` - Field is valid
- `FIELD_VALIDATION_FAILED` - Field has errors
- `FORM_VALIDATION_PASSED` - Form is valid
- `FORM_VALIDATION_FAILED` - Form has errors

---

## Service Dependencies

```
AuthService → APIWrapper → EventBus
            ↘ Storage (optional)

APIWrapper → EventBus

CacheManager → EventBus
             ↘ Storage (optional for IndexedDB backend)

DataAggregator → EventBus

FormValidator → EventBus
              ↘ Validation library
```

### Load Order

Services are loaded in dependency order in `main.js`:

1. CacheManager (no dependencies)
2. DataAggregator (no dependencies)
3. APIWrapper (no dependencies)
4. AuthService (depends on APIWrapper)
5. FormValidator (no dependencies)

---

## All EventBus Events

Complete list of events published by all services:

### CacheManager (4 events)
- `CACHE_HIT`
- `CACHE_MISS`
- `CACHE_SET`
- `CACHE_INVALIDATED`

### DataAggregator (3 events)
- `DATA_AGGREGATION_STARTED`
- `DATA_AGGREGATION_COMPLETED`
- `DATA_AGGREGATION_FAILED`

### APIWrapper (4 events)
- `API_REQUEST_START`
- `API_REQUEST_SUCCESS`
- `API_REQUEST_ERROR`
- `API_REQUEST_RETRY`

### AuthService (6 events)
- `USER_LOGGED_IN`
- `USER_LOGGED_OUT`
- `USER_REGISTERED`
- `TOKEN_REFRESHED`
- `SESSION_EXPIRED`
- `AUTH_ERROR`

### FormValidator (5 events)
- `FIELD_VALIDATION_STARTED`
- `FIELD_VALIDATION_PASSED`
- `FIELD_VALIDATION_FAILED`
- `FORM_VALIDATION_PASSED`
- `FORM_VALIDATION_FAILED`

**Total**: 22 EventBus events

---

## Real-World Example

Complete app using all services:

```javascript
// 1. LOGIN
const auth = serviceManager.get('auth');
const formValidator = serviceManager.get('formValidator');

formValidator.register('login-form', object({
    email: email(),
    password: string()
}));

const loginForm = document.getElementById('login-form');
formValidator.bindToForm(loginForm, 'login-form');

loginForm.addEventListener('validated', async (e) => {
    await auth.login(e.detail);
    router.navigate('/dashboard');
});

// 2. DASHBOARD (cached + aggregated)
const cache = serviceManager.get('cacheManager');
const aggregator = serviceManager.get('dataAggregator');
const api = serviceManager.get('api');

async function loadDashboard() {
    const data = await cache.fetch('dashboard',
        () => aggregator.compose('dashboard', {}, {
            stats: () => api.get('/api/stats'),
            orders: () => api.get('/api/orders')
        }).then(({ results }) => results),
        { strategy: 'stale-while-revalidate' }
    );
    
    renderDashboard(data);
}

// 3. AUTO-LOGOUT ON EXPIRY
eventBus.subscribe('SESSION_EXPIRED', () => {
    router.navigate('/login');
    showToast('Session expired');
});
```

---

## Bundle Size Impact

| Configuration | Size (gzipped) |
|---------------|----------------|
| Core only (no services) | ~8KB |
| + CacheManager | ~12KB |
| + DataAggregator | ~14KB |
| + APIWrapper | ~17.5KB |
| + AuthService | ~21.5KB |
| + FormValidator | ~24KB |
| **All services** | **~24KB** |

**Tree-shaking**: Disabled services = 0KB overhead!

---

## Configuration

### Enable All Services

```javascript
// src/config.js
export const FEATURES = {
    // Core Services
    CACHE_MANAGER: true,
    DATA_AGGREGATOR: true,
    API_WRAPPER: true,
    AUTH_SERVICE: true,
    FORM_VALIDATOR: true,
};
```

### Minimal (No Services)

```javascript
export const FEATURES = {
    CACHE_MANAGER: false,
    DATA_AGGREGATOR: false,
    API_WRAPPER: false,
    AUTH_SERVICE: false,
    FORM_VALIDATOR: false,
};
```

Bundle size: ~8KB → ~24KB (all enabled)

---

## API Reference

See inline documentation in each service file:
- `CacheManager.js` - Cache management
- `DataAggregator.js` - API orchestration
- `APIWrapper.js` - HTTP client
- `AuthService.js` - Authentication
- `FormValidator.js` - Form validation

All services support:
- Debug mode (`debug: true`)
- EventBus integration
- Error handling
- Production-ready defaults

---

## License

MIT - Same as CSMA starter template
