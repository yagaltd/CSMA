/**
 * CSMA OTP Component
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 *
 * Features:
 * - Auto-focus next input on digit entry
 * - Backspace navigation to previous input
 * - Paste full code functionality
 * - EventBus integration
 */

const csma = window.csma || {};
const eventBus = csma.eventBus;

/**
 * OTP Component Class
 * Handles OTP input interactions and EventBus communication
 */
export class OTP {
    constructor(eventBus) {
        this.eventBus = eventBus || csma.eventBus;
        this.form = null;
        this.inputs = [];
        this.statusEl = null;
        this.resendEl = null;
        this.otpLength = 6;
        this.inputHandlers = new Map();
        this.unsubscribeState = null;
        this.pendingTimers = new Set();

        // Bind methods
        this.handleInput = this.handleInput.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handlePaste = this.handlePaste.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleResend = this.handleResend.bind(this);
    }

    /**
     * Initialize OTP component
     * @param {HTMLElement} formElement - The form element containing OTP inputs
     * @returns {Function} Cleanup function
     */
    init(formElement) {
        this.form = formElement;
        if (!this.form) {
            console.warn('[OTP] Form element not provided');
            return () => {};
        }

        this.inputs = Array.from(this.form.querySelectorAll('[data-otp-input]'));
        this.statusEl = this.form.querySelector('[data-otp-status]');
        this.resendEl = this.form.querySelector('[data-otp-resend]');
        this.otpLength = this.inputs.length || 6;

        if (!this.inputs.length) {
            console.warn('[OTP] No OTP inputs found');
            return () => {};
        }

        // Setup event listeners
        this.inputs.forEach((input, index) => {
            const handlers = {
                input: () => this.handleInput(input, index),
                keydown: (event) => this.handleKeydown(event, index)
            };
            this.inputHandlers.set(input, handlers);
            input.addEventListener('input', handlers.input);
            input.addEventListener('keydown', handlers.keydown);
            input.addEventListener('paste', this.handlePaste);
        });

        if (this.form) {
            this.form.addEventListener('submit', this.handleSubmit);
        }

        if (this.resendEl) {
            this.resendEl.addEventListener('click', this.handleResend);
        }

        this.updateStatus('idle', 'Idle');

        // Subscribe to EventBus events
        if (this.eventBus?.subscribe) {
            this.unsubscribeState?.();
            this.unsubscribeState = this.eventBus.subscribe(
                'OTP_STATE_UPDATED',
                ({ status, message }) => this.updateStatus(status, message)
            );
        }

        // Return cleanup function
        return () => this.cleanup();
    }

    /**
     * Sanitize input to single digit
     */
    sanitizeDigit(value) {
        return (value || '').replace(/\D/g, '').slice(-1);
    }

    /**
     * Handle input event
     */
    handleInput(input, index) {
        const digit = this.sanitizeDigit(input.value);
        input.value = digit;

        this.publishChange();
        this.updateStatus('idle', '');

        if (digit && index < this.inputs.length - 1) {
            this.inputs[index + 1].focus();
        }
    }

    /**
     * Handle keydown event
     */
    handleKeydown(event, index) {
        const key = event.key;

        if (key === 'Backspace' && !this.inputs[index].value && index > 0) {
            this.inputs[index - 1].focus();
            this.inputs[index - 1].value = '';
            this.publishChange();
        }

        if (key === 'ArrowLeft' && index > 0) {
            this.inputs[index - 1].focus();
        }

        if (key === 'ArrowRight' && index < this.inputs.length - 1) {
            this.inputs[index + 1].focus();
        }
    }

    /**
     * Handle paste event
     */
    handlePaste(event) {
        event.preventDefault();
        const data = (event.clipboardData?.getData('text') || '')
            .replace(/\D/g, '')
            .slice(0, this.otpLength);

        if (!data) return;

        this.inputs.forEach((input, idx) => {
            input.value = data[idx] || '';
        });

        const targetIndex = Math.min(data.length, this.inputs.length) - 1;
        if (targetIndex >= 0) {
            this.inputs[targetIndex].focus();
        }

        this.publishChange();
        this.updateStatus('idle', '');
    }

    /**
     * Get the current OTP code
     */
    getCode() {
        return this.inputs.map((input) => this.sanitizeDigit(input.value)).join('');
    }

