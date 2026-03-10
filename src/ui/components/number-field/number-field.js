/**
 * CSMA Number Field Component
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 *
 * Features:
 * - Increment/decrement on button click
 * - Keyboard input handling
 * - Min/max bounds
 * - Step value support
 */

const csma = window.csma || {};
const eventBus = csma.eventBus;

/**
 * NumberField Component Class
 */
export class NumberField {
    constructor(eventBus) {
        this.eventBus = eventBus || csma.eventBus;
        this.container = null;
        this.input = null;
        this.incrementBtn = null;
        this.decrementBtn = null;
        this.isDragging = false;
        this.dragInterval = null;

        // Bind methods
        this.handleIncrement = this.handleIncrement.bind(this);
        this.handleDecrement = this.handleDecrement.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.startRepeat = this.startRepeat.bind(this);
        this.stopRepeat = this.stopRepeat.bind(this);
    }

    /**
     * Initialize number field
     * @param {HTMLElement} containerElement - The number-field container
     * @returns {Function} Cleanup function
     */
    init(containerElement) {
        this.container = containerElement;
        if (!this.container) {
            console.warn('[NumberField] Container element not provided');
            return () => {};
        }

        this.input = this.container.querySelector('.number-field-input');
        this.incrementBtn = this.container.querySelector('.number-field-btn[data-action="increment"]');
        this.decrementBtn = this.container.querySelector('.number-field-btn[data-action="decrement"]');

        if (!this.input) {
            console.warn('[NumberField] Input element not found');
            return () => {};
        }

        // Setup event listeners
        if (this.incrementBtn) {
            this.incrementBtn.addEventListener('click', this.handleIncrement);
            this.incrementBtn.addEventListener('mousedown', this.startRepeat);
            this.incrementBtn.addEventListener('mouseup', this.stopRepeat);
            this.incrementBtn.addEventListener('mouseleave', this.stopRepeat);
            this.incrementBtn.addEventListener('touchstart', this.startRepeat);
            this.incrementBtn.addEventListener('touchend', this.stopRepeat);
        }

        if (this.decrementBtn) {
            this.decrementBtn.addEventListener('click', this.handleDecrement);
            this.decrementBtn.addEventListener('mousedown', this.startRepeat);
            this.decrementBtn.addEventListener('mouseup', this.stopRepeat);
            this.decrementBtn.addEventListener('mouseleave', this.stopRepeat);
            this.decrementBtn.addEventListener('touchstart', this.startRepeat);
            this.decrementBtn.addEventListener('touchend', this.stopRepeat);
        }

        this.input.addEventListener('input', this.handleInput);
        this.input.addEventListener('keydown', this.handleKeyDown);
        this.input.addEventListener('blur', this.handleBlur);

        // Initialize state
        this.updateButtons();
        this.updateState();

        // Subscribe to EventBus
        if (this.eventBus?.subscribe) {
            this.unsubscribe = this.eventBus.subscribe(
                'NUMBER_FIELD_VALUE_UPDATED',
                (data) => this.handleExternalUpdate(data)
            );
        }

        return () => this.cleanup();
    }

    /**
     * Get configuration from data attributes
     */
    getConfig() {
        return {
            min: parseFloat(this.container.dataset.min) || parseFloat(this.input.min) || 0,
            max: parseFloat(this.container.dataset.max) || parseFloat(this.input.max) || Infinity,
            step: parseFloat(this.container.dataset.step) || parseFloat(this.input.step) || 1,
            disabled: this.container.dataset.disabled === 'true' || this.input.disabled
        };
    }

    /**
     * Get current value
     */
    getValue() {
        const value = parseFloat(this.input.value);
        return isNaN(value) ? this.getConfig().min : value;
    }

    /**
     * Set value
     */
    setValue(value, publish = true) {
        const config = this.getConfig();
        const newValue = Math.max(config.min, Math.min(config.max, value));

        const oldValue = this.getValue();
        this.input.value = newValue;

        this.updateButtons();
        this.updateState();

        if (publish && newValue !== oldValue && this.eventBus?.publish) {
            this.eventBus.publish('INTENT_NUMBER_FIELD_CHANGED', {
                fieldId: this.container.id,
                value: newValue,
                oldValue: oldValue,
                timestamp: Date.now()
            });
        }

        return newValue;
    }

    /**
     * Handle increment button click
     */
    handleIncrement(event) {
        event.preventDefault();
        if (this.container.dataset.disabled === 'true') return;

        const config = this.getConfig();
        const newValue = this.getValue() + config.step;
        this.setValue(newValue);
    }

    /**
     * Handle decrement button click
     */
    handleDecrement(event) {
        event.preventDefault();
        if (this.container.dataset.disabled === 'true') return;

        const config = this.getConfig();
        const newValue = this.getValue() - config.step;
        this.setValue(newValue);
    }

    /**
     * Handle input event
     */
    handleInput(event) {
        const value = parseFloat(this.input.value);
        const config = this.getConfig();

        if (isNaN(value)) {
            // Allow user to type, don't validate yet
            return;
        }

        this.updateButtons();
        this.updateState();
    }

