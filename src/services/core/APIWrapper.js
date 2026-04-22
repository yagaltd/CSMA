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
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    /**
     * Main request method with retry logic
     */
    async request(endpoint, options = {}) {
        const requestId = ++this.requestCounter;
        const { retries = this.retries } = options;

        let attempt = 0;
        let lastError;

        while (attempt <= retries) {
            try {
                const result = await this.executeRequest(endpoint, options, requestId, attempt);
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
            console.log('[APIWrapper]', ...args);
        }
    }
}

/**
 * Create APIWrapper instance
 */
export function createAPIWrapper(eventBus, options = {}) {
    return new APIWrapper(eventBus, options);
}
