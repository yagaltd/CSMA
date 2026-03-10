/**
 * CSMA Select Component
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 *
 * Features:
 * - Enhanced native select handling
 * - Error state management
 * - EventBus integration
 * - Keyboard navigation support
 */

const csma = window.csma || {};
const eventBus = csma.eventBus;

/**
 * Select Component Class
 * Note: This uses native select element for accessibility
 * The CSS provides the custom styling
 */
export class Select {
    constructor(eventBus) {
        this.eventBus = eventBus || csma.eventBus;
        this.group = null;
        this.select = null;
        this.helperText = null;
        this.errorText = null;
        this.arrow = null;

        // Bind methods
        this.handleChange = this.handleChange.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
    }

    /**
     * Initialize select
     * @param {HTMLElement} groupElement - The select-group container
     * @returns {Function} Cleanup function
     */
    init(groupElement) {
        this.group = groupElement;
        if (!this.group) {
            console.warn('[Select] Group element not provided');
            return () => {};
        }

        this.select = this.group.querySelector('.select');
        this.helperText = this.group.querySelector('.select-helper');
        this.errorText = this.group.querySelector('.select-error');
        this.arrow = this.group.querySelector('.select-arrow');

        if (!this.select) {
            console.warn('[Select] Select element not found');
            return () => {};
        }

        // Setup event listeners
        this.select.addEventListener('change', this.handleChange);
        this.select.addEventListener('focus', this.handleFocus);
        this.select.addEventListener('blur', this.handleBlur);

        // Add keyboard support
        this.select.addEventListener('keydown', this.handleKeyDown);

        // Update arrow rotation based on state
        this.updateArrow();

        // Subscribe to EventBus
        if (this.eventBus?.subscribe) {
            this.unsubscribe = this.eventBus.subscribe(
                'SELECT_VALUE_UPDATED',
                (data) => this.handleExternalUpdate(data)
            );
        }

        return () => this.cleanup();
    }

    /**
     * Get current value
     */
    getValue() {
        return this.select.value;
    }

    /**
     * Get selected option text
     */
    getSelectedText() {
        const option = this.select.options[this.select.selectedIndex];
        return option?.text || '';
    }

    /**
     * Set value
     */
    setValue(value, publish = true) {
        const oldValue = this.select.value;
        this.select.value = value;

        if (publish && oldValue !== value) {
            this.handleChange();
        }

        this.updateArrow();
    }

    /**
     * Handle change event
     */
    handleChange(event) {
        this.updateArrow();

        // Clear error state on change
        if (this.group.dataset.state === 'error') {
            this.group.dataset.state = '';
        }

        if (this.eventBus?.publish) {
            this.eventBus.publish('INTENT_SELECT_CHANGED', {
                selectId: this.group.id || this.select.id,
                value: this.getValue(),
                text: this.getSelectedText(),
                timestamp: Date.now()
            });
        }

        // Dispatch custom event
        this.group.dispatchEvent(new CustomEvent('select:change', {
            bubbles: true,
            detail: {
                value: this.getValue(),
                text: this.getSelectedText()
            }
        }));
    }

    /**
     * Handle focus event
     */
    handleFocus(event) {
        this.group.dataset.focused = 'true';
    }

    /**
     * Handle blur event
     */
    handleBlur(event) {
        this.group.dataset.focused = 'false';
    }

    /**
     * Handle keyboard events
     */
    handleKeyDown(event) {
        // Allow default behavior for native select navigation
        // But add support for custom shortcuts
        if (event.key === 'Escape') {
            this.select.blur();
        }
    }

    /**
     * Update arrow rotation
     */
    updateArrow() {
        if (!this.arrow) return;

        // Native select doesn't expose open state
        // Arrow can be styled based on focus/hover
    }

    /**
     * Show error state
     */
    showError(message = '') {
        this.group.dataset.state = 'error';

        if (message && this.errorText) {
            this.errorText.textContent = message;
        }

        if (this.eventBus?.publish) {
            this.eventBus.publish('SELECT_ERROR', {
                selectId: this.group.id || this.select.id,
                value: this.getValue(),
                timestamp: Date.now()
            });
        }
    }

    /**
     * Clear error state
     */
    clearError() {
        this.group.dataset.state = '';

        if (this.eventBus?.publish) {
            this.eventBus.publish('SELECT_ERROR_CLEARED', {
                selectId: this.group.id || this.select.id,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Set disabled state
     */
    setDisabled(disabled) {
        this.select.disabled = disabled;
        this.group.dataset.disabled = String(disabled);
    }

    /**
     * Handle external update via EventBus
     */
    handleExternalUpdate(data) {
        if (data.selectId === (this.group.id || this.select.id) && data.value !== undefined) {
            this.setValue(data.value, false);
        }
    }

    /**
     * Get options
     */
    getOptions() {
        return Array.from(this.select.options).map(option => ({
            value: option.value,
            text: option.text,
            disabled: option.disabled
        }));
    }

    /**
     * Add option
     */
    addOption(value, text, disabled = false) {
        const option = document.createElement('option');
        option.value = value;
        option.text = text;
        option.disabled = disabled;
        this.select.appendChild(option);
    }

    /**
     * Remove option
     */
    removeOption(value) {
        const option = this.select.querySelector(`option[value="${value}"]`);
        if (option) {
            option.remove();
        }
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.select) {
            this.select.removeEventListener('change', this.handleChange);
            this.select.removeEventListener('focus', this.handleFocus);
            this.select.removeEventListener('blur', this.handleBlur);
            this.select.removeEventListener('keydown', this.handleKeyDown);
        }

        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.group = null;
        this.select = null;
        this.helperText = null;
        this.errorText = null;
        this.arrow = null;
    }
}

/**
 * Initialize a single select
 */
export function initSelect(groupElement, eventBus) {
    const select = new Select(eventBus);
    return select.init(groupElement);
}

/**
 * Initialize all selects on the page
 */
export function initSelectUI(eventBus) {
    const groups = document.querySelectorAll('.select-group:not([data-initialized])');
    const cleanupFunctions = [];

    groups.forEach(group => {
        const cleanup = initSelect(group, eventBus);
        cleanupFunctions.push(cleanup);
        group.dataset.initialized = 'true';
    });

    return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
    };
}

/**
 * Get select value helper
 */
export function getSelectValue(selectElement) {
    const group = selectElement.closest('.select-group');
    if (group) {
        const instance = selectInstances.get(group);
        return instance?.getValue() || selectElement.value;
    }
    return selectElement.value;
}

// Store instances for reference
const selectInstances = new WeakMap();
