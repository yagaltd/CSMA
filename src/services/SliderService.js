/**
 * CSMA Slider Service
 * Handles slider business logic, state management, and coordination
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: service
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 */

export class SliderService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.sliderStates = new Map(); // Track slider states
        this.dragSessions = new Map(); // Track active drag sessions
        this.valueHistory = new Map(); // Track value history for analytics
        this.listeners = []; // Store unsubscribe functions
        
        this.setupSubscriptions();
    }

    /**
     * Setup EventBus subscriptions
     */
    setupSubscriptions() {
        // Handle value changes
        this.listeners.push(
            this.eventBus.subscribe('INTENT_SLIDER_VALUE_CHANGED', this.handleValueChanged.bind(this))
        );
        
        // Handle drag sessions
        this.listeners.push(
            this.eventBus.subscribe('INTENT_SLIDER_DRAG_STARTED', this.handleDragStarted.bind(this))
        );
        
        this.listeners.push(
            this.eventBus.subscribe('INTENT_SLIDER_DRAG_ENDED', this.handleDragEnded.bind(this))
        );

        // Handle external value updates (e.g., from services or other components)
        this.listeners.push(
            this.eventBus.subscribe('SLIDER_SET_VALUE', this.handleExternalValueSet.bind(this))
        );

        // Handle batch updates
        this.listeners.push(
            this.eventBus.subscribe('SLIDER_BATCH_UPDATE', this.handleBatchUpdate.bind(this))
        );
    }

    /**
     * Handle slider value change intent
     */
    handleValueChanged(payload) {
        const { sliderId, value, min, max, step } = payload;
        
        // Validate the value
        const validatedValue = this.validateValue(value, min, max, step);
        if (validatedValue !== value) {
        }
        
        // Calculate percentage
        const percentage = ((validatedValue - min) / (max - min)) * 100;
        
        // Update slider state
        this.updateSliderState(sliderId, {
            value: validatedValue,
            percentage,
            min,
            max,
            step,
            lastUpdated: Date.now()
        });
        
        // Track value history for analytics
        this.trackValueHistory(sliderId, validatedValue);
        
        // Publish updated event
        try {
            this.eventBus.publish('SLIDER_VALUE_UPDATED', {
                sliderId,
                value: validatedValue,
                percentage,
                min,
                max,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[SliderService] Failed to publish SLIDER_VALUE_UPDATED:', error);
        }
        
        // Log for debugging
    }

    /**
     * Handle drag start
     */
    handleDragStarted(payload) {
        const { sliderId, startValue } = payload;
        
        this.dragSessions.set(sliderId, {
            startValue,
            startTime: Date.now(),
            minValue: startValue,
            maxValue: startValue
        });
        
        // Update state
        this.updateSliderState(sliderId, {
            isDragging: true,
            dragStartValue: startValue,
            dragStartTime: Date.now()
        });
        
        // Publish state change
        this.publishStateChange(sliderId, 'dragging');
        
    }

    /**
     * Handle drag end
     */
    handleDragEnded(payload) {
        const { sliderId, startValue, endValue } = payload;
        
        const session = this.dragSessions.get(sliderId);
        if (session) {
            const dragDuration = Date.now() - session.startTime;
            const valueChange = Math.abs(endValue - startValue);
            
            // Analytics: Log drag session
            
            // Clean up drag session
            this.dragSessions.delete(sliderId);
        }
        
        // Update state
        this.updateSliderState(sliderId, {
            isDragging: false,
            dragStartValue: null,
            dragStartTime: null
        });
        
        // Publish state change
        this.publishStateChange(sliderId, 'idle');
    }

    /**
     * Handle external value set (from services or other components)
     */
    handleExternalValueSet(payload) {
        const { sliderId, value, animate = false } = payload;
        
        const slider = document.getElementById(sliderId);
        if (!slider || slider.dataset.initialized !== 'true') {
            console.warn(`[SliderService] Slider ${sliderId} not found or not initialized`);
            return;
        }
        
        const min = parseFloat(slider.dataset.min) || 0;
        const max = parseFloat(slider.dataset.max) || 100;
        const step = parseFloat(slider.dataset.step) || 1;
        
        // Validate value
        const validatedValue = this.validateValue(value, min, max, step);
        
        // Publish intent (which will trigger the normal flow)
        try {
            this.eventBus.publish('INTENT_SLIDER_VALUE_CHANGED', {
                sliderId,
                value: validatedValue,
                min,
                max,
                step,
                timestamp: Date.now(),
                source: 'external'
            });
        } catch (error) {
            console.error('[SliderService] Failed to publish external value set:', error);
        }
    }

    /**
     * Handle batch slider updates
     */
    handleBatchUpdate(payload) {
        const { updates } = payload;
        
        if (!Array.isArray(updates)) {
            console.error('[SliderService] Batch update must be an array');
            return;
        }
        
        console.log(`[SliderService] Processing batch update for ${updates.length} sliders`);
        
        updates.forEach(({ sliderId, value }) => {
            this.handleExternalValueSet({ sliderId, value });
        });
    }

    /**
     * Validate slider value
     */
    validateValue(value, min, max, step) {
        // Clamp to range
        let clamped = Math.max(min, Math.min(max, value));
        
        // Snap to step
        if (step > 0) {
            const steps = Math.round((clamped - min) / step);
            clamped = min + steps * step;
        }
        
        // Round to avoid floating point issues
        if (step < 1) {
            const decimals = step.toString().split('.')[1]?.length || 0;
            clamped = Math.round(clamped * Math.pow(10, decimals)) / Math.pow(10, decimals);
        }
        
        return clamped;
    }

    /**
     * Update slider state
     */
    updateSliderState(sliderId, updates) {
        const currentState = this.sliderStates.get(sliderId) || {};
        const newState = { ...currentState, ...updates };
        this.sliderStates.set(sliderId, newState);
    }

    /**
     * Track value history for analytics
     */
    trackValueHistory(sliderId, value) {
        if (!this.valueHistory.has(sliderId)) {
            this.valueHistory.set(sliderId, []);
        }
        
        const history = this.valueHistory.get(sliderId);
        history.push({
            value,
            timestamp: Date.now()
        });
        
        // Keep only last 100 values
        if (history.length > 100) {
            history.shift();
        }
    }

    /**
     * Publish state change event
     */
    publishStateChange(sliderId, state) {
        try {
            this.eventBus.publish('SLIDER_STATE_CHANGED', {
                sliderId,
                state,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[SliderService] Failed to publish state change:', error);
        }
    }

    /**
     * Get current slider state
     */
    getSliderState(sliderId) {
        return this.sliderStates.get(sliderId);
    }

    /**
     * Get all slider states
     */
    getAllSliderStates() {
        return Object.fromEntries(this.sliderStates);
    }

    /**
     * Get value history for a slider
     */
    getValueHistory(sliderId, limit = 50) {
        const history = this.valueHistory.get(sliderId) || [];
        return history.slice(-limit);
    }

    /**
     * Get statistics for a slider
     */
    getSliderStats(sliderId) {
        const state = this.getSliderState(sliderId);
        const history = this.getValueHistory(sliderId);
        
        if (history.length === 0) {
            return null;
        }
        
        const values = history.map(h => h.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        
        return {
            currentValue: state?.value || 0,
            minValue: min,
            maxValue: max,
            averageValue: avg,
            interactionCount: history.length,
            lastInteraction: history[history.length - 1]?.timestamp
        };
    }

    /**
     * Set slider value programmatically
     */
    setSliderValue(sliderId, value, options = {}) {
        const { animate = false, source = 'service' } = options;
        
        try {
            this.eventBus.publish('SLIDER_SET_VALUE', {
                sliderId,
                value,
                animate,
                source,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[SliderService] Failed to set slider value:', error);
        }
    }

    /**
     * Reset slider to default value
     */
    resetSlider(sliderId, defaultValue = null) {
        const slider = document.getElementById(sliderId);
        if (!slider) {
            console.warn(`[SliderService] Slider ${sliderId} not found`);
            return;
        }
        
        const resetValue = defaultValue !== null ? defaultValue : 
                         (parseFloat(slider.dataset.defaultValue) || 
                          (parseFloat(slider.dataset.min) + parseFloat(slider.dataset.max)) / 2);
        
        this.setSliderValue(sliderId, resetValue);
        console.log(`[SliderService] Slider ${sliderId} reset to ${resetValue}`);
    }

    /**
     * Disable slider
     */
    disableSlider(sliderId) {
        this.publishStateChange(sliderId, 'disabled');
    }

    /**
     * Enable slider
     */
    enableSlider(sliderId) {
        this.publishStateChange(sliderId, 'idle');
    }

    /**
     * Get all sliders on the page
     */
    getAllSliders() {
        return Array.from(document.querySelectorAll('.slider[data-initialized="true"]'))
            .map(slider => ({
                id: slider.id,
                min: parseFloat(slider.dataset.min) || 0,
                max: parseFloat(slider.dataset.max) || 100,
                step: parseFloat(slider.dataset.step) || 1,
                value: parseFloat(slider.dataset.value) || 0,
                state: slider.dataset.state || 'idle'
            }));
    }

    /**
     * Export slider data for analytics
     */
    exportAnalyticsData() {
        const sliders = this.getAllSliders();
        const analytics = {};
        
        sliders.forEach(slider => {
            analytics[slider.id] = {
                ...slider,
                stats: this.getSliderStats(slider.id),
                history: this.getValueHistory(slider.id, 20) // Last 20 values
            };
        });
        
        return {
            timestamp: Date.now(),
            sliders: analytics,
            totalSliders: sliders.length,
            totalInteractions: Array.from(this.valueHistory.values())
                .reduce((total, history) => total + history.length, 0)
        };
    }

    /**
     * Cleanup service resources
     */
    cleanup() {
        // Unsubscribe from all EventBus events
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.listeners = [];
        
        // Clear state
        this.sliderStates.clear();
        this.dragSessions.clear();
        this.valueHistory.clear();
        
    }
}

/**
 * Factory function to create and initialize SliderService
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {SliderService} Initialized service instance
 */
export function createSliderService(eventBus) {
    return new SliderService(eventBus);
}

// Export for global access
if (typeof window !== 'undefined') {
    window.SliderService = {
        createSliderService
    };
}