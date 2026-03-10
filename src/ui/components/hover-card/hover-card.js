/**
 * CSMA Hover Card Component
 * Card that appears on hover using EventBus
 * 
 * Contracts: INTENT_HOVER_CARD_SHOW, INTENT_HOVER_CARD_HIDE, HOVER_CARD_STATE_CHANGED
 */

/**
 * Initialize Hover Card system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initHoverCardSystem(eventBus) {
    if (!eventBus) {
        console.warn('[HoverCard] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const containers = document.querySelectorAll('.hover-card-container');

    containers.forEach(container => {
        const cleanup = initHoverCard(container, eventBus);
        cleanups.push(cleanup);
    });

    const unsubscribeShow = eventBus.subscribe('INTENT_HOVER_CARD_SHOW', (payload) => {
        const card = document.getElementById(payload.cardId);
        if (card) {
            card.dataset.state = 'open';
        }
    });

    const unsubscribeHide = eventBus.subscribe('INTENT_HOVER_CARD_HIDE', (payload) => {
        const card = document.getElementById(payload.cardId);
        if (card) {
            card.dataset.state = 'closed';
        }
    });

    return () => {
        unsubscribeShow();
        unsubscribeHide();
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single hover card
 */
function initHoverCard(container, eventBus) {
    const trigger = container.querySelector('.hover-card-trigger');
    const card = container.querySelector('.hover-card');
    
    if (!trigger || !card) {
        return () => {};
    }

    // Assign ID if not present
    if (!card.id) {
        card.id = `hover-card-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Set initial state
    card.dataset.state = 'closed';
    
    // Get placement from data attribute or default to bottom
    const placement = container.dataset.placement || 'bottom';
    card.dataset.placement = placement;

    let hoverTimeout = null;
    const HOVER_DELAY = 150; // ms delay before showing

    const showCard = () => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
            card.dataset.state = 'open';
            eventBus.publish('HOVER_CARD_STATE_CHANGED', {
                cardId: card.id,
                isOpen: true,
                timestamp: Date.now()
            });
        }, HOVER_DELAY);
    };

    const hideCard = () => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
            card.dataset.state = 'closed';
            eventBus.publish('HOVER_CARD_STATE_CHANGED', {
                cardId: card.id,
                isOpen: false,
                timestamp: Date.now()
            });
        }, HOVER_DELAY);
    };

    // Trigger events
    trigger.addEventListener('mouseenter', showCard);
    trigger.addEventListener('mouseleave', hideCard);
    trigger.addEventListener('focus', showCard);
    trigger.addEventListener('blur', hideCard);

    // Keep card open when hovering over it
    card.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
    });
    card.addEventListener('mouseleave', hideCard);

    return () => {
        clearTimeout(hoverTimeout);
        trigger.removeEventListener('mouseenter', showCard);
        trigger.removeEventListener('mouseleave', hideCard);
        trigger.removeEventListener('focus', showCard);
        trigger.removeEventListener('blur', hideCard);
        card.removeEventListener('mouseenter', () => {});
        card.removeEventListener('mouseleave', hideCard);
    };
}
