/**
 * CSMA Pin Input Component
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
 * - Combine values for form submission
 */

const csma = window.csma || {};
const eventBus = csma.eventBus;

/**
 * PinInput Component Class
 */
export class PinInput {
    constructor(eventBus) {
        this.eventBus = eventBus || csma.eventBus;
        this.container = null;
        this.inputs = [];
        this.length = 6;
        this.separator = null;
        this.inputHandlers = new Map();
        this.unsubscribe = null;

        // Bind methods
        this.handleInput = this.handleInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handlePaste = this.handlePaste.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleClick = this.handleClick.bind(this);
    }

    /**
     * Initialize pin input
     * @param {HTMLElement} containerElement - The pin-input container
     * @returns {Function} Cleanup function
     */
    init(containerElement) {
        this.container = containerElement;
        if (!this.container) {
            console.warn('[PinInput] Container element not provided');
            return () => {};
        }

        this.inputs = Array.from(this.container.querySelectorAll('.pin-input-field'));
        this.separator = this.container.querySelector('.pin-input-separator');
        this.length = this.inputs.length || parseInt(this.container.dataset.length) || 6;

        if (!this.inputs.length) {
            console.warn('[PinInput] No input elements found');
            return () => {};
        }

        // Setup event listeners
        this.inputs.forEach((input, index) => {
            const handlers = {
                input: () => this.handleInput(input, index),
                keydown: (event) => this.handleKeyDown(event, index),
                focus: () => this.handleFocus(input),
                click: () => this.handleClick(input)
            };
            this.inputHandlers.set(input, handlers);
            input.addEventListener('input', handlers.input);
            input.addEventListener('keydown', handlers.keydown);
            input.addEventListener('focus', handlers.focus);
            input.addEventListener('click', handlers.click);
        });

        this.container.addEventListener('paste', this.handlePaste);

        // Initialize state
        this.updateFilledState();
        this.checkComplete();

        // Subscribe to EventBus
        if (this.eventBus?.subscribe) {
            this.unsubscribe?.();
            this.unsubscribe = this.eventBus.subscribe(
                'PIN_INPUT_VALUE_UPDATED',
                (data) => this.handleExternalUpdate(data)
            );
        }

        return () => this.cleanup();
    }

    /**
     * Get current value
     */
    getValue() {
        return this.inputs.map(input => input.value).join('');
    }

