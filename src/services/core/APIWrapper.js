/**
 * APIWrapper - Unified HTTP client with interceptors
 * Wraps fetch API with auto-retry, auth headers, error handling
 * ~200 lines, ~2KB gzipped
 */

export class APIWrapper {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.baseURL = options.baseURL || '';
        this.timeout = options.timeout || 10000; // 10s default
        this.retries = options.retries || 3;
        this.debug = options.debug ?? false;

        // Optional response cache (services/core/CacheManager). Opt-in:
        // pass { cache } to enable GET response caching. When present,
        // strategies derive from the server's Cache-Control header by default.
        this.cache = options.cache || null;
        this.cacheStrategy = options.cacheStrategy || 'cache-first';
        this.cacheTtl = options.cacheTtl ?? 60000; // fallback when header silent

        // Interceptors
        this.requestInterceptors = [];
        this.responseInterceptors = [];

        // Default headers
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Active requests (for cancellation)
        this.activeRequests = new Map();
        this.requestCounter = 0;
    }

    /**
     * Add request interceptor
     * Runs before request is sent
     */
    addRequestInterceptor(fn) {
        this.requestInterceptors.push(fn);
        this.log('Added request interceptor');
    }

    /**
     * Add response interceptor
     * Runs after response is received
     */
    addResponseInterceptor(fn) {
        this.responseInterceptors.push(fn);
        this.log('Added response interceptor');
    }

    /**
     * GET request
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data, options = {}) {
        await this._invalidateEndpointCache(endpoint);
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: data
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data, options = {}) {
        await this._invalidateEndpointCache(endpoint);
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: data
        });
    }

    /**
     * PATCH request
     */
    async patch(endpoint, data, options = {}) {
        await this._invalidateEndpointCache(endpoint);
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: data
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
        await this._invalidateEndpointCache(endpoint);
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    /**
     * Mutations invalidate cached GETs for the same endpoint (and query
     * variants of it). Conservative: clears any cache entry whose key starts
     * with the endpoint URL.
     */
    /**
     * Mutations invalidate cached GETs for the same endpoint (and query
     * variants of it) BEFORE the mutation resolves, so a follow-up GET can
     * never race ahead of invalidation and read stale data. Conservative:
     * clears any cache entry whose key matches the endpoint URL + query.
     */
    async _invalidateEndpointCache(endpoint) {
        if (!this.cache) return;
        const base = this.buildURL(endpoint);
        // invalidate() takes a regex — escape the URL so it matches literally,
        // then allow any query-string suffix (query variants of the endpoint).
        const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
            await this.cache.invalidate(new RegExp(`^${escaped}(\\?.*)?$`));
        } catch {
            // best-effort: invalidation failure must not fail the mutation
        }
    }

    /**
     * Main request method with retry logic
     */
    async request(endpoint, options = {}) {
        const requestId = ++this.requestCounter;
        const { retries = this.retries } = options;

        // Optional GET response cache (opt-in via { cache }). Only safe,
        // idempotent GETs participate; response Cache-Control drives
        // storability and TTL (no-store bypasses, private = memory-only).
        const cacheable = Boolean(
            this.cache
            && (options.method || 'GET').toUpperCase() === 'GET'
            && options.cacheable !== false
        );
        const cacheKey = cacheable ? this._cacheKey(endpoint, options) : null;
        if (cacheable) {
            const cached = await this.cache.get(cacheKey).catch(() => undefined);
            if (cached !== undefined && !this.cache.isExpired(cacheKey)) {
                this.eventBus?.publish?.('API_REQUEST_SUCCESS', {
                    requestId,
                    method: 'GET',
                    endpoint,
                    status: 200,
                    duration: 0,
                    cache: 'hit',
                    timestamp: Date.now()
                });
                return cached;
            }
        }

        let attempt = 0;
        let lastError;

        while (attempt <= retries) {
            try {
                const result = await this.executeRequest(endpoint, options, requestId, attempt);
                if (cacheable) {
                    await this._storeInCache(cacheKey, options, result);
                }
                return result;
            } catch (error) {
                lastError = error;
                attempt++;

                // Don't retry on client errors (4xx) or if no retries left
                if (error.status >= 400 && error.status < 500) {
                    throw error;
                }

                if (attempt <= retries) {
                    const delay = this.calculateBackoff(attempt);
                    this.log(`Retrying ${endpoint} (attempt ${attempt}/${retries}) after ${delay}ms`);

                    this.eventBus.publish('API_REQUEST_RETRY', {
                        method: options.method,
                        endpoint,
                        attempt,
                        maxRetries: retries,
                        delay,
                        timestamp: Date.now()
                    });

                    await this.sleep(delay);
                }
            }
        }

        throw lastError;
    }

    /**
     * Build the cache key for a GET endpoint: URL + sorted query params.
     */
    _cacheKey(endpoint, options = {}) {
        const url = this.buildURL(endpoint);
        const params = options.params;
        if (!params || typeof params !== 'object') return url;
        const qs = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
        return qs ? `${url}?${qs}` : url;
    }

    /**
     * Store a successful GET result, deriving policy from the response
     * Cache-Control header when available (no-store → skip; private →
     * memory-only; max-age → TTL). Falls back to configured defaults.
     */
    async _storeInCache(key, options, result) {
        const header = this._lastCacheControl;
        this._lastCacheControl = null;
        let ttl = options.cacheTtl ?? this.cacheTtl;
        let memoryOnly = false;

        if (header) {
            const cc = header.toLowerCase();
            if (/\bno-store\b/.test(cc) || /\bno-cache\b/.test(cc)) {
                this.eventBus?.publish?.('API_REQUEST_SUCCESS', {
                    requestId: this.requestCounter,
                    method: 'GET',
                    endpoint: key,
                    cache: 'bypass',
                    timestamp: Date.now()
                });
                return; // server forbids storing
            }
            if (/\bprivate\b/.test(cc)) {
                memoryOnly = true; // never persist to IDB/localStorage backends
            }
            const maxAge = cc.match(/(?:^|[,\s])max-age\s*=\s*(\d+)/);
            if (maxAge) {
                ttl = Number(maxAge[1]) * 1000;
            }
        }

        if (memoryOnly && this.cache.storage && typeof this.cache.storage === 'object') {
            // Bypass the persistent backend for this write: set in memory only.
            this.cache.memoryCache?.set?.(key, { value: result });
            this.cache.ttls?.set?.(key, Date.now() + ttl);
            return;
        }
        await this.cache.set(key, result, ttl).catch(() => {});
    }

    /**
     * Execute single request
     */
    async executeRequest(endpoint, options, requestId, attempt) {
        const startTime = Date.now();
        const url = this.buildURL(endpoint);
        const config = await this.buildConfig(options);

        // Create abort controller for timeout/cancellation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        // Store for potential cancellation
        this.activeRequests.set(requestId, controller);

        this.eventBus.publish('API_REQUEST_START', {
            requestId,
            method: config.method,
            endpoint,
            attempt,
            timestamp: startTime
        });

        this.log(`${config.method} ${url} (attempt ${attempt})`);

        try {
            // Execute request
            let response = await fetch(url, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Run response interceptors
            for (const interceptor of this.responseInterceptors) {
                response = await interceptor(response, config);
            }

            // Capture Cache-Control for the optional response cache.
            this._lastCacheControl = response.headers?.get?.('cache-control') || null;

            // Handle HTTP errors
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.response = response;
                throw error;
            }

            // Parse response
            const data = await this.parseResponse(response);

            const duration = Date.now() - startTime;

            this.eventBus.publish('API_REQUEST_SUCCESS', {
                requestId,
                method: config.method,
                endpoint,
                status: response.status,
                duration,
                timestamp: Date.now()
            });

            this.log(`✓ ${config.method} ${url} (${duration}ms)`);

            return data;

        } catch (error) {
            clearTimeout(timeoutId);

            const duration = Date.now() - startTime;

            // Handle abort
            if (error.name === 'AbortError') {
                error.message = 'Request timeout or cancelled';
            }

            this.eventBus.publish('API_REQUEST_ERROR', {
                requestId,
                method: config.method,
                endpoint,
                status: error.status,
                error: error.message,
                duration,
                timestamp: Date.now()
            });

            this.log(`✗ ${config.method} ${url} (${duration}ms):`, error.message);

            throw error;

        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * Build full URL
     */
    buildURL(endpoint) {
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
            return endpoint;
        }
        return `${this.baseURL}${endpoint}`;
    }

    /**
     * Build request config
     */
    async buildConfig(options) {
        let config = {
            method: options.method || 'GET',
            headers: {
                ...this.defaultHeaders,
                ...options.headers
            }
        };

        // Add body for non-GET requests
        if (options.body && config.method !== 'GET') {
            config.body = typeof options.body === 'string'
                ? options.body
                : JSON.stringify(options.body);
        }

        // Run request interceptors
        for (const interceptor of this.requestInterceptors) {
            config = await interceptor(config);
        }

        return config;
    }

    /**
     * Parse response based on content type
     */
    async parseResponse(response) {
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
            return response.json();
        }

        if (contentType?.includes('text/')) {
            return response.text();
        }

        return response.blob();
    }

    /**
     * Calculate exponential backoff delay
     */
    calculateBackoff(attempt) {
        const baseDelay = 1000; // 1 second
        return Math.min(baseDelay * Math.pow(2, attempt - 1), 10000); // Max 10s
    }

    /**
     * Cancel request by ID
     */
    cancelRequest(requestId) {
        const controller = this.activeRequests.get(requestId);
        if (controller) {
            controller.abort();
            this.activeRequests.delete(requestId);
            this.log('Cancelled request:', requestId);
        }
    }

    /**
     * Cancel all active requests
     */
    cancelAll() {
        for (const [id, controller] of this.activeRequests.entries()) {
            controller.abort();
        }
        this.activeRequests.clear();
        this.log('Cancelled all requests');
    }

    /**
     * Set base URL
     */
    setBaseURL(url) {
        this.baseURL = url;
        this.log('Base URL set to:', url);
    }

    /**
     * Set default headers
     */
    setDefaultHeaders(headers) {
        this.defaultHeaders = { ...this.defaultHeaders, ...headers };
        this.log('Default headers updated');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    log(...args) {
        if (this.debug) {
            console.debug('[APIWrapper]', ...args);
        }
    }
}

/**
 * Create APIWrapper instance
 */
export function createAPIWrapper(eventBus, options = {}) {
    return new APIWrapper(eventBus, options);
}
