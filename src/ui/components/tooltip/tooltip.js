/**
 * CSMA Tooltip Component
 * Accessible tooltips with EventBus integration
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Contracts: TOOLTIP_INITIALIZE
 */

/**
 * Initialize Tooltip system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initTooltipSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Tooltip] EventBus not provided');
        return () => { };
    }

    const triggers = document.querySelectorAll('.tooltip-trigger');
    const eventHandlers = [];

    triggers.forEach(trigger => {
        const content = trigger.querySelector('.tooltip-content');
        if (!content) return;

        const handleMouseEnter = () => {
            content.dataset.state = 'open';
        };

        const handleMouseLeave = () => {
            content.dataset.state = 'closed';
        };

        const handleFocus = () => {
            content.dataset.state = 'open';
        };

        const handleBlur = () => {
            content.dataset.state = 'closed';
        };

        trigger.addEventListener('mouseenter', handleMouseEnter);
        trigger.addEventListener('mouseleave', handleMouseLeave);
        trigger.addEventListener('focus', handleFocus);
        trigger.addEventListener('blur', handleBlur);

        eventHandlers.push(
            { element: trigger, event: 'mouseenter', handler: handleMouseEnter },
            { element: trigger, event: 'mouseleave', handler: handleMouseLeave },
            { element: trigger, event: 'focus', handler: handleFocus },
            { element: trigger, event: 'blur', handler: handleBlur }
        );

        // Publish initialized event
        eventBus.publish('TOOLTIP_INITIALIZED', {
            triggerId: trigger.id || `trigger-${Date.now()}`,
            timestamp: Date.now()
        });
    });

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}
