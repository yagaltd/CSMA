/**
 * CSMA Slider Component
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Features:
 * - Mouse and touch support
 * - Keyboard navigation (Arrow keys, Home, End)
 * - Accessibility (ARIA attributes, screen reader support)
 * - EventBus integration with proper contracts
 * - CSS-class reactivity pattern
 * - Cleanup functions for memory management
 */

/**
 * Slider Component Class
 * Handles all slider interactions and EventBus communication
 */
export class Slider {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.slider = null;
        this.thumb = null;
        this.fill = null;
        this.isDragging = false;
        this.startX = 0;
        this.startValue = 0;
        this.track = null;
        
        // Bind methods to maintain context
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleTrackClick = this.handleTrackClick.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
    }

    /**
     * Initialize slider component
     * @param {HTMLElement} sliderElement - The slider container element
     * @returns {Function} Cleanup function for removing event listeners
     */
    init(sliderElement) {
        if (!sliderElement || !this.eventBus) {
            console.warn('[Slider] Missing required parameters');
            return () => {};
        }

        this.slider = sliderElement;
        this.thumb = this.slider.querySelector('[data-slider-thumb]');
        this.fill = this.slider.querySelector('[data-slider-fill]');
        this.track = this.slider.querySelector('.slider-track');
        
        if (!this.thumb || !this.fill || !this.track) {
            console.warn('[Slider] Required elements not found');
            return () => {};
        }

        // Set initial state
        this.slider.dataset.state = this.slider.dataset.state || 'idle';
        
        // Setup all event listeners
        this.setupEventListeners();
        
        // Subscribe to EventBus events
        const unsubscribeValue = this.eventBus.subscribe('SLIDER_VALUE_UPDATED', this.updateValue.bind(this));
        const unsubscribeState = this.eventBus.subscribe('SLIDER_STATE_CHANGED', this.updateState.bind(this));
        
        // Initialize display
        this.updateDisplay();
        
        // Return cleanup function
        return () => {
            this.cleanup();
            unsubscribeValue();
            unsubscribeState();
        };
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Mouse events
        this.thumb.addEventListener('mousedown', this.handleMouseDown);
        this.track.addEventListener('click', this.handleTrackClick);
        
        // Touch events
        this.thumb.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.track.addEventListener('touchstart', this.handleTrackClick, { passive: false });
        
        // Keyboard events
        this.thumb.addEventListener('keydown', this.handleKeyDown);
        
        // Focus events
        this.thumb.addEventListener('focus', this.handleFocus);
        this.thumb.addEventListener('blur', this.handleBlur);
        
        // Global events (added/removed dynamically during drag)
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd);
        
        // Prevent context menu on thumb
        this.thumb.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Handle mouse down on thumb
     */
    handleMouseDown(e) {
        e.preventDefault();
        this.startDrag(e.clientX);
    }

    /**
     * Handle touch start on thumb
     */
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.startDrag(touch.clientX);
    }

    /**
     * Common drag start logic
     */
    startDrag(clientX) {
        if (this.slider.dataset.state === 'disabled') return;
        
        this.isDragging = true;
        this.startX = clientX;
        this.startValue = this.getValue();
        
        // Publish drag start intent
        try {
            this.eventBus.publish('INTENT_SLIDER_DRAG_STARTED', {
                sliderId: this.slider.id,
                startValue: this.startValue,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[Slider] Failed to publish drag start:', error);
        }
        
        this.slider.dataset.state = 'dragging';
        this.thumb.focus();
    }

    /**
     * Handle mouse move
     */
    handleMouseMove(e) {
        if (!this.isDragging) return;
        this.updateDragPosition(e.clientX);
    }

    /**
     * Handle touch move
     */
    handleTouchMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        this.updateDragPosition(touch.clientX);
    }

    /**
     * Common drag position update logic
     */
    updateDragPosition(clientX) {
        const deltaX = clientX - this.startX;
        const newValue = this.calculateValueFromDelta(deltaX);
        this.setValue(newValue);
    }

    /**
     * Handle mouse up
     */
    handleMouseUp(e) {
        this.endDrag();
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(e) {
        this.endDrag();
    }

    /**
     * Common drag end logic
     */
    endDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        const endValue = this.getValue();
        
        // Publish drag end intent
        try {
            this.eventBus.publish('INTENT_SLIDER_DRAG_ENDED', {
                sliderId: this.slider.id,
                startValue: this.startValue,
                endValue: endValue,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[Slider] Failed to publish drag end:', error);
        }
        
        this.slider.dataset.state = 'idle';
    }

    /**
     * Handle track click
     */
    handleTrackClick(e) {
        if (this.slider.dataset.state === 'disabled') return;
        if (e.target === this.thumb) return;
        
        const rect = this.track.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        const value = this.getMin() + percentage * (this.getMax() - this.getMin());
        
        this.setValue(value);
        this.thumb.focus();
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyDown(e) {
        if (this.slider.dataset.state === 'disabled') return;
        
        const step = this.getStep();
        const currentValue = this.getValue();
        let newValue = currentValue;
        let handled = true;
        
        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                newValue = Math.max(this.getMin(), currentValue - step);
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                newValue = Math.min(this.getMax(), currentValue + step);
                break;
            case 'Home':
                newValue = this.getMin();
                break;
            case 'End':
                newValue = this.getMax();
                break;
            case 'PageDown':
                newValue = Math.max(this.getMin(), currentValue - (step * 10));
                break;
            case 'PageUp':
                newValue = Math.min(this.getMax(), currentValue + (step * 10));
                break;
            default:
                handled = false;
        }
        
        if (handled) {
            e.preventDefault();
            this.setValue(newValue);
        }
    }

    /**
     * Handle focus event
     */
    handleFocus(e) {
        if (this.slider.dataset.state !== 'disabled') {
            this.slider.dataset.state = 'focused';
        }
    }

    /**
     * Handle blur event
     */
    handleBlur(e) {
        if (this.slider.dataset.state === 'focused') {
            this.slider.dataset.state = 'idle';
        }
    }

    /**
     * Calculate value from mouse/touch delta
     */
    calculateValueFromDelta(deltaX) {
        const trackWidth = this.track.offsetWidth;
        const percentage = deltaX / trackWidth;
        const range = this.getMax() - this.getMin();
        const rawValue = this.startValue + percentage * range;
        
        return this.snapToStep(rawValue);
    }

    /**
     * Snap value to step increments
     */
    snapToStep(value) {
        const step = this.getStep();
        const min = this.getMin();
        const steps = Math.round((value - min) / step);
        return Math.max(min, Math.min(this.getMax(), min + steps * step));
    }

    /**
     * Set slider value
     */
    setValue(value) {
        const min = this.getMin();
        const max = this.getMax();
        const clampedValue = Math.max(min, Math.min(max, value));
        
        // Only publish if value actually changed
        if (clampedValue !== this.getValue()) {
            try {
                this.eventBus.publish('INTENT_SLIDER_VALUE_CHANGED', {
                    sliderId: this.slider.id,
                    value: clampedValue,
                    min: min,
                    max: max,
                    step: this.getStep(),
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('[Slider] Failed to publish value change:', error);
            }
        }
    }

    /**
     * Get current slider value
     */
    getValue() {
        return parseFloat(this.slider.dataset.value) || 0;
    }

    /**
     * Get minimum value
     */
    getMin() {
        return parseFloat(this.slider.dataset.min) || 0;
    }

    /**
     * Get maximum value
     */
    getMax() {
        return parseFloat(this.slider.dataset.max) || 100;
    }

    /**
     * Get step value
     */
    getStep() {
        return parseFloat(this.slider.dataset.step) || 1;
    }

    /**
     * Update slider from EventBus event
     */
    updateValue(payload) {
        if (payload.sliderId === this.slider.id) {
            this.slider.dataset.value = payload.value;
            this.updateDisplay();
        }
    }

    /**
     * Update slider state from EventBus event
     */
    updateState(payload) {
        if (payload.sliderId === this.slider.id) {
            this.slider.dataset.state = payload.state;
        }
    }

    /**
     * Update visual display
     */
    updateDisplay() {
        const value = this.getValue();
        const min = this.getMin();
        const max = this.getMax();
        const percentage = ((value - min) / (max - min)) * 100;
        
        // Update fill width
        this.fill.style.width = `${percentage}%`;
        
        // Update thumb position
        this.thumb.style.left = `${percentage}%`;
        
        // Update ARIA attributes
        this.thumb.setAttribute('aria-valuenow', value);
        this.thumb.setAttribute('aria-valuemin', min);
        this.thumb.setAttribute('aria-valuemax', max);
        
        // Update dataset attributes for CSS targeting
        this.slider.dataset.value = value;
        this.slider.dataset.percentage = Math.round(percentage);
        
        // Update value display if present
        const valueDisplay = this.slider.querySelector('[data-slider-value]');
        if (valueDisplay) {
            valueDisplay.textContent = value;
        }
    }

    /**
     * Cleanup event listeners and resources
     */
    cleanup() {
        // Remove event listeners
        this.thumb.removeEventListener('mousedown', this.handleMouseDown);
        this.thumb.removeEventListener('touchstart', this.handleTouchStart);
        this.track.removeEventListener('click', this.handleTrackClick);
        this.track.removeEventListener('touchstart', this.handleTrackClick);
        this.thumb.removeEventListener('keydown', this.handleKeyDown);
        this.thumb.removeEventListener('focus', this.handleFocus);
        this.thumb.removeEventListener('blur', this.handleBlur);
        
        // Remove global event listeners
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
        
        // Reset state
        this.isDragging = false;
        this.slider = null;
        this.thumb = null;
        this.fill = null;
        this.track = null;
    }
}

/**
 * Initialize a single slider
 * @param {HTMLElement} sliderElement - The slider container element
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initSlider(sliderElement, eventBus) {
    const slider = new Slider(eventBus);
    return slider.init(sliderElement);
}

/**
 * Initialize all sliders on the page
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Master cleanup function
 */
export function initSliderUI(eventBus) {
    const sliders = document.querySelectorAll('.slider:not([data-initialized])');
    const cleanupFunctions = [];
    
    sliders.forEach(slider => {
        const cleanup = initSlider(slider, eventBus);
        cleanupFunctions.push(cleanup);
        slider.dataset.initialized = 'true';
    });
    
    // Return master cleanup function
    return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
    };
}

/**
 * Batch update multiple sliders
 * @param {Array} updates - Array of {sliderId, value} objects
 * @param {EventBus} eventBus - CSMA EventBus instance
 */
export function batchUpdateSliders(updates, eventBus) {
    updates.forEach(({ sliderId, value }) => {
        const slider = document.getElementById(sliderId);
        if (slider && slider.dataset.initialized === 'true') {
            eventBus.publish('INTENT_SLIDER_VALUE_CHANGED', {
                sliderId,
                value,
                min: parseFloat(slider.dataset.min) || 0,
                max: parseFloat(slider.dataset.max) || 100,
                step: parseFloat(slider.dataset.step) || 1,
                timestamp: Date.now()
            });
        }
    });
}
