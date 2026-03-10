/**
 * CSMA Context Menu Component
 * Right-click menu using EventBus
 * 
 * Contracts: INTENT_CONTEXT_MENU_OPEN, INTENT_CONTEXT_MENU_CLOSE, CONTEXT_MENU_ACTION
 */

/**
 * Initialize Context Menu system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initContextMenuSystem(eventBus) {
    if (!eventBus) {
        console.warn('[ContextMenu] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const containers = document.querySelectorAll('.context-menu-container');

    containers.forEach(container => {
        const cleanup = initContextMenu(container, eventBus);
        cleanups.push(cleanup);
    });

    const unsubscribeOpen = eventBus.subscribe('INTENT_CONTEXT_MENU_OPEN', (payload) => {
        openContextMenu(payload.menuId, payload.x, payload.y, eventBus);
    });

    const unsubscribeClose = eventBus.subscribe('INTENT_CONTEXT_MENU_CLOSE', (payload) => {
        closeContextMenu(payload.menuId, eventBus);
    });

    // Global click to close
    const handleGlobalClick = (e) => {
        const openMenus = document.querySelectorAll('.context-menu[data-state="open"]');
        openMenus.forEach(menu => {
            if (!menu.contains(e.target)) {
                menu.dataset.state = 'closed';
                eventBus.publish('CONTEXT_MENU_CLOSED', {
                    menuId: menu.id,
                    timestamp: Date.now()
                });
            }
        });
    };
    document.addEventListener('click', handleGlobalClick);

    // Global ESC handler
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            const openMenus = document.querySelectorAll('.context-menu[data-state="open"]');
            openMenus.forEach(menu => {
                menu.dataset.state = 'closed';
                eventBus.publish('CONTEXT_MENU_CLOSED', {
                    menuId: menu.id,
                    reason: 'escape',
                    timestamp: Date.now()
                });
            });
        }
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
        unsubscribeOpen();
        unsubscribeClose();
        document.removeEventListener('click', handleGlobalClick);
        document.removeEventListener('keydown', handleEscape);
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single context menu container
 */
function initContextMenu(container, eventBus) {
    const menu = container.querySelector('.context-menu');
    
    if (!menu) {
        return () => {};
    }

    // Assign ID if not present
    if (!menu.id) {
        menu.id = `context-menu-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Set initial state
    menu.dataset.state = 'closed';

    const eventHandlers = [];

    // Right-click handler
    const handleContextMenu = (e) => {
        e.preventDefault();
        openContextMenu(menu.id, e.clientX, e.clientY, eventBus);
    };
    container.addEventListener('contextmenu', handleContextMenu);
    eventHandlers.push({ element: container, event: 'contextmenu', handler: handleContextMenu });

    // Menu item click handlers
    const items = menu.querySelectorAll('.context-menu-item');
    items.forEach(item => {
        const handleItemClick = (e) => {
            if (item.disabled || item.hasAttribute('disabled')) return;
            
            const action = item.dataset.action;
            const value = item.dataset.value;
            
            eventBus.publish('CONTEXT_MENU_ACTION', {
                menuId: menu.id,
                action,
                value,
                timestamp: Date.now()
            });

            // Close menu after action
            menu.dataset.state = 'closed';
        };
        item.addEventListener('click', handleItemClick);
        eventHandlers.push({ element: item, event: 'click', handler: handleItemClick });
    });

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Open context menu at position
 */
export function openContextMenu(menuId, x, y, eventBus) {
    const menu = document.getElementById(menuId);
    if (!menu) {
        console.warn(`[ContextMenu] Not found: ${menuId}`);
        return;
    }

    // Position menu
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Adjust if menu would go off-screen
    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (rect.right > viewportWidth) {
            menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > viewportHeight) {
            menu.style.top = `${y - rect.height}px`;
        }
    });

    menu.dataset.state = 'open';

    eventBus.publish('CONTEXT_MENU_OPENED', {
        menuId,
        x,
        y,
        timestamp: Date.now()
    });
}

/**
 * Close context menu
 */
export function closeContextMenu(menuId, eventBus) {
    const menu = document.getElementById(menuId);
    if (!menu) return;

    menu.dataset.state = 'closed';

    eventBus.publish('CONTEXT_MENU_CLOSED', {
        menuId,
        timestamp: Date.now()
    });
}
