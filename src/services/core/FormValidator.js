/**
 * FormValidator - Real-time form validation with contracts
 * Integrates with CSMA validation library
 * ~150 lines, ~1.5KB gzipped
 */

export class FormValidator {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.debounceDelay = options.debounceDelay || 300; // 300ms default
        this.debug = options.debug ?? false;

        // Registered form schemas
        this.forms = new Map();

        // Field errors
        this.fieldErrors = new Map();

        // Form errors
        this.formErrors = new Map();

        // Touched fields (for showing errors)
        this.touchedFields = new Set();

        // Debounce timers
        this.debounceTimers = new Map();
    }

    /**
     * Register form with validation schema
     */
    register(formId, schema, options = {}) {
        this.forms.set(formId, {
            schema,
            options: {
                validateOnBlur: options.validateOnBlur ?? true,
                validateOnInput: options.validateOnInput ?? true,
                showErrorsOnlyWhenTouched: options.showErrorsOnlyWhenTouched ?? true
            }
        });

        this.fieldErrors.set(formId, new Map());
        this.formErrors.set(formId, []);

        this.log('Registered form:', formId);
    }

    /**
     * Validate single field
     */
    async validateField(formId, fieldName, value, options = {}) {
        const form = this.forms.get(formId);
        if (!form) {
            throw new Error(`Form ${formId} not registered`);
        }

        const startTime = Date.now();

        this.eventBus.publish('FIELD_VALIDATION_STARTED', {
            formId,
            fieldName,
            timestamp: startTime
        });

        // Get field schema
        const fieldSchema = form.schema.schema[fieldName];
        if (!fieldSchema) {
            this.log('No schema for field:', fieldName);
            return { valid: true, errors: [] };
        }

        // Validate
        const [error] = fieldSchema.validate(value);

        const duration = Date.now() - startTime;

        if (error) {
            const errors = error.failures().map(f => f.message);

            // Store errors
            this.fieldErrors.get(formId).set(fieldName, errors);

            this.eventBus.publish('FIELD_VALIDATION_FAILED', {
                formId,
                fieldName,
                errors,
                duration,
                timestamp: Date.now()
            });

            this.log(`✗ Field ${fieldName}:`, errors);

            return { valid: false, errors };
        }

        // Clear errors
        this.fieldErrors.get(formId).delete(fieldName);

        this.eventBus.publish('FIELD_VALIDATION_PASSED', {
            formId,
            fieldName,
            value,
            duration,
            timestamp: Date.now()
        });

        this.log(`✓ Field ${fieldName}`);

        return { valid: true, errors: [] };
    }

    /**
     * Validate entire form
     */
    async validateForm(formId, data) {
        const form = this.forms.get(formId);
        if (!form) {
            throw new Error(`Form ${formId} not registered`);
        }

        const startTime = Date.now();

        this.log('Validating form:', formId);

        // Validate with schema
        const [error, validated] = form.schema.validate(data);

        const duration = Date.now() - startTime;

        if (error) {
            const failures = error.failures();

            // Group errors by field
            const fieldErrorsMap = new Map();
            failures.forEach(f => {
                const field = f.path[0];
                if (!fieldErrorsMap.has(field)) {
                    fieldErrorsMap.set(field, []);
                }
                fieldErrorsMap.get(field).push(f.message);
            });

            // Store errors
            this.fieldErrors.set(formId, fieldErrorsMap);
            this.formErrors.set(formId, failures.map(f => f.message));

            this.eventBus.publish('FORM_VALIDATION_FAILED', {
                formId,
                errors: Object.fromEntries(fieldErrorsMap),
                duration,
                timestamp: Date.now()
            });

            this.log('✗ Form validation failed:', failures.length, 'errors');

            return {
                valid: false,
                errors: Object.fromEntries(fieldErrorsMap),
                data: null
            };
        }

        // Clear errors
        this.fieldErrors.get(formId).clear();
        this.formErrors.set(formId, []);

        this.eventBus.publish('FORM_VALIDATION_PASSED', {
            formId,
            data: validated,
            duration,
            timestamp: Date.now()
        });

        this.log('✓ Form validation passed');

        return {
            valid: true,
            errors: {},
            data: validated
        };
    }

    /**
     * Validate field with debounce (for real-time input)
     */
    validateFieldDebounced(formId, fieldName, value) {
        // Clear existing timer
        const timerKey = `${formId}:${fieldName}`;
        if (this.debounceTimers.has(timerKey)) {
            clearTimeout(this.debounceTimers.get(timerKey));
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.validateField(formId, fieldName, value);
            this.debounceTimers.delete(timerKey);
        }, this.debounceDelay);

        this.debounceTimers.set(timerKey, timer);
    }

    /**
     * Get field errors
     */
    getFieldErrors(formId, fieldName) {
        const form = this.forms.get(formId);
        if (!form) return [];

        const errors = this.fieldErrors.get(formId)?.get(fieldName) || [];

        // Only show if touched (if option enabled)
        if (form.options.showErrorsOnlyWhenTouched) {
            const touched = this.touchedFields.has(`${formId}:${fieldName}`);
            return touched ? errors : [];
        }

        return errors;
    }

    /**
     * Get all form errors
     */
    getFormErrors(formId) {
        return this.formErrors.get(formId) || [];
    }

    /**
     * Clear field errors
     */
    clearFieldErrors(formId, fieldName) {
        this.fieldErrors.get(formId)?.delete(fieldName);
        this.log('Cleared errors for field:', fieldName);
    }

    /**
     * Clear all form errors
     */
    clearFormErrors(formId) {
        this.fieldErrors.get(formId)?.clear();
        this.formErrors.set(formId, []);
        this.log('Cleared all errors for form:', formId);
    }

    /**
     * Mark field as touched
     */
    markAsTouched(formId, fieldName) {
        this.touchedFields.add(`${formId}:${fieldName}`);
    }

    /**
     * Check if form is valid
     */
    isValid(formId) {
        const fieldErrors = this.fieldErrors.get(formId);
        return !fieldErrors || fieldErrors.size === 0;
    }

    /**
     * Bind to form element (convenience method)
     */
    bindToForm(formElement, formId) {
        const form = this.forms.get(formId);
        if (!form) {
            throw new Error(`Form ${formId} not registered`);
        }

        // Validate on submit
        formElement.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(formElement);
            const data = Object.fromEntries(formData.entries());

            const result = await this.validateForm(formId, data);

            if (result.valid) {
                // Dispatch custom event with validated data
                formElement.dispatchEvent(new CustomEvent('validated', {
                    detail: result.data
                }));
            } else {
                // Update UI with errors
                this.updateFormUI(formElement, formId);
            }
        });

        // Validate fields on input/blur
        const inputs = formElement.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            const fieldName = input.name;

            if (form.options.validateOnInput) {
                input.addEventListener('input', (e) => {
                    this.validateFieldDebounced(formId, fieldName, e.target.value);
                });
            }

            if (form.options.validateOnBlur) {
                input.addEventListener('blur', (e) => {
                    this.markAsTouched(formId, fieldName);
                    this.validateField(formId, fieldName, e.target.value);
                });
            }
        });

        this.log('Bound to form element:', formId);
    }

    /**
     * Update form UI with errors (ARIA)
     */
    updateFormUI(formElement, formId) {
        const fieldErrors = this.fieldErrors.get(formId);

        fieldErrors.forEach((errors, fieldName) => {
            const input = formElement.querySelector(`[name="${fieldName}"]`);
            if (!input) return;

            // Mark input as invalid
            input.setAttribute('aria-invalid', 'true');

            // Find or create error container
            let errorContainer = input.parentElement.querySelector('.field-errors');
            if (!errorContainer) {
                errorContainer = document.createElement('div');
                errorContainer.className = 'field-errors';
                errorContainer.setAttribute('role', 'alert');
                input.parentElement.appendChild(errorContainer);
            }

            // Update error messages
            errorContainer.innerHTML = errors.map(err =>
                `<span class="error-message">${err}</span>`
            ).join('');

            // Link input to error
            errorContainer.id = `${fieldName}-errors`;
            input.setAttribute('aria-describedby', errorContainer.id);
        });
    }

    log(...args) {
        if (this.debug) {
            console.log('[FormValidator]', ...args);
        }
    }
}

/**
 * Create FormValidator instance
 */
export function createFormValidator(eventBus, options = {}) {
    return new FormValidator(eventBus, options);
}