    /**
     * Handle keydown event
     */
    handleKeyDown(event) {
        const config = this.getConfig();

        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                this.setValue(this.getValue() + config.step);
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.setValue(this.getValue() - config.step);
                break;
            case 'Home':
                event.preventDefault();
                this.setValue(config.min);
                break;
            case 'End':
                event.preventDefault();
                this.setValue(config.max);
                break;
            case 'PageUp':
                event.preventDefault();
                this.setValue(this.getValue() + config.step * 10);
                break;
            case 'PageDown':
                event.preventDefault();
                this.setValue(this.getValue() - config.step * 10);
                break;
        }
    }

    /**
     * Handle blur event (validate on leave)
     */
    handleBlur(event) {
        const config = this.getConfig();
        const value = this.getValue();

        if (isNaN(parseFloat(this.input.value))) {
            // Reset to min if empty or invalid
            this.setValue(config.min);
        } else if (value < config.min) {
            this.setValue(config.min);
        } else if (value > config.max) {
            this.setValue(config.max);
        }
    }

    /**
     * Update button states
     */
    updateButtons() {
        const config = this.getConfig();
        const value = this.getValue();

        if (this.incrementBtn) {
            this.incrementBtn.disabled = config.disabled || value >= config.max;
        }

        if (this.decrementBtn) {
            this.decrementBtn.disabled = config.disabled || value <= config.min;
        }
    }

    /**
     * Update component state
     */
    updateState() {
        const config = this.getConfig();
        const value = this.getValue();

        if (config.disabled) {
            this.container.dataset.state = 'disabled';
        } else if (value >= config.max) {
            this.container.dataset.state = 'max';
        } else if (value <= config.min) {
            this.container.dataset.state = 'min';
        } else {
            this.container.dataset.state = 'idle';
        }
    }

    /**
     * Start repeating action on button hold
     */
    startRepeat(event) {
        if (event.type === 'touchstart') {
            event.preventDefault();
        }
        if (this.container.dataset.disabled === 'true') return;

        const action = event.currentTarget.dataset.action;
        if (!action) return;

        // Initial change
        if (action === 'increment') {
            this.handleIncrement(event);
        } else if (action === 'decrement') {
            this.handleDecrement(event);
        }

        // Start repeating after delay
        this.isDragging = true;
        this.repeatAction = action;

        setTimeout(() => {
            if (this.isDragging && this.repeatAction === action) {
                this.dragInterval = setInterval(() => {
                    if (this.repeatAction === 'increment') {
                        this.handleIncrement(event);
                    } else if (this.repeatAction === 'decrement') {
                        this.handleDecrement(event);
                    }
                }, 100);
            }
        }, 300);
    }

    /**
     * Stop repeating
     */
    stopRepeat(event) {
        this.isDragging = false;
        this.repeatAction = null;

        if (this.dragInterval) {
            clearInterval(this.dragInterval);
            this.dragInterval = null;
        }
    }

    /**
     * Handle external value update via EventBus
     */
    handleExternalUpdate(data) {
        if (data.fieldId === this.container.id && data.value !== undefined) {
            this.setValue(data.value, false);
        }
    }

    /**
     * Set disabled state
     */
    setDisabled(disabled) {
        this.container.dataset.disabled = String(disabled);
        this.input.disabled = disabled;
        this.updateButtons();
        this.updateState();
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.incrementBtn) {
            this.incrementBtn.removeEventListener('click', this.handleIncrement);
            this.incrementBtn.removeEventListener('mousedown', this.startRepeat);
            this.incrementBtn.removeEventListener('mouseup', this.stopRepeat);
            this.incrementBtn.removeEventListener('mouseleave', this.stopRepeat);
        }

        if (this.decrementBtn) {
            this.decrementBtn.removeEventListener('click', this.handleDecrement);
            this.decrementBtn.removeEventListener('mousedown', this.startRepeat);
            this.decrementBtn.removeEventListener('mouseup', this.stopRepeat);
            this.decrementBtn.removeEventListener('mouseleave', this.stopRepeat);
        }

        this.input.removeEventListener('input', this.handleInput);
        this.input.removeEventListener('keydown', this.handleKeyDown);
        this.input.removeEventListener('blur', this.handleBlur);

        this.stopRepeat();

        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.container = null;
        this.input = null;
        this.incrementBtn = null;
        this.decrementBtn = null;
    }
}

/**
 * Initialize a single number field
 */
export function initNumberField(containerElement, eventBus) {
    const numberField = new NumberField(eventBus);
    return numberField.init(containerElement);
}

/**
 * Initialize all number fields on the page
 */
export function initNumberFieldUI(eventBus) {
    const containers = document.querySelectorAll('.number-field:not([data-initialized])');
    const cleanupFunctions = [];

    containers.forEach(container => {
        const cleanup = initNumberField(container, eventBus);
        cleanupFunctions.push(cleanup);
        container.dataset.initialized = 'true';
    });

    return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
    };
}
