/**
 * CSMA Drawer/Sheet Component
 * Slide-out panel using EventBus
 * 
 * Contracts: INTENT_DRAWER_OPEN, INTENT_DRAWER_CLOSE, DRAWER_STATE_CHANGED
 */

/**
 * Initialize Drawer system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initDrawerSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Drawer] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const drawers = document.querySelectorAll('.drawer-overlay');

    drawers.forEach(drawerOverlay => {
        const cleanup = initDrawer(drawerOverlay, eventBus);
        cleanups.push(cleanup);
    });

    const unsubscribeOpen = eventBus.subscribe('INTENT_DRAWER_OPEN', (payload) => {
        openDrawer(payload.drawerId, eventBus);
    });

    const unsubscribeClose = eventBus.subscribe('INTENT_DRAWER_CLOSE', (payload) => {
        closeDrawer(payload.drawerId, eventBus, payload.reason || 'button');
    });

    // Global ESC handler
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            const openDrawers = document.querySelectorAll('.drawer-overlay[data-state="open"]');
            openDrawers.forEach(overlay => {
                if (overlay.id) {
                    closeDrawer(overlay.id, eventBus, 'escape');
                }
            });
        }
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
        unsubscribeOpen();
        unsubscribeClose();
        document.removeEventListener('keydown', handleEscape);
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single drawer
 */
function initDrawer(overlay, eventBus) {
    const drawer = overlay.querySelector('.drawer');
    const closeBtn = overlay.querySelector('.drawer-close');
    const eventHandlers = [];

    if (!drawer) {
        return () => {};
    }

    // Set initial state
    overlay.dataset.state = 'closed';
    drawer.dataset.state = 'closed';

    // Close on overlay click
    const handleOverlayClick = (e) => {
        if (e.target === overlay) {
            closeDrawer(overlay.id, eventBus, 'backdrop');
        }
    };
    overlay.addEventListener('click', handleOverlayClick);
    eventHandlers.push({ element: overlay, event: 'click', handler: handleOverlayClick });

    // Close button
    if (closeBtn) {
        const handleCloseClick = () => {
            closeDrawer(overlay.id, eventBus, 'button');
        };
        closeBtn.addEventListener('click', handleCloseClick);
        eventHandlers.push({ element: closeBtn, event: 'click', handler: handleCloseClick });
    }

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Open a drawer
 */
export function openDrawer(drawerId, eventBus) {
    const overlay = document.getElementById(drawerId);
    if (!overlay) {
        console.warn(`[Drawer] Not found: ${drawerId}`);
        return;
    }

    const drawer = overlay.querySelector('.drawer');
    if (!drawer) return;

    overlay.dataset.state = 'open';
    drawer.dataset.state = 'open';
    document.body.style.overflow = 'hidden';

    eventBus.publish('DRAWER_STATE_CHANGED', {
        drawerId,
        isOpen: true,
        timestamp: Date.now()
    });
}

/**
 * Close a drawer
 */
export function closeDrawer(drawerId, eventBus, reason = 'button') {
    const overlay = document.getElementById(drawerId);
    if (!overlay) {
        console.warn(`[Drawer] Not found: ${drawerId}`);
        return;
    }

    const drawer = overlay.querySelector('.drawer');
    if (!drawer) return;

    overlay.dataset.state = 'closed';
    drawer.dataset.state = 'closed';
    document.body.style.overflow = '';

    eventBus.publish('DRAWER_STATE_CHANGED', {
        drawerId,
        isOpen: false,
        reason,
        timestamp: Date.now()
    });
}
