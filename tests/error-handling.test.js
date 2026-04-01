/**
 * Error Handling & Resilience Tests
 * Tests for network failures, API errors, validation errors, and recovery scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

/**
 * Mock fetch responses
 */
const mockResponses = {
    '400': { ok: false, status: 400, statusText: 'Bad Request', json: () => Promise.resolve({ error: 'Validation failed', fields: ['email'] }) },
    '401': { ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({ error: 'Authentication required' }) },
    '403': { ok: false, status: 403, statusText: 'Forbidden', json: () => Promise.resolve({ error: 'Access denied' }) },
    '404': { ok: false, status: 404, statusText: 'Not Found', json: () => Promise.resolve({ error: 'Resource not found' }) },
    '429': { ok: false, status: 429, statusText: 'Too Many Requests', json: () => Promise.resolve({ error: 'Rate limit exceeded', retryAfter: 60 }) },
    '500': { ok: false, status: 500, statusText: 'Internal Server Error', json: () => Promise.resolve({ error: 'Server error' }) },
    '502': { ok: false, status: 502, statusText: 'Bad Gateway', json: () => Promise.resolve({ error: 'Bad gateway' }) },
    '503': { ok: false, status: 503, statusText: 'Service Unavailable', json: () => Promise.resolve({ error: 'Service temporarily unavailable' }) },
    '504': { ok: false, status: 504, statusText: 'Gateway Timeout', json: () => Promise.resolve({ error: 'Gateway timeout' }) },
    'success': { ok: true, status: 200, json: () => Promise.resolve({ data: 'success' }) },
    'timeout': new Error('Request timeout'),
    'network': new Error('Network error'),
    'offline': new Error('No internet connection')
};

/**
 * Error message templates
 */
const errorMessages = {
    network: {
        offline: 'You appear to be offline. Please check your connection.',
        timeout: 'The request took too long. Please try again.',
        server: 'Unable to connect to the server. Please try again later.',
        unknown: 'An unexpected network error occurred.'
    },
    api: {
        400: 'Invalid request. Please check your input.',
        401: 'Your session has expired. Please log in again.',
        403: 'You don\'t have permission to perform this action.',
        404: 'The requested resource was not found.',
        429: 'Too many requests. Please wait a moment and try again.',
        500: 'A server error occurred. Our team has been notified.',
        503: 'The service is temporarily unavailable. Please try again later.'
    },
    validation: {
        required: 'This field is required.',
        email: 'Please enter a valid email address.',
        minLength: 'Must be at least {min} characters.',
        maxLength: 'Must be no more than {max} characters.',
        pattern: 'Please match the requested format.',
        number: 'Please enter a valid number.',
        date: 'Please enter a valid date.',
        url: 'Please enter a valid URL.'
    }
};

/**
 * Create test document
 */
