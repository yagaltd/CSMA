/**
 * CSMA Input Component
 * Form input with validation support using EventBus
 * 
 * ECCA Metadata:
 * - Version: 2.1.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Enhanced with comprehensive validation and INPUT_VALIDATION_FAILED contract support
 * Contracts: INTENT_INPUT_CHANGED, INPUT_VALIDATION_FAILED
 */

/**
 * Initialize Input system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initInputSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Input] EventBus not provided, Input system not initialized');
        return () => { };
    }

    console.log('[Input] Initializing CSMA Input system...');

    const inputCleanups = new Map();
    // Support both CSS class and data attribute selectors
    const groups = document.querySelectorAll('.input-group, [data-input-group]');

    groups.forEach(group => {
        const cleanup = initInputWithEventBus(group, eventBus);
        if (group.id) {
            inputCleanups.set(group.id, cleanup);
        }
    });

    // Subscribe to validation results
    const unsubscribe = eventBus.subscribe('INPUT_VALIDATION_FAILED', (payload) => {
        const input = document.getElementById(payload.inputId);
        if (input) {
            const group = input.closest('.input-group');
            if (group) {
                setInputError(group, payload.error);
            }
        }
    });

    console.log(`[Input] Initialized ${groups.length} input groups ✓`);

    return () => {
        unsubscribe();
        inputCleanups.forEach(cleanup => cleanup());
        inputCleanups.clear();
        console.log('[Input] Input system cleaned up');
    };
}

/**
 * Validate input value and publish appropriate events
 */
function validateInput(input, group, eventBus, inputId) {
    const value = input.value;
    const inputType = input.type || 'text';
    
    // Clear any existing errors first
    clearInputError(group);
    
    // Basic validation based on input type
    let error = null;
    
    if (input.required && !value.trim()) {
        error = 'This field is required';
    } else if (inputType === 'email' && value && !isValidEmail(value)) {
        error = 'Please enter a valid email address';
    } else if (inputType === 'url' && value && !isValidURL(value)) {
        error = 'Please enter a valid URL';
    } else if (value.length > 16000) {
        error = 'Input exceeds maximum length of 16000 characters';
    }
    
    if (error) {
        // Publish validation failure with enhanced contract
        eventBus.publish('INPUT_VALIDATION_FAILED', {
            inputId,
            error,
            value,
            timestamp: Date.now()
        });
    } else {
        // Publish successful input change
        eventBus.publish('INTENT_INPUT_CHANGED', {
            inputId,
            value,
            isValid: true,
            timestamp: Date.now()
        });
    }
}

/**
 * Basic email validation
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Basic URL validation
 */
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Initialize input with EventBus
 */
function initInputWithEventBus(group, eventBus) {
    const input = group.querySelector('.input');
    const clearBtn = group.querySelector('.input-clear');
    if (!input) return () => { };

    const inputId = input.id || `input-${Date.now()}`;
    if (!input.id) input.id = inputId;

    const eventHandlers = [];

    const handleInput = () => {
        updateHasValue(group, input);
        validateInput(input, group, eventBus, inputId);
    };
    input.addEventListener('input', handleInput);
    eventHandlers.push({ element: input, event: 'input', handler: handleInput });

    // Initial value check
    updateHasValue(group, input);

    // Clear button
    if (clearBtn) {
        const handleClear = () => {
            input.value = '';
            updateHasValue(group, input);
            input.focus();
        };
        clearBtn.addEventListener('click', handleClear);
        eventHandlers.push({ element: clearBtn, event: 'click', handler: handleClear });
    }

    // Focus/blur states
    const handleFocus = () => {
        if (group.dataset.state !== 'error' && group.dataset.state !== 'disabled') {
            group.dataset.state = 'focus';
        }
    };
    input.addEventListener('focus', handleFocus);
    eventHandlers.push({ element: input, event: 'focus', handler: handleFocus });

    const handleBlur = () => {
        if (group.dataset.state === 'focus') {
            group.dataset.state = 'default';
        }
        // Validate on blur for required fields and format validation
        validateInput(input, group, eventBus, inputId);
    };
    input.addEventListener('blur', handleBlur);
    eventHandlers.push({ element: input, event: 'blur', handler: handleBlur });

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Update has-value data attribute
 */
function updateHasValue(group, input) {
    group.dataset.hasValue = input.value.length > 0 ? 'true' : 'false';
}

/**
 * Set input error state with EventBus integration
 * @param {HTMLElement} group - Input group element
 * @param {string} message - Error message to display
 * @param {EventBus} eventBus - Optional EventBus instance for publishing validation failure
 * @param {string} inputId - Optional input ID for EventBus events
 */
export function setInputError(group, message, eventBus = null, inputId = null) {
    group.dataset.state = 'error';
    const errorEl = group.querySelector('.input-error');
    if (errorEl && message) {
        errorEl.textContent = message;
    }
    
    // Publish validation failure event if EventBus provided
    if (eventBus && inputId) {
        const input = group.querySelector('.input');
        const value = input ? input.value : '';
        
        eventBus.publish('INPUT_VALIDATION_FAILED', {
            inputId,
            error: message,
            value,
            timestamp: Date.now()
        });
    }
}

/**
 * Clear input error state
 */
export function clearInputError(group) {
    group.dataset.state = 'default';
}
