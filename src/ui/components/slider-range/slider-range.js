/**
 * CSMA Slider Range Component
 * Dual-handle slider for min/max range selection using EventBus
 * 
 * Contracts: INTENT_SLIDER_RANGE_SET, SLIDER_RANGE_CHANGED
 */

/**
 * Initialize Slider Range system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initSliderRangeSystem(eventBus) {
    if (!eventBus) {
        console.warn('[SliderRange] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const sliders = document.querySelectorAll('.slider-range');

    sliders.forEach(slider => {
        const cleanup = initSliderRange(slider, eventBus);
        cleanups.push(cleanup);
    });

    const unsubscribe = eventBus.subscribe('INTENT_SLIDER_RANGE_SET', (payload) => {
        const slider = document.getElementById(payload.sliderId);
        if (slider) {
            setSliderRange(slider, payload.min, payload.max);
        }
    });

    return () => {
        unsubscribe();
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single slider range
 */
function initSliderRange(slider, eventBus) {
    const track = slider.querySelector('.slider-range-track');
    const fill = slider.querySelector('.slider-range-fill');
    const minThumb = slider.querySelector('.slider-range-thumb[data-handle="min"]');
    const maxThumb = slider.querySelector('.slider-range-thumb[data-handle="max"]');
    const minDisplay = slider.querySelector('.slider-range-value-min');
    const maxDisplay = slider.querySelector('.slider-range-value-max');
    const eventHandlers = [];

    if (!track || !fill || !minThumb || !maxThumb) return () => {};

    // Assign ID if not present
    if (!slider.id) {
        slider.id = `slider-range-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Get configuration
    const config = {
        min: parseFloat(slider.dataset.min) || 0,
        max: parseFloat(slider.dataset.max) || 100,
        step: parseFloat(slider.dataset.step) || 1,
        minGap: parseFloat(slider.dataset.minGap) || 0
    };

    // Current values
    let minValue = parseFloat(slider.dataset.valueMin) || config.min;
    let maxValue = parseFloat(slider.dataset.valueMax) || config.max;
    let activeThumb = null;

    // Update UI
    const updateUI = () => {
        const range = config.max - config.min;
        const minPercent = ((minValue - config.min) / range) * 100;
        const maxPercent = ((maxValue - config.min) / range) * 100;

        minThumb.style.left = `${minPercent}%`;
        maxThumb.style.left = `${maxPercent}%`;
        fill.style.left = `${minPercent}%`;
        fill.style.width = `${maxPercent - minPercent}%`;

        if (minDisplay) minDisplay.textContent = formatValue(minValue);
        if (maxDisplay) maxDisplay.textContent = formatValue(maxValue);

        // Update data attributes
        slider.dataset.valueMin = minValue;
        slider.dataset.valueMax = maxValue;
    };

    const formatValue = (value) => {
        const format = slider.dataset.format;
        if (format === 'currency') return `$${value.toFixed(0)}`;
        if (format === 'percent') return `${value}%`;
        return value.toFixed(Number.isInteger(config.step) ? 0 : 1);
    };

    // Calculate value from position
    const getValueFromPosition = (clientX) => {
        const rect = track.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const rawValue = config.min + percent * (config.max - config.min);
        
        // Snap to step
        const steppedValue = Math.round(rawValue / config.step) * config.step;
        return Math.max(config.min, Math.min(config.max, steppedValue));
    };

    // Drag handlers
    const startDrag = (thumb, e) => {
        e.preventDefault();
        activeThumb = thumb;
        slider.dataset.state = thumb === minThumb ? 'dragging-min' : 'dragging-max';
        thumb.dataset.showTooltip = 'true';

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', stopDrag);
    };

    const onDrag = (e) => {
        if (!activeThumb) return;
        e.preventDefault();

        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const newValue = getValueFromPosition(clientX);

        if (activeThumb === minThumb) {
            // Min thumb: don't exceed max - minGap
            minValue = Math.min(newValue, maxValue - config.minGap);
            minValue = Math.max(config.min, minValue);
        } else {
            // Max thumb: don't go below min + minGap
            maxValue = Math.max(newValue, minValue + config.minGap);
            maxValue = Math.min(config.max, maxValue);
        }

        updateUI();

        eventBus.publish('SLIDER_RANGE_CHANGING', {
            sliderId: slider.id,
            min: minValue,
            max: maxValue,
            handle: activeThumb === minThumb ? 'min' : 'max',
            timestamp: Date.now()
        });
    };

    const stopDrag = () => {
        if (activeThumb) {
            activeThumb.dataset.showTooltip = 'false';
        }
        activeThumb = null;
        slider.dataset.state = '';

        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', stopDrag);

        eventBus.publish('SLIDER_RANGE_CHANGED', {
            sliderId: slider.id,
            min: minValue,
            max: maxValue,
            timestamp: Date.now()
        });
    };

    // Event listeners for thumbs
    const handleMinMouseDown = (e) => startDrag(minThumb, e);
    const handleMaxMouseDown = (e) => startDrag(maxThumb, e);

    minThumb.addEventListener('mousedown', handleMinMouseDown);
    maxThumb.addEventListener('mousedown', handleMaxMouseDown);
    minThumb.addEventListener('touchstart', handleMinMouseDown, { passive: false });
    maxThumb.addEventListener('touchstart', handleMaxMouseDown, { passive: false });

    eventHandlers.push({ element: minThumb, event: 'mousedown', handler: handleMinMouseDown });
    eventHandlers.push({ element: maxThumb, event: 'mousedown', handler: handleMaxMouseDown });
    eventHandlers.push({ element: minThumb, event: 'touchstart', handler: handleMinMouseDown });
    eventHandlers.push({ element: maxThumb, event: 'touchstart', handler: handleMaxMouseDown });

    // Track click to move nearest thumb
    const handleTrackClick = (e) => {
        const clickValue = getValueFromPosition(e.clientX);
        const distToMin = Math.abs(clickValue - minValue);
        const distToMax = Math.abs(clickValue - maxValue);

        if (distToMin < distToMax) {
            minValue = Math.min(clickValue, maxValue - config.minGap);
            minValue = Math.max(config.min, minValue);
        } else {
            maxValue = Math.max(clickValue, minValue + config.minGap);
            maxValue = Math.min(config.max, maxValue);
        }

        updateUI();

        eventBus.publish('SLIDER_RANGE_CHANGED', {
            sliderId: slider.id,
            min: minValue,
            max: maxValue,
            timestamp: Date.now()
        });
    };

    track.addEventListener('click', handleTrackClick);
    eventHandlers.push({ element: track, event: 'click', handler: handleTrackClick });

    // Keyboard navigation
    const handleKeyDown = (e, thumb) => {
        const isMin = thumb === minThumb;
        let value = isMin ? minValue : maxValue;
        const step = e.shiftKey ? config.step * 10 : config.step;

        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                e.preventDefault();
                value -= step;
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                e.preventDefault();
                value += step;
                break;
            case 'Home':
                e.preventDefault();
                value = config.min;
                break;
            case 'End':
                e.preventDefault();
                value = config.max;
                break;
            default:
                return;
        }

        // Apply constraints
        if (isMin) {
            value = Math.max(config.min, Math.min(value, maxValue - config.minGap));
            minValue = value;
        } else {
            value = Math.max(minValue + config.minGap, Math.min(value, config.max));
            maxValue = value;
        }

        updateUI();

        eventBus.publish('SLIDER_RANGE_CHANGED', {
            sliderId: slider.id,
            min: minValue,
            max: maxValue,
            timestamp: Date.now()
        });
    };

    const handleMinKeyDown = (e) => handleKeyDown(e, minThumb);
    const handleMaxKeyDown = (e) => handleKeyDown(e, maxThumb);

    minThumb.addEventListener('keydown', handleMinKeyDown);
    maxThumb.addEventListener('keydown', handleMaxKeyDown);
    eventHandlers.push({ element: minThumb, event: 'keydown', handler: handleMinKeyDown });
    eventHandlers.push({ element: maxThumb, event: 'keydown', handler: handleMaxKeyDown });

    // Focus handling
    minThumb.setAttribute('tabindex', '0');
    maxThumb.setAttribute('tabindex', '0');
    minThumb.setAttribute('role', 'slider');
    maxThumb.setAttribute('role', 'slider');
    minThumb.setAttribute('aria-label', 'Minimum value');
    maxThumb.setAttribute('aria-label', 'Maximum value');

    // Initial render
    updateUI();

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Programmatically set slider range values
 */
function setSliderRange(slider, min, max) {
    const config = {
        minVal: parseFloat(slider.dataset.min) || 0,
        maxVal: parseFloat(slider.dataset.max) || 100,
        minGap: parseFloat(slider.dataset.minGap) || 0
    };

    // Apply constraints
    min = Math.max(config.minVal, Math.min(min, max - config.minGap));
    max = Math.max(min + config.minGap, Math.min(max, config.maxVal));

    slider.dataset.valueMin = min;
    slider.dataset.valueMax = max;

    // Trigger re-render by dispatching custom event
    slider.dispatchEvent(new CustomEvent('slider-range-update'));
}
