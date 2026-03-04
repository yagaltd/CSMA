/**
 * CSMA Accordion Component
 * Expandable accordion panels using EventBus
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Contracts: INTENT_ACCORDION_TOGGLE, ACCORDION_TOGGLED, ACCORDION_INITIALIZED
 */

/**
 * Initialize Accordion system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initAccordionSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Accordion] EventBus not provided');
        return () => { };
    }

    const cleanups = new Map();
    const accordions = document.querySelectorAll('.accordion');

    accordions.forEach(accordion => {
        const cleanup = initAccordionWithEventBus(accordion, eventBus);
        if (accordion.id) cleanups.set(accordion.id, cleanup);
    });

    // Subscribe to toggle intents
    const unsubscribe = eventBus.subscribe('INTENT_ACCORDION_TOGGLE', (payload) => {
        try {
            const container = document.getElementById(payload.containerId);
            if (container) {
                const item = document.getElementById(payload.itemId);
                if (item) {
                    const trigger = item.querySelector('.accordion-trigger');
                    if (trigger) {
                        toggleAccordion(trigger, container, eventBus);
                    }
                }
            }
        } catch (error) {
            console.error('[Accordion] Failed to toggle:', error);
        }
    });

    return () => {
        unsubscribe();
        cleanups.forEach(fn => fn());
        cleanups.clear();
    };
}

/**
 * Initialize accordion with EventBus
 */
function initAccordionWithEventBus(accordion, eventBus) {
    const containerId = accordion.id || `accordion-${Date.now()}`;
    if (!accordion.id) accordion.id = containerId;

    const triggers = accordion.querySelectorAll('.accordion-trigger');
    const singleOpen = accordion.dataset.singleOpen === 'true';
    const eventHandlers = [];

    triggers.forEach(trigger => {
        const handleClick = () => {
            if (singleOpen) {
                accordion.querySelectorAll('.accordion-item').forEach(item => {
                    if (item !== trigger.closest('.accordion-item')) {
                        item.dataset.state = 'closed';
                        item.querySelector('.accordion-trigger')?.setAttribute('aria-expanded', 'false');
                    }
                });
            }
            toggleAccordion(trigger, accordion, eventBus);
        };
        trigger.addEventListener('click', handleClick);
        eventHandlers.push({ element: trigger, event: 'click', handler: handleClick });
    });

    // Keyboard navigation
    const handleKeydown = (e) => {
        if (!e.target.classList.contains('accordion-trigger')) return;

        const triggersArray = Array.from(triggers);
        const currentIndex = triggersArray.indexOf(e.target);
        let newIndex;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                newIndex = (currentIndex + 1) % triggers.length;
                break;
            case 'ArrowUp':
                e.preventDefault();
                newIndex = (currentIndex - 1 + triggers.length) % triggers.length;
                break;
            case 'Home':
                e.preventDefault();
                newIndex = 0;
                break;
            case 'End':
                e.preventDefault();
                newIndex = triggers.length - 1;
                break;
            default:
                return;
        }

        triggers[newIndex].focus();
    };
    accordion.addEventListener('keydown', handleKeydown);
    eventHandlers.push({ element: accordion, event: 'keydown', handler: handleKeydown });

    // Publish initialized event
    eventBus.publish('ACCORDION_INITIALIZED', {
        containerId,
        itemCount: triggers.length,
        singleOpen,
        timestamp: Date.now()
    });

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Toggle accordion item
 */
export function toggleAccordion(trigger, accordion = null, eventBus = null) {
    const item = trigger.closest('.accordion-item');
    const isOpen = item.dataset.state === 'open';
    const action = isOpen ? 'close' : 'open';

    item.dataset.state = isOpen ? 'closed' : 'open';
    trigger.setAttribute('aria-expanded', !isOpen);

    if (eventBus && accordion) {
        eventBus.publish('ACCORDION_TOGGLED', {
            containerId: accordion.id,
            itemId: item.id || `item-${Date.now()}`,
            action,
            timestamp: Date.now()
        });
    }
}