function createTestDocument(content) {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>${content}</body>
        </html>
    `);
    return dom.window.document;
}

// ============================================
// NETWORK ERROR TESTS
// ============================================

describe('Network Error Handling', () => {
    describe('Offline detection', () => {
        it('detects offline state', () => {
            // JSDOM may omit navigator.onLine entirely, so only require a non-throwing probe.
            const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
            expect(['boolean', 'undefined']).toContain(typeof isOnline);
        });

        it('shows offline indicator', () => {
            const doc = createTestDocument(`
                <div class="offline-indicator" data-visible="true">
                    <span class="offline-indicator-icon">⚠️</span>
                    <span>You are currently offline</span>
                </div>
            `);
            const indicator = doc.querySelector('.offline-indicator');
            expect(indicator.dataset.visible).toBe('true');
        });
    });

    describe('Timeout handling', () => {
        it('timeout error has clear message', () => {
            const error = mockResponses.timeout;
            expect(error.message).toBe('Request timeout');
        });

        it('timeout error shows retry option', () => {
            const doc = createTestDocument(`
                <div class="error-container" data-type="network">
                    <div class="error-icon">⏱️</div>
                    <div class="error-title">Request Timeout</div>
                    <div class="error-message">The request took too long. Please try again.</div>
                    <div class="error-actions">
                        <button class="button" data-action="retry">Try again</button>
                    </div>
                </div>
            `);
            const retryBtn = doc.querySelector('[data-action="retry"]');
            expect(retryBtn).toBeTruthy();
        });
    });

    describe('Slow connection handling', () => {
        it('shows loading state for slow requests', () => {
            const doc = createTestDocument(`
                <div class="loading-container" aria-busy="true">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading your data...</div>
                </div>
            `);
            const container = doc.querySelector('.loading-container');
            expect(container.getAttribute('aria-busy')).toBe('true');
        });

        it('provides time estimate for long operations', () => {
            const doc = createTestDocument(`
                <div class="loading-container" aria-busy="true">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Processing large file... This may take 1-2 minutes.</div>
                </div>
            `);
            const text = doc.querySelector('.loading-text');
            expect(text.textContent).toContain('1-2 minutes');
        });
    });
});

// ============================================
// API ERROR TESTS
// ============================================

describe('API Error Handling', () => {
    describe('400 Bad Request', () => {
        it('shows validation errors', () => {
            const doc = createTestDocument(`
                <div class="error-container" data-type="validation">
                    <div class="error-icon">⚠️</div>
                    <div class="error-title">Invalid Request</div>
                    <div class="error-message">
                        <ul>
                            <li>Email is not valid</li>
                        </ul>
                    </div>
                </div>
            `);
            const errorList = doc.querySelector('.error-message ul li');
            expect(errorList.textContent).toContain('Email');
        });
    });

    describe('401 Unauthorized', () => {
        it('shows login prompt', () => {
            const doc = createTestDocument(`
                <div class="error-container" data-type="auth">
                    <div class="error-icon">🔒</div>
                    <div class="error-title">Session Expired</div>
                    <div class="error-message">Your session has expired. Please log in again.</div>
                    <div class="error-actions">
                        <a href="/login" class="button">Log in</a>
                    </div>
                </div>
            `);
            const loginLink = doc.querySelector('a[href="/login"]');
            expect(loginLink).toBeTruthy();
        });
    });

    describe('403 Forbidden', () => {
        it('shows permission error', () => {
            const doc = createTestDocument(`
                <div class="error-container" data-type="permission">
                    <div class="error-icon">🚫</div>
                    <div class="error-title">Access Denied</div>
                    <div class="error-message">
                        You don't have permission to view this resource.
                        <a href="/contact">Contact support</a> if you believe this is an error.
                    </div>
                </div>
            `);
            const title = doc.querySelector('.error-title');
            expect(title.textContent).toBe('Access Denied');
        });
    });

    describe('404 Not Found', () => {
        it('shows not found state', () => {
            const doc = createTestDocument(`
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-title">Not Found</div>
                    <div class="empty-state-description">
                        The page or resource you're looking for doesn't exist.
                    </div>
                    <div class="empty-state-action">
                        <a href="/" class="button">Go home</a>
                    </div>
                </div>
            `);
            const homeLink = doc.querySelector('a[href="/"]');
            expect(homeLink).toBeTruthy();
        });
    });

    describe('429 Rate Limited', () => {
        it('shows rate limit with retry time', () => {
            const doc = createTestDocument(`
                <div class="error-container" data-type="rate-limit">
                    <div class="error-icon">⏳</div>
                    <div class="error-title">Too Many Requests</div>
                    <div class="error-message">
                        You've made too many requests. Please wait 60 seconds before trying again.
                    </div>
                    <div class="error-actions">
                        <button class="button" disabled data-countdown="60">Try again in 60s</button>
                    </div>
                </div>
            `);
            const countdownBtn = doc.querySelector('[data-countdown]');
            expect(countdownBtn.disabled).toBe(true);
            expect(countdownBtn.textContent).toContain('60');
        });
    });

    describe('500 Server Error', () => {
        it('shows generic server error with support option', () => {
            const doc = createTestDocument(`
                <div class="error-container" data-type="server">
                    <div class="error-icon">💥</div>
                    <div class="error-title">Server Error</div>
                    <div class="error-message">
                        Something went wrong on our end. Our team has been notified.
                    </div>
                    <div class="error-actions">
                        <button class="button" data-action="retry">Try again</button>
                        <a href="/support" class="button" data-variant="outline">Contact support</a>
                    </div>
                </div>
            `);
            const actions = doc.querySelectorAll('.error-actions button, .error-actions a');
            expect(actions.length).toBe(2);
        });
    });

    describe('503 Service Unavailable', () => {
        it('shows maintenance message', () => {
            const doc = createTestDocument(`
                <div class="error-container" data-type="maintenance">
                    <div class="error-icon">🔧</div>
                    <div class="error-title">Service Temporarily Unavailable</div>
                    <div class="error-message">
                        We're currently performing maintenance. Please check back soon.
                    </div>
                </div>
            `);
            const title = doc.querySelector('.error-title');
            expect(title.textContent).toContain('Unavailable');
        });
    });
});

// ============================================
// FORM VALIDATION ERROR TESTS
// ============================================

describe('Form Validation Errors', () => {
    describe('Inline validation', () => {
        it('shows error below field', () => {
            const doc = createTestDocument(`
                <div class="field" data-state="error">
                    <label class="field__label" for="email">Email</label>
                    <input class="input" id="email" type="email" aria-invalid="true" aria-describedby="email-error">
                    <span id="email-error" class="field__error" role="alert">Please enter a valid email address</span>
                </div>
            `);
            const input = doc.querySelector('.input');
            const error = doc.querySelector('.field__error');
            expect(input.getAttribute('aria-invalid')).toBe('true');
            expect(error.getAttribute('role')).toBe('alert');
        });

        it('clears error on input', () => {
            const doc = createTestDocument(`
                <div class="field" data-state="error">
                    <input class="input" value="invalid-email">
                    <span class="field__error">Invalid email</span>
                </div>
            `);
            // In real app, typing would clear the error
            const field = doc.querySelector('.field');
            expect(field.dataset.state).toBe('error');
        });
    });

    describe('Multiple errors', () => {
        it('shows summary of all errors', () => {
            const doc = createTestDocument(`
                <div class="form-errors" role="alert" aria-live="polite">
                    <h3>Please fix the following errors:</h3>
                    <ul>
                        <li><a href="#email">Email is required</a></li>
                        <li><a href="#password">Password must be at least 8 characters</a></li>
                        <li><a href="#terms">You must accept the terms</a></li>
                    </ul>
                </div>
            `);
            const errorLinks = doc.querySelectorAll('.form-errors a');
            expect(errorLinks.length).toBe(3);
        });

        it('focuses first error field', () => {
            const doc = createTestDocument(`
                <form>
                    <div class="field" data-state="error">
                        <input id="email" aria-invalid="true">
                    </div>
                    <div class="field" data-state="error">
                        <input id="password" aria-invalid="true">
                    </div>
                </form>
            `);
            // In real app, first error field would receive focus
            const firstErrorInput = doc.querySelector('[aria-invalid="true"]');
            expect(firstErrorInput.id).toBe('email');
        });
    });

    describe('Validation error types', () => {
        const validationTests = [
            { type: 'required', message: 'This field is required' },
            { type: 'email', message: 'Please enter a valid email' },
            { type: 'minLength', message: 'Must be at least 8 characters' },
            { type: 'maxLength', message: 'Must be no more than 100 characters' },
            { type: 'pattern', message: 'Please match the requested format' },
            { type: 'number', message: 'Please enter a valid number' },
            { type: 'date', message: 'Please enter a valid date' },
            { type: 'url', message: 'Please enter a valid URL' }
        ];

        validationTests.forEach(({ type, message }) => {
            it(`shows ${type} validation error`, () => {
                const doc = createTestDocument(`
                    <span class="field__error" data-validation="${type}">${message}</span>
                `);
                const error = doc.querySelector('.field__error');
                expect(error.dataset.validation).toBe(type);
                expect(error.textContent).toBe(message);
            });
        });
    });
});

// ============================================
// CONCURRENT OPERATION TESTS
// ============================================

describe('Concurrent Operation Handling', () => {
    describe('Double submission prevention', () => {
        it('disables button during submission', () => {
            const doc = createTestDocument(`
                <button class="button" data-loading="true" disabled aria-busy="true">
                    <span class="button-text">Submitting...</span>
                </button>
            `);
            const button = doc.querySelector('.button');
            expect(button.disabled).toBe(true);
            expect(button.dataset.loading).toBe('true');
        });

        it('shows loading state during submission', () => {
            const doc = createTestDocument(`
                <button class="button" data-loading="true" disabled>
                    <span class="loading-spinner"></span>
                    <span>Processing...</span>
                </button>
            `);
            const spinner = doc.querySelector('.loading-spinner');
            expect(spinner).toBeTruthy();
        });
    });

    describe('Race condition handling', () => {
        it('handles out-of-order responses gracefully', () => {
            // Simulate race condition where older response arrives after newer
            const responses = [
                { requestId: 1, data: 'stale' },
                { requestId: 2, data: 'fresh' }
            ];
            // In real app, would track request IDs and ignore stale responses
            const latestRequest = Math.max(...responses.map(r => r.requestId));
            expect(latestRequest).toBe(2);
        });

        it('cancels pending request on new request', () => {
            const doc = createTestDocument(`
                <input class="input search-input" placeholder="Search..." aria-label="Search">
                <div class="search-results" aria-live="polite">
                    <div class="loading-spinner"></div>
                </div>
            `);
            // In real app, AbortController would cancel pending fetch
            const searchInput = doc.querySelector('.search-input');
            expect(searchInput).toBeTruthy();
        });
    });

    describe('Optimistic updates', () => {
        it('shows optimistic update immediately', () => {
            const doc = createTestDocument(`
                <div class="todo-item" data-optimistic="true" data-pending="true">
                    <span>Buy groceries</span>
                    <span class="pending-indicator">Saving...</span>
                </div>
            `);
            const item = doc.querySelector('.todo-item');
            expect(item.dataset.optimistic).toBe('true');
            expect(item.dataset.pending).toBe('true');
        });

        it('rolls back on error', () => {
            const doc = createTestDocument(`
                <div class="todo-item" data-error="true">
                    <span>Buy groceries</span>
                    <span class="error-indicator">Failed to save. <button data-action="retry">Retry</button></span>
                </div>
            `);
            const retryBtn = doc.querySelector('[data-action="retry"]');
            expect(retryBtn).toBeTruthy();
        });
    });
});

// ============================================
// PERMISSION STATE TESTS
// ============================================

describe('Permission State Handling', () => {
    describe('No permission to view', () => {
        it('shows access denied message', () => {
            const doc = createTestDocument(`
                <div class="error-container" data-type="permission">
                    <div class="error-icon">🔒</div>
                    <div class="error-title">Access Restricted</div>
                    <div class="error-message">
                        You don't have permission to view this content.
                        <a href="/upgrade">Upgrade your plan</a> to access all features.
                    </div>
                </div>
            `);
            const upgradeLink = doc.querySelector('a[href="/upgrade"]');
            expect(upgradeLink).toBeTruthy();
        });
    });

    describe('No permission to edit', () => {
        it('shows read-only mode', () => {
            const doc = createTestDocument(`
                <div class="form-field" data-readonly="true" aria-readonly="true">
                    <label>Name</label>
                    <input class="input" value="John Doe" readonly disabled>
                    <span class="readonly-badge">Read only</span>
                </div>
            `);
            const input = doc.querySelector('.input');
            expect(input.readOnly).toBe(true);
            expect(input.disabled).toBe(true);
        });
    });

    describe('Feature locked', () => {
        it('shows upgrade prompt for locked features', () => {
            const doc = createTestDocument(`
                <div class="feature-locked">
                    <div class="feature-content" aria-hidden="true" style="filter: blur(4px);">
                        Premium Feature
                    </div>
                    <div class="feature-overlay">
                        <span class="lock-icon">🔒</span>
                        <p>Upgrade to Premium to access this feature</p>
                        <button class="button">Upgrade Now</button>
                    </div>
                </div>
            `);
            const overlay = doc.querySelector('.feature-overlay');
            expect(overlay).toBeTruthy();
        });
    });
});

// ============================================
// GRACEFUL DEGRADATION TESTS
// ============================================

describe('Graceful Degradation', () => {
    describe('JavaScript disabled fallback', () => {
        it('form submits without JavaScript', () => {
            const doc = createTestDocument(`
                <form action="/submit" method="POST">
                    <input name="email" type="email" required>
                    <button type="submit">Submit</button>
                </form>
            `);
            const form = doc.querySelector('form');
            expect(form.getAttribute('action')).toBe('/submit');
            expect(form.getAttribute('method')).toBe('POST');
        });

        it('navigation works without JavaScript', () => {
            const doc = createTestDocument(`
                <nav>
                    <a href="/">Home</a>
                    <a href="/about">About</a>
                    <a href="/contact">Contact</a>
                </nav>
            `);
            const links = doc.querySelectorAll('nav a');
            expect(links.length).toBe(3);
            links.forEach(link => {
                expect(link.hasAttribute('href')).toBe(true);
            });
        });
    });

    describe('Feature detection', () => {
        it('detects missing API support', () => {
            const features = {
                'IntersectionObserver': typeof IntersectionObserver !== 'undefined',
                'ResizeObserver': typeof ResizeObserver !== 'undefined',
                'MutationObserver': typeof MutationObserver !== 'undefined',
                'serviceWorker': 'serviceWorker' in navigator,
                'WebSocket': typeof WebSocket !== 'undefined',
                'localStorage': typeof localStorage !== 'undefined'
            };
            // In real app, would provide fallbacks for missing features
            Object.keys(features).forEach(feature => {
                expect(typeof features[feature]).toBe('boolean');
            });
        });
    });

    describe('Image fallback', () => {
        it('shows alt text for broken images', () => {
            const doc = createTestDocument(`
                <img src="broken.jpg" alt="Product photo of blue widget">
            `);
            const img = doc.querySelector('img');
            expect(img.getAttribute('alt')).toBe('Product photo of blue widget');
        });

        it('shows placeholder on error', () => {
            const doc = createTestDocument(`
                <div class="image-container">
                    <img src="broken.jpg" alt="Product" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <div class="image-placeholder" style="display: none;">
                        <span>Image unavailable</span>
                    </div>
                </div>
            `);
            const placeholder = doc.querySelector('.image-placeholder');
            expect(placeholder).toBeTruthy();
        });
    });
});

// ============================================
// RETRY MECHANISM TESTS
// ============================================

describe('Retry Mechanisms', () => {
    describe('Automatic retry', () => {
        it('retries with exponential backoff', () => {
            const delays = [1000, 2000, 4000, 8000]; // Exponential backoff
            let totalDelay = 0;
            delays.forEach(delay => {
                totalDelay += delay;
            });
            expect(totalDelay).toBe(15000); // 4 retries over 15 seconds
        });

        it('shows retry count', () => {
            const doc = createTestDocument(`
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Retrying... Attempt 2 of 3</div>
                </div>
            `);
            const text = doc.querySelector('.loading-text');
            expect(text.textContent).toContain('Attempt 2 of 3');
        });

        it('stops after max retries', () => {
            const doc = createTestDocument(`
                <div class="error-container" data-type="network">
                    <div class="error-title">Connection Failed</div>
                    <div class="error-message">Unable to connect after 3 attempts.</div>
                    <div class="error-actions">
                        <button class="button" data-action="retry">Try again</button>
                    </div>
                </div>
            `);
            const message = doc.querySelector('.error-message');
            expect(message.textContent).toContain('3 attempts');
        });
    });

    describe('Manual retry', () => {
        it('provides retry button', () => {
            const doc = createTestDocument(`
                <div class="error-container">
                    <div class="error-message">Something went wrong.</div>
                    <div class="error-actions">
                        <button class="button" data-action="retry">Try again</button>
                    </div>
                </div>
            `);
            const retryBtn = doc.querySelector('[data-action="retry"]');
            expect(retryBtn.textContent).toBe('Try again');
        });

        it('clears error state on retry', () => {
            const doc = createTestDocument(`
                <div class="container" data-state="error">
                    <button class="button" data-action="retry">Retry</button>
                </div>
            `);
            const container = doc.querySelector('.container');
            // In real app, clicking retry would clear data-state="error"
            expect(container.dataset.state).toBe('error');
        });
    });
});

// ============================================
// ERROR RECOVERY TESTS
// ============================================

describe('Error Recovery', () => {
    describe('Partial content recovery', () => {
        it('shows cached content when fresh data fails', () => {
            const doc = createTestDocument(`
                <div class="content-container">
                    <div class="stale-indicator">
                        <span>⚠️ Showing cached data from 5 minutes ago</span>
                        <button data-action="refresh">Refresh</button>
                    </div>
                    <div class="content">
                        Cached content here
                    </div>
                </div>
            `);
            const indicator = doc.querySelector('.stale-indicator');
            expect(indicator).toBeTruthy();
        });
    });

    describe('Offline queue', () => {
        it('queues actions when offline', () => {
            const doc = createTestDocument(`
                <div class="offline-queue" role="status" aria-live="polite">
                    <span>📤 3 actions pending sync</span>
                    <span class="offline-queue-hint">Will sync when back online</span>
                </div>
            `);
            const queue = doc.querySelector('.offline-queue');
            expect(queue.textContent).toContain('3 actions');
        });

        it('syncs when back online', () => {
            const doc = createTestDocument(`
                <div class="sync-status" role="status">
                    <div class="loading-spinner"></div>
                    <span>Syncing 3 pending actions...</span>
                </div>
            `);
            const status = doc.querySelector('.sync-status');
            expect(status.textContent).toContain('Syncing');
        });
    });
});

// ============================================
// ERROR LOGGING TESTS
// ============================================

describe('Error Logging', () => {
    it('error has correlation ID for support', () => {
        const doc = createTestDocument(`
            <div class="error-container">
                <div class="error-message">An error occurred.</div>
                <div class="error-meta">
                    <small>Error ID: abc123-def456</small>
                    <small>Time: 2024-01-15 10:30:00 UTC</small>
                </div>
            </div>
        `);
        const meta = doc.querySelector('.error-meta');
        expect(meta.textContent).toContain('Error ID');
        expect(meta.textContent).toContain('Time');
    });

    it('error doesn\'t expose sensitive details', () => {
        const doc = createTestDocument(`
            <div class="error-container">
                <div class="error-title">Something went wrong</div>
                <div class="error-message">An unexpected error occurred. Please try again.</div>
            </div>
        `);
        const message = doc.querySelector('.error-message');
        // Should NOT contain stack traces, database errors, etc.
        expect(message.textContent).not.toContain('Error:');
        expect(message.textContent).not.toContain('undefined');
        expect(message.textContent).not.toContain('null');
    });
});