    /**
     * Set value
     */
    setValue(value, publish = true) {
        const digits = String(value).slice(0, this.length).split('');

        this.inputs.forEach((input, index) => {
            input.value = digits[index] || '';
        });

        this.updateFilledState();
        this.checkComplete();

        // Focus appropriate input
        const focusIndex = Math.min(digits.length, this.length - 1);
        if (digits.length < this.length) {
            this.inputs[focusIndex]?.focus();
        } else {
            this.inputs[this.length - 1]?.focus();
        }

        if (publish && this.eventBus?.publish) {
            this.eventBus.publish('INTENT_PIN_INPUT_CHANGED', {
                inputId: this.container.id,
                value: this.getValue(),
                length: this.length,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Clear all inputs
     */
    clear() {
        this.inputs.forEach(input => input.value = '');
        this.updateFilledState();
        this.checkComplete();
        this.inputs[0]?.focus();

        if (this.eventBus?.publish) {
            this.eventBus.publish('PIN_INPUT_CLEARED', {
                inputId: this.container.id,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Focus specific input
     */
    focusInput(index) {
        if (index >= 0 && index < this.inputs.length) {
            this.inputs[index].focus();
            this.inputs[index].select();
        }
    }

    /**
     * Handle input event
     */
    handleInput(input, index) {
        const value = input.value;

        // Only allow single digit
        if (value.length > 1) {
            input.value = value.slice(-1);
        }

        // Sanitize to numbers only
        input.value = input.value.replace(/\D/g, '');

        this.updateFilledState();

        // Auto-focus next input
        if (input.value && index < this.inputs.length - 1) {
            this.inputs[index + 1].focus();
            this.inputs[index + 1].select();
        }

        this.checkComplete();
        this.publishChange();
    }

    /**
     * Handle keydown event
     */
    handleKeyDown(event, index) {
        switch (event.key) {
            case 'Backspace':
                if (!this.inputs[index].value && index > 0) {
                    // Move to previous input and clear it
                    event.preventDefault();
                    this.inputs[index - 1].focus();
                    this.inputs[index - 1].value = '';
                    this.inputs[index - 1].select();
                }
                break;

            case 'ArrowLeft':
                if (index > 0) {
                    event.preventDefault();
                    this.inputs[index - 1].focus();
                    this.inputs[index - 1].select();
                }
                break;

            case 'ArrowRight':
                if (index < this.inputs.length - 1) {
                    event.preventDefault();
                    this.inputs[index + 1].focus();
                    this.inputs[index + 1].select();
                }
                break;

            case 'Home':
                event.preventDefault();
                this.inputs[0].focus();
                this.inputs[0].select();
                break;

            case 'End':
                event.preventDefault();
                this.inputs[this.inputs.length - 1].focus();
                this.inputs[this.inputs.length - 1].select();
                break;

            case 'a':
            case 'A':
                // Select all on Ctrl+A / Cmd+A
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.inputs.forEach(input => input.select());
                }
                break;
        }

        this.updateFilledState();
    }

    /**
     * Handle paste event
     */
    handlePaste(event) {
        event.preventDefault();

        const pasteData = event.clipboardData?.getData('text') || '';
        const digits = pasteData.replace(/\D/g, '').slice(0, this.length);

        if (!digits) return;

        this.inputs.forEach((input, index) => {
            input.value = digits[index] || '';
        });

        this.updateFilledState();
        this.checkComplete();

        // Focus appropriate input
        const focusIndex = Math.min(digits.length, this.length - 1);
        this.inputs[focusIndex].focus();
        this.inputs[focusIndex].select();

        this.publishChange();
    }

    /**
     * Handle focus event
     */
    handleFocus(input) {
        input.select();
        this.container.dataset.focused = 'true';
    }

    /**
     * Handle click event
     */
    handleClick(input) {
        input.select();
    }

    /**
     * Update filled state for each input
     */
    updateFilledState() {
        this.inputs.forEach((input, index) => {
            const isFilled = Boolean(input.value);
            input.dataset.filled = String(isFilled);

            // Add/remove filled class for styling
            if (isFilled) {
                input.classList.add('filled');
            } else {
                input.classList.remove('filled');
            }
        });
    }

    /**
     * Check if all inputs are filled
     */
    checkComplete() {
        const isComplete = this.inputs.every(input => input.value);
        this.container.dataset.complete = String(isComplete);

        if (isComplete) {
            this.container.dispatchEvent(new CustomEvent('pin:complete', {
                bubbles: true,
                detail: { value: this.getValue() }
            }));
        } else {
            this.container.dispatchEvent(new CustomEvent('pin:incomplete', {
                bubbles: true
            }));
        }
    }

    /**
     * Publish change event
     */
    publishChange() {
        if (this.eventBus?.publish) {
            this.eventBus.publish('PIN_INPUT_CODE_CHANGED', {
                inputId: this.container.id,
                value: this.getValue(),
                length: this.length,
                isComplete: this.container.dataset.complete === 'true',
                timestamp: Date.now()
            });
        }
    }

    /**
     * Handle external update via EventBus
     */
    handleExternalUpdate(data) {
        if (data.inputId === this.container.id && data.value !== undefined) {
            this.setValue(data.value, false);
        }
    }

    /**
     * Set disabled state
     */
    setDisabled(disabled) {
        this.container.dataset.disabled = String(disabled);
        this.inputs.forEach(input => {
            input.disabled = disabled;
        });
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.inputs.forEach((input) => {
            const handlers = this.inputHandlers.get(input);
            if (handlers) {
                input.removeEventListener('input', handlers.input);
                input.removeEventListener('keydown', handlers.keydown);
                input.removeEventListener('focus', handlers.focus);
                input.removeEventListener('click', handlers.click);
            }
        });
        this.inputHandlers.clear();

        this.container?.removeEventListener('paste', this.handlePaste);

        this.unsubscribe?.();
        this.unsubscribe = null;

        this.container = null;
        this.inputs = [];
    }
}

/**
 * Initialize a single pin input
 */
export function initPinInput(containerElement, eventBus) {
    const pinInput = new PinInput(eventBus);
    return pinInput.init(containerElement);
}

/**
 * Initialize all pin inputs on the page
 */
export function initPinInputUI(eventBus) {
    const containers = document.querySelectorAll('.pin-input:not([data-initialized])');
    const cleanupFunctions = [];

    containers.forEach(container => {
        const cleanup = initPinInput(container, eventBus);
        cleanupFunctions.push(cleanup);
        container.dataset.initialized = 'true';
    });

    return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
        containers.forEach((container) => {
            delete container.dataset.initialized;
        });
    };
}
