/**
 * CSMA Form Validation Component
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 *
 * Features:
 * - Required field validation
 * - Email, number, pattern validation
 * - Custom validation rules
 * - Error message display
 * - Form submission handling
 */

const csma = window.csma || {};
const eventBus = csma.eventBus;

/**
 * Validation rules
 */
const validators = {
    required: (value) => {
        if (value === null || value === undefined || value === '') {
            return 'This field is required';
        }
        return null;
    },

    email: (value) => {
        if (!value) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return 'Please enter a valid email address';
        }
        return null;
    },

    number: (value) => {
        if (!value) return null;
        if (isNaN(parseFloat(value)) || !isFinite(value)) {
            return 'Please enter a valid number';
        }
        return null;
    },

    min: (value, min) => {
        if (!value) return null;
        const num = parseFloat(value);
        if (num < parseFloat(min)) {
            return `Value must be at least ${min}`;
        }
        return null;
    },

    max: (value, max) => {
        if (!value) return null;
        const num = parseFloat(value);
        if (num > parseFloat(max)) {
            return `Value must be at most ${max}`;
        }
        return null;
    },

    minLength: (value, minLength) => {
        if (!value) return null;
        if (value.length < parseInt(minLength)) {
            return `Must be at least ${minLength} characters`;
        }
        return null;
    },

    maxLength: (value, maxLength) => {
        if (!value) return null;
        if (value.length > parseInt(maxLength)) {
            return `Must be at most ${maxLength} characters`;
        }
        return null;
    },

    pattern: (value, pattern) => {
        if (!value) return null;
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
            return 'Please match the required format';
        }
        return null;
    },

    url: (value) => {
        if (!value) return null;
        try {
            new URL(value);
            return null;
        } catch {
            return 'Please enter a valid URL';
        }
    },

    tel: (value) => {
        if (!value) return null;
        const telRegex = /^[\d\s\-\+\(\)]+$/;
        if (!telRegex.test(value)) {
            return 'Please enter a valid phone number';
        }
        return null;
    }
};

/**
 * Form Component Class
 */
export class Form {
    constructor(eventBus) {
        this.eventBus = eventBus || csma.eventBus;
        this.form = null;
        this.fields = new Map();
        this.isValid = false;

        // Bind methods
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
    }