    /**
     * Handle form submit
     */
    handleSubmit(event) {
        event.preventDefault();
        const code = this.getCode();

        if (code.length < this.otpLength) {
            this.updateStatus('error', `Enter ${this.otpLength} digits`);
            return;
        }

        this.updateStatus('loading', 'Verifying...');

        if (this.eventBus?.publish) {
            this.eventBus.publish('INTENT_OTP_SUBMIT', {
                code,
                length: this.otpLength,
                timestamp: Date.now()
            });
        }

        const otpClient = csma.otpClient || null;
        if (otpClient?.verify) {
            otpClient.verify({ code })
                .then(() => this.updateStatus('success', 'Code accepted'))
                .catch((error) => this.updateStatus('error', error?.message || 'Verification failed'));
            return;
        }

        const timerId = setTimeout(() => {
            this.pendingTimers.delete(timerId);
            this.updateStatus('success', 'Code submitted (mock)');
        }, 500);
        this.pendingTimers.add(timerId);
    }

    /**
     * Handle resend code
     */
    handleResend(event) {
        event.preventDefault();
        this.clearInputs();
        this.updateStatus('loading', 'Requesting new code...');

        if (this.eventBus?.publish) {
            this.eventBus.publish('INTENT_OTP_RESEND', { timestamp: Date.now() });
        }

        const timerId = setTimeout(() => {
            this.pendingTimers.delete(timerId);
            this.updateStatus('success', 'New code sent');
        }, 700);
        this.pendingTimers.add(timerId);
    }

    /**
     * Clear all inputs
     */
    clearInputs() {
        this.inputs.forEach((input) => { input.value = ''; });
        if (this.inputs[0]) this.inputs[0].focus();
        this.publishChange();
    }

    /**
     * Publish code change event
     */
    publishChange() {
        if (!this.eventBus?.publish) return;
        this.eventBus.publish('OTP_CODE_CHANGED', {
            code: this.getCode(),
            length: this.otpLength,
            timestamp: Date.now()
        });
    }

    /**
     * Update status display
     */
    updateStatus(state, message) {
        if (!this.statusEl) return;
        this.statusEl.dataset.state = state || 'idle';
        this.statusEl.textContent = message || 'Idle';
    }

    /**
     * Cleanup event listeners
     */
    cleanup() {
        this.inputs.forEach((input) => {
            const handlers = this.inputHandlers.get(input);
            if (handlers) {
                input.removeEventListener('input', handlers.input);
                input.removeEventListener('keydown', handlers.keydown);
            }
            input.removeEventListener('paste', this.handlePaste);
        });
        this.inputHandlers.clear();

        if (this.form) {
            this.form.removeEventListener('submit', this.handleSubmit);
        }

        if (this.resendEl) {
            this.resendEl.removeEventListener('click', this.handleResend);
        }

        this.unsubscribeState?.();
        this.unsubscribeState = null;
        this.pendingTimers.forEach((timerId) => clearTimeout(timerId));
        this.pendingTimers.clear();

        this.form = null;
        this.inputs = [];
        this.statusEl = null;
        this.resendEl = null;
    }
}

/**
 * Initialize a single OTP form
 * @param {HTMLElement} formElement - The OTP form element
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initOTP(formElement, eventBus) {
    const otp = new OTP(eventBus);
    return otp.init(formElement);
}

/**
 * Initialize all OTP forms on the page
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Master cleanup function
 */
export function initOTPUI(eventBus) {
    const forms = document.querySelectorAll('[data-otp-form]:not([data-initialized])');
    const cleanupFunctions = [];

    forms.forEach(form => {
        const cleanup = initOTP(form, eventBus);
        cleanupFunctions.push(cleanup);
        form.dataset.initialized = 'true';
    });

    return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
        forms.forEach((form) => {
            delete form.dataset.initialized;
        });
    };
}

/**
 * Auto-initialize if running as script
 */
if (typeof window !== 'undefined') {
    const form = document.querySelector('[data-otp-form]');
    const inputs = Array.from(document.querySelectorAll('[data-otp-input]'));
    const statusEl = document.querySelector('[data-otp-status]');
    const resendEl = document.querySelector('[data-otp-resend]');

    if (form && inputs.length) {
        const otpInstance = new OTP(window.csma?.eventBus || eventBus);
        otpInstance.init(form);
    }
}
