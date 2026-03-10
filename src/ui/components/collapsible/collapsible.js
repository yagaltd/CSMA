/**
 * CSMA Collapsible Component
 * Expandable/collapsible content areas using EventBus
 * 
 * Contracts: INTENT_COLLAPSIBLE_TOGGLE, COLLAPSIBLE_TOGGLED
 */

/**
 * Initialize Collapsible system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initCollapsibleSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Collapsible] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const collapsibles = document.querySelectorAll('.collapsible');

    collapsibles.forEach(collapsible => {
        const cleanup = initCollapsible(collapsible, eventBus);
        cleanups.push(cleanup);
    });

    const unsubscribe = eventBus.subscribe('INTENT_COLLAPSIBLE_TOGGLE', (payload) => {
        const { collapsibleId, action } = payload;
        const collapsible = document.getElementById(collapsibleId);
        
        if (!collapsible) {
            console.warn(`[Collapsible] Not found: ${collapsibleId}`);
            return;
        }

        toggleCollapsible(collapsible, eventBus, action);
    });

    return () => {
        unsubscribe();
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single collapsible
 */
function initCollapsible(collapsible, eventBus) {
    const trigger = collapsible.querySelector('.collapsible-trigger');
    const content = collapsible.querySelector('.collapsible-content');
    
    if (!trigger || !content) {
        return () => {};
    }

    // Set initial state from data attribute
    const initialState = collapsible.dataset.defaultState || 'closed';
    trigger.dataset.state = initialState;
    content.dataset.state = initialState;
    trigger.setAttribute('aria-expanded', initialState === 'open' ? 'true' : 'false');

    const handleClick = (e) => {
        e.preventDefault();
        const currentState = trigger.dataset.state;
        const newState = currentState === 'open' ? 'closed' : 'open';
        
        toggleCollapsible(collapsible, eventBus, newState === 'open' ? 'open' : 'close');
    };

    trigger.addEventListener('click', handleClick);

    return () => {
        trigger.removeEventListener('click', handleClick);
    };
}

/**
 * Toggle collapsible state
 */
function toggleCollapsible(collapsible, eventBus, action) {
    const trigger = collapsible.querySelector('.collapsible-trigger');
    const content = collapsible.querySelector('.collapsible-content');
    
    if (!trigger || !content) return;

    const currentState = trigger.dataset.state;
    let newState;

    if (action === 'toggle') {
        newState = currentState === 'open' ? 'closed' : 'open';
    } else if (action === 'open') {
        newState = 'open';
    } else if (action === 'close') {
        newState = 'closed';
    } else {
        return;
    }

    trigger.dataset.state = newState;
    content.dataset.state = newState;
    trigger.setAttribute('aria-expanded', newState === 'open' ? 'true' : 'false');

    eventBus.publish('COLLAPSIBLE_TOGGLED', {
        collapsibleId: collapsible.id,
        isOpen: newState === 'open',
        timestamp: Date.now()
    });
}