    /**
     * Initialize form
     * @param {HTMLElement} formElement - The form element
     * @returns {Function} Cleanup function
     */
    init(formElement) {
        this.form = formElement;
        if (!this.form) {
            console.warn('[Form] Form element not provided');
            return () => {};
        }

        // Find all form fields
        const fieldWrappers = this.form.querySelectorAll('.form-field');
        fieldWrappers.forEach(wrapper => {
            const input = wrapper.querySelector('input, textarea, select');
            if (input) {
                const fieldConfig = this.parseFieldConfig(wrapper, input);
                this.fields.set(input, fieldConfig);

                // Setup event listeners
                input.addEventListener('input', this.handleInput);
                input.addEventListener('blur', this.handleBlur);
            }
        });

        // Form submission
        this.form.addEventListener('submit', this.handleSubmit);

        // Prevent form submission on enter for invalid fields
        this.form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.matches('input, textarea')) {
                const field = this.fields.get(e.target);
                if (field && !this.validateField(e.target, field)) {
                    e.preventDefault();
                }
            }
        });

        // Subscribe to EventBus
        if (this.eventBus?.subscribe) {
            this.unsubscribe = this.eventBus.subscribe('FORM_RESET', () => this.reset());
        }

        return () => this.cleanup();
    }

    /**
     * Parse field configuration from data attributes
     */
    parseFieldConfig(wrapper, input) {
        const config = {
            wrapper: wrapper,
            input: input,
            rules: [],
            customMessages: {}
        };

        // Check for required
        if (input.required || wrapper.dataset.required === 'true' || input.dataset.required === 'true') {
            config.rules.push({ type: 'required' });
        }

        // Check data-validate attribute
        const validate = input.dataset.validate || wrapper.dataset.validate;
        if (validate) {
            validate.split(',').forEach(rule => {
                const [type, param] = rule.trim().split(':');
                config.rules.push({ type, param });
            });
        }

        // Check for type-based validation
        const type = input.type;
        if (type === 'email') config.rules.push({ type: 'email' });
        if (type === 'url') config.rules.push({ type: 'url' });
        if (type === 'tel') config.rules.push({ type: 'tel' });
        if (type === 'number') config.rules.push({ type: 'number' });

        // Check min/max
        if (input.min !== '') config.rules.push({ type: 'min', param: input.min });
        if (input.max !== '') config.rules.push({ type: 'max', param: input.max });
        if (input.minLength !== -1) config.rules.push({ type: 'minLength', param: input.minLength });
        if (input.maxLength !== -1) config.rules.push({ type: 'maxLength', param: input.maxLength });
        if (input.pattern) config.rules.push({ type: 'pattern', param: input.pattern });

        // Get custom error message
        config.customMessage = wrapper.dataset.error || input.dataset.error || '';

        return config;
    }

    /**
     * Handle input event (real-time validation)
     */
    handleInput(event) {
        const input = event.target;
        const field = this.fields.get(input);
        if (!field) return;

        // Clear error on input
        if (field.wrapper.dataset.state === 'error') {
            this.clearError(input, field);
        }
    }

    /**
     * Handle blur event (validate on leave)
     */
    handleBlur(event) {
        const input = event.target;
        const field = this.fields.get(input);
        if (!field) return;

        this.validateField(input, field);
    }

    /**
     * Validate a single field
     */
    validateField(input, field) {
        const value = input.value;
        let error = null;

        for (const rule of field.rules) {
            const validator = validators[rule.type];
            if (validator) {
                error = validator(value, rule.param);
                if (error) break;
            }
        }

        if (error) {
            this.showError(input, field, error);
            return false;
        } else {
            this.clearError(input, field);
            return true;
        }
    }

    /**
     * Show error message
     */
    showError(input, field, message) {
        field.wrapper.dataset.state = 'error';

        // Find or create error element
        let errorEl = field.wrapper.querySelector('.form-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'form-error';
            field.wrapper.appendChild(errorEl);
        }

        errorEl.textContent = field.customMessage || message;

        // Publish error event
        if (this.eventBus?.publish) {
            this.eventBus.publish('FORM_FIELD_ERROR', {
                field: input.name || input.id,
                message: message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Clear error message
     */
    clearError(input, field) {
        field.wrapper.dataset.state = '';

        const errorEl = field.wrapper.querySelector('.form-error');
        if (errorEl) {
            errorEl.remove();
        }

        // Publish clear error event
        if (this.eventBus?.publish) {
            this.eventBus.publish('FORM_FIELD_CLEARED', {
                field: input.name || input.id,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Handle form submission
     */
    handleSubmit(event) {
        event.preventDefault();

        let isValid = true;
        const formData = new FormData();
        const errors = [];

        this.fields.forEach((field, input) => {
            const fieldValid = this.validateField(input, field);
            if (!fieldValid) {
                isValid = false;
                errors.push({
                    field: input.name || input.id,
                    message: field.wrapper.querySelector('.form-error')?.textContent
                });
            }
            formData.append(input.name || input.id, input.value);
        });

        if (isValid) {
            this.form.dataset.state = 'valid';

            // Publish submit intent
            if (this.eventBus?.publish) {
                this.eventBus.publish('INTENT_FORM_SUBMIT', {
                    data: Object.fromEntries(formData),
                    timestamp: Date.now()
                });
            }

            // Dispatch custom event
            this.form.dispatchEvent(new CustomEvent('form:valid', {
                bubbles: true,
                detail: { data: Object.fromEntries(formData) }
            }));

            // Call original handler if exists
            const submitHandler = this.form.dataset.submitHandler;
            if (submitHandler && typeof window[submitHandler] === 'function') {
                window[submitHandler](Object.fromEntries(formData));
            }
        } else {
            this.form.dataset.state = 'error';

            // Focus first error field
            const firstError = this.form.querySelector('.form-field[data-state="error"] input');
            if (firstError) firstError.focus();

            // Publish validation error
            if (this.eventBus?.publish) {
                this.eventBus.publish('FORM_VALIDATION_ERROR', {
                    errors: errors,
                    timestamp: Date.now()
                });
            }
        }

        this.isValid = isValid;
        return isValid;
    }

    /**
     * Reset form
     */
    reset() {
        this.form.reset();
        this.fields.forEach((field, input) => {
            this.clearError(input, field);
        });
        this.form.dataset.state = '';
        this.isValid = false;
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.fields.forEach((field, input) => {
            input.removeEventListener('input', this.handleInput);
            input.removeEventListener('blur', this.handleBlur);
        });

        if (this.form) {
            this.form.removeEventListener('submit', this.handleSubmit);
        }

        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.form = null;
        this.fields.clear();
    }
}

/**
 * Initialize a single form
 */
export function initForm(formElement, eventBus) {
    const form = new Form(eventBus);
    return form.init(formElement);
}

/**
 * Initialize all forms on the page
 */
export function initFormUI(eventBus) {
    const forms = document.querySelectorAll('form:not([data-initialized])');
    const cleanupFunctions = [];

    forms.forEach(form => {
        const cleanup = initForm(form, eventBus);
        cleanupFunctions.push(cleanup);
        form.dataset.initialized = 'true';
    });

    return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
    };
}

/**
 * Validate a single input
 */
export function validateInput(input, rules) {
    const value = input.value;
    let error = null;

    for (const rule of rules) {
        const validator = validators[rule.type];
        if (validator) {
            error = validator(value, rule.param);
            if (error) break;
        }
    }

    return error;
}
