/**
 * CSMA Popover Component
 * Popover system using EventBus
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Contracts: INTENT_POPOVER_TOGGLE, POPOVER_TOGGLED
 */

/**
 * Initialize Popover system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initPopovers(eventBus) {
    if (!eventBus) {
        console.warn('[Popover] EventBus not provided, Popover system not initialized');
        return () => { };
    }



    // Track initialized popovers and their cleanup functions
    const popoverCleanups = new Map();
    const outsideClickHandlers = new Map();

    // Initialize all popover containers on page
    const popoverContainers = document.querySelectorAll('.popover-container');
    popoverContainers.forEach(container => {
        const popoverId = container.id || `popover-${Math.random().toString(36).substr(2, 9)}`;
        if (!container.id) container.id = popoverId;

        const cleanup = initPopover(container, eventBus);
        popoverCleanups.set(popoverId, cleanup);
    });

    // Subscribe to popover toggle intents (self-contained pattern)
    const unsubscribeToggle = eventBus.subscribe('INTENT_POPOVER_TOGGLE', (payload) => {
        const { popoverId, action, source } = payload;
        const container = document.getElementById(popoverId);

        if (!container) {
            console.warn(`[Popover] Container not found: ${popoverId}`);
            return;
        }

        const trigger = container.querySelector('.popover-trigger');
        const popover = container.querySelector('.popover-content');

        if (!trigger || !popover) {
            console.warn(`[Popover] Required elements not found in: ${popoverId}`);
            return;
        }

        const isCurrentlyOpen = popover.dataset.state === 'open';
        let newState;

        // Determine new state based on action
        if (action === 'toggle') {
            newState = isCurrentlyOpen ? 'closed' : 'open';
        } else if (action === 'open') {
            newState = 'open';
        } else if (action === 'close') {
            newState = 'closed';
        } else {
            console.warn(`[Popover] Unknown action: ${action}`);
            return;
        }

        // Close all other popovers if opening (enforce single open popover)
        if (newState === 'open') {
            document.querySelectorAll('.popover-content[data-state="open"]').forEach(otherPopover => {
                if (otherPopover !== popover) {
                    otherPopover.dataset.state = 'closed';
                    const otherTrigger = otherPopover.closest('.popover-container').querySelector('.popover-trigger');
                    if (otherTrigger) {
                        otherTrigger.setAttribute('aria-expanded', 'false');
                    }
                }
            });
        }

        // Update DOM state using C-DAD pattern
        popover.dataset.state = newState;
        trigger.setAttribute('aria-expanded', newState === 'open' ? 'true' : 'false');

        // Publish toggle event for other components to react
        eventBus.publish('POPOVER_TOGGLED', {
            popoverId,
            isOpen: newState === 'open',
            timestamp: Date.now()
        });

        // Setup or cleanup outside click handler
        if (newState === 'open') {
            setupOutsideClick(container, eventBus, outsideClickHandlers);
        } else {
            cleanupOutsideClick(container, outsideClickHandlers);
        }
    });

    // Global ESC key handler to close all open popovers
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.popover-content[data-state="open"]').forEach(popover => {
                const container = popover.closest('.popover-container');
                if (container && container.id) {
                    eventBus.publish('INTENT_POPOVER_TOGGLE', {
                        popoverId: container.id,
                        action: 'close',
                        source: 'escape-key',
                        timestamp: Date.now()
                    });
                }
            });
        }
    };
    document.addEventListener('keydown', handleEscape);



    // Return cleanup function
    return () => {
        unsubscribeToggle();
        document.removeEventListener('keydown', handleEscape);

        // Cleanup all outside click handlers
        outsideClickHandlers.forEach((handler, element) => {
            document.removeEventListener('click', handler);
        });

        popoverCleanups.forEach(cleanup => cleanup());
        popoverCleanups.clear();

    };
}

/**
 * Initialize a single popover with EventBus integration
 * @param {HTMLElement} container - Popover container element
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
function initPopover(container, eventBus) {
    if (!container || !eventBus) return () => { };

    const trigger = container.querySelector('.popover-trigger');
    if (!trigger) {
        console.warn('[Popover] Trigger element not found');
        return () => { };
    }

    const eventHandlers = [];

    // Click handler for trigger - publishes intent instead of direct DOM manipulation
    const handleTriggerClick = (e) => {
        e.stopPropagation();
        eventBus.publish('INTENT_POPOVER_TOGGLE', {
            popoverId: container.id,
            action: 'toggle',
            source: 'click',
            timestamp: Date.now()
        });
    };

    trigger.addEventListener('click', handleTriggerClick);
    eventHandlers.push({ element: trigger, event: 'click', handler: handleTriggerClick });

    // Cleanup function
    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Setup outside click handler for a specific popover
 * @param {HTMLElement} container - Popover container element
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @param {WeakMap} outsideClickHandlers - WeakMap to track handlers
 */
function setupOutsideClick(container, eventBus, outsideClickHandlers) {
    const popoverId = container.id;

    const handler = (e) => {
        if (!container.contains(e.target)) {
            eventBus.publish('INTENT_POPOVER_TOGGLE', {
                popoverId,
                action: 'close',
                source: 'outside-click',
                timestamp: Date.now()
            });
        }
    };

    // Use setTimeout to avoid immediate triggering from the opening click
    setTimeout(() => {
        document.addEventListener('click', handler);
        outsideClickHandlers.set(container, handler);
    }, 0);
}

/**
 * Cleanup outside click handler for a popover
 * @param {HTMLElement} container - Popover container element
 * @param {WeakMap} outsideClickHandlers - WeakMap to track handlers
 */
function cleanupOutsideClick(container, outsideClickHandlers) {
    const handler = outsideClickHandlers.get(container);
    if (handler) {
        document.removeEventListener('click', handler);
        outsideClickHandlers.delete(container);
    }
}
