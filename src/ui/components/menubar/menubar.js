/**
 * CSMA Menubar Component
 * Horizontal menu bar with dropdown menus using EventBus
 * 
 * Contracts: INTENT_MENUBAR_SELECT, MENUBAR_ITEM_SELECTED
 */

/**
 * Initialize Menubar system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initMenubarSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Menubar] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const menubars = document.querySelectorAll('.menubar');

    menubars.forEach(menubar => {
        const cleanup = initMenubar(menubar, eventBus);
        cleanups.push(cleanup);
    });

    return () => {
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single menubar
 */
function initMenubar(menubar, eventBus) {
    const menus = Array.from(menubar.querySelectorAll('.menubar-menu'));
    const eventHandlers = [];
    let openMenuIndex = -1;

    menus.forEach((menu, index) => {
        const trigger = menu.querySelector('.menubar-trigger');
        const content = menu.querySelector('.menubar-content');

        if (!trigger || !content) return;

        const open = () => {
            // Close other menus
            menus.forEach((m, i) => {
                if (i !== index) closeMenu(m);
            });
            
            content.dataset.state = 'open';
            trigger.dataset.state = 'open';
            openMenuIndex = index;
        };

        const close = () => {
            closeMenu(menu);
            openMenuIndex = -1;
        };

        const toggle = () => {
            if (content.dataset.state === 'open') {
                close();
            } else {
                open();
            }
        };

        // Click trigger
        const handleTriggerClick = (e) => {
            e.preventDefault();
            toggle();
        };

        trigger.addEventListener('click', handleTriggerClick);
        eventHandlers.push({ element: trigger, event: 'click', handler: handleTriggerClick });

        // Hover behavior when menu is open
        const handleTriggerMouseEnter = () => {
            if (openMenuIndex >= 0 && openMenuIndex !== index) {
                open();
            }
        };

        trigger.addEventListener('mouseenter', handleTriggerMouseEnter);
        eventHandlers.push({ element: trigger, event: 'mouseenter', handler: handleTriggerMouseEnter });

        // Initialize menu items
        initMenuItems(menu, content, eventBus, eventHandlers);
    });

    // Keyboard navigation for menubar
    const handleKeyDown = (e) => {
        if (openMenuIndex < 0) {
            // No menu open - handle top-level navigation
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const triggers = menus.map(m => m.querySelector('.menubar-trigger')).filter(Boolean);
                const focusedIndex = triggers.indexOf(document.activeElement);
                let nextIndex;
                
                if (e.key === 'ArrowRight') {
                    nextIndex = (focusedIndex + 1) % triggers.length;
                } else {
                    nextIndex = (focusedIndex - 1 + triggers.length) % triggers.length;
                }
                
                triggers[nextIndex]?.focus();
            }
        }
    };

    menubar.addEventListener('keydown', handleKeyDown);
    eventHandlers.push({ element: menubar, event: 'keydown', handler: handleKeyDown });

    // Close on outside click
    const handleOutsideClick = (e) => {
        if (!menubar.contains(e.target)) {
            menus.forEach(menu => closeMenu(menu));
            openMenuIndex = -1;
        }
    };

    document.addEventListener('click', handleOutsideClick);
    eventHandlers.push({ element: document, event: 'click', handler: handleOutsideClick });

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Initialize items within a menu
 */
function initMenuItems(menu, content, eventBus, eventHandlers) {
    const items = Array.from(content.querySelectorAll('.menubar-item, .menubar-checkbox-item, .menubar-radio-item'));
    let highlightedIndex = -1;

    const highlightItem = (index) => {
        items.forEach((item, i) => {
            item.dataset.highlighted = i === index ? 'true' : 'false';
        });
        highlightedIndex = index;
        
        if (index >= 0 && items[index]) {
            items[index].scrollIntoView({ block: 'nearest' });
        }
    };

    items.forEach((item, index) => {
        const handleClick = () => {
            if (item.disabled || item.hasAttribute('disabled')) return;

            // Handle checkbox items
            if (item.classList.contains('menubar-checkbox-item')) {
                const isChecked = item.dataset.checked === 'true';
                item.dataset.checked = isChecked ? 'false' : 'true';
                
                eventBus.publish('MENUBAR_CHECKBOX_TOGGLED', {
                    menuId: menu.id,
                    itemId: item.dataset.id || item.textContent.trim(),
                    checked: !isChecked,
                    timestamp: Date.now()
                });
                return;
            }

            // Handle radio items
            if (item.classList.contains('menubar-radio-item')) {
                const group = item.closest('.menubar-radio-group');
                if (group) {
                    group.querySelectorAll('.menubar-radio-item').forEach(radio => {
                        radio.dataset.checked = 'false';
                    });
                }
                item.dataset.checked = 'true';
            }

            // Publish selection event
            eventBus.publish('MENUBAR_ITEM_SELECTED', {
                menuId: menu.id,
                itemId: item.dataset.id || item.textContent.trim(),
                value: item.dataset.value,
                label: item.querySelector('.menubar-item-label')?.textContent.trim() || item.textContent.trim(),
                timestamp: Date.now()
            });

            // Close menu after selection (unless submenu)
            if (!item.dataset.submenu) {
                closeMenu(menu);
            }
        };

        item.addEventListener('click', handleClick);
        eventHandlers.push({ element: item, event: 'click', handler: handleClick });

        // Hover highlighting
        const handleMouseEnter = () => highlightItem(index);
        item.addEventListener('mouseenter', handleMouseEnter);
        eventHandlers.push({ element: item, event: 'mouseenter', handler: handleMouseEnter });
    });

    // Keyboard navigation within menu
    const handleKeyDown = (e) => {
        if (content.dataset.state !== 'open') return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                highlightItem((highlightedIndex + 1) % items.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                highlightItem(highlightedIndex <= 0 ? items.length - 1 : highlightedIndex - 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (highlightedIndex >= 0) {
                    items[highlightedIndex].click();
                }
                break;
            case 'Escape':
                e.preventDefault();
                closeMenu(menu);
                menu.querySelector('.menubar-trigger')?.focus();
                break;
        }
    };

    content.addEventListener('keydown', handleKeyDown);
    eventHandlers.push({ element: content, event: 'keydown', handler: handleKeyDown });
}

/**
 * Close a menu
 */
function closeMenu(menu) {
    const trigger = menu.querySelector('.menubar-trigger');
    const content = menu.querySelector('.menubar-content');
    
    if (content) content.dataset.state = 'closed';
    if (trigger) trigger.dataset.state = 'closed';
}
