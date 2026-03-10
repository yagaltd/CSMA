/**
 * CSMA Navigation Menu Component
 * Complex navigation with nested dropdowns using EventBus
 * 
 * Contracts: INTENT_NAV_SELECT, NAVIGATION_ITEM_SELECTED
 */

/**
 * Initialize Navigation Menu system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initNavigationMenuSystem(eventBus) {
    if (!eventBus) {
        console.warn('[NavigationMenu] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const navMenus = document.querySelectorAll('.navigation-menu');

    navMenus.forEach(navMenu => {
        const cleanup = initNavigationMenu(navMenu, eventBus);
        cleanups.push(cleanup);
    });

    return () => {
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single navigation menu
 */
function initNavigationMenu(navMenu, eventBus) {
    const triggers = Array.from(navMenu.querySelectorAll('.navigation-menu-trigger'));
    const links = Array.from(navMenu.querySelectorAll('.navigation-menu-link'));
    const eventHandlers = [];
    let openTrigger = null;
    let hoverTimeout = null;

    triggers.forEach(trigger => {
        const item = trigger.closest('.navigation-menu-item');
        const content = item?.querySelector('.navigation-menu-content, .navigation-menu-mega');

        if (!content) return;

        const open = () => {
            // Close others
            triggers.forEach(t => {
                if (t !== trigger) closeTrigger(t);
            });
            
            content.dataset.state = 'open';
            trigger.dataset.state = 'open';
            openTrigger = trigger;
        };

        const close = () => {
            closeTrigger(trigger);
            if (openTrigger === trigger) openTrigger = null;
        };

        // Click toggle
        const handleClick = (e) => {
            e.preventDefault();
            if (content.dataset.state === 'open') {
                close();
            } else {
                open();
            }
        };

        trigger.addEventListener('click', handleClick);
        eventHandlers.push({ element: trigger, event: 'click', handler: handleClick });

        // Hover behavior
        const handleMouseEnter = () => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(open, 100);
        };

        const handleMouseLeave = () => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                if (!item.matches(':hover') && !content.matches(':hover')) {
                    close();
                }
            }, 150);
        };

        trigger.addEventListener('mouseenter', handleMouseEnter);
        trigger.addEventListener('mouseleave', handleMouseLeave);
        eventHandlers.push({ element: trigger, event: 'mouseenter', handler: handleMouseEnter });
        eventHandlers.push({ element: trigger, event: 'mouseleave', handler: handleMouseLeave });

        // Keep open when hovering content
        content.addEventListener('mouseenter', () => {
            clearTimeout(hoverTimeout);
        });
        content.addEventListener('mouseleave', handleMouseLeave);
        eventHandlers.push({ element: content, event: 'mouseenter', handler: () => clearTimeout(hoverTimeout) });
        eventHandlers.push({ element: content, event: 'mouseleave', handler: handleMouseLeave });

        // Initialize content items
        initContentItems(item, content, eventBus, eventHandlers, close);
    });

    // Simple links
    links.forEach(link => {
        const handleClick = (e) => {
            eventBus.publish('NAVIGATION_ITEM_SELECTED', {
                href: link.getAttribute('href'),
                label: link.textContent.trim(),
                timestamp: Date.now()
            });
        };

        link.addEventListener('click', handleClick);
        eventHandlers.push({ element: link, event: 'click', handler: handleClick });
    });

    // Keyboard navigation
    const handleKeyDown = (e) => {
        const focusableItems = [
            ...triggers,
            ...links
        ].filter(el => !el.disabled && !el.hasAttribute('disabled'));

        const currentIndex = focusableItems.indexOf(document.activeElement);

        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            let nextIndex;
            
            if (e.key === 'ArrowRight') {
                nextIndex = (currentIndex + 1) % focusableItems.length;
            } else {
                nextIndex = (currentIndex - 1 + focusableItems.length) % focusableItems.length;
            }
            
            focusableItems[nextIndex]?.focus();

            // Close current dropdown when moving
            if (openTrigger) {
                closeTrigger(openTrigger);
                openTrigger = null;
            }
        }

        if (e.key === 'Escape' && openTrigger) {
            e.preventDefault();
            closeTrigger(openTrigger);
            openTrigger.focus();
            openTrigger = null;
        }
    };

    navMenu.addEventListener('keydown', handleKeyDown);
    eventHandlers.push({ element: navMenu, event: 'keydown', handler: handleKeyDown });

    // Close on outside click
    const handleOutsideClick = (e) => {
        if (!navMenu.contains(e.target)) {
            triggers.forEach(t => closeTrigger(t));
            openTrigger = null;
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
 * Initialize content items within dropdown
 */
function initContentItems(item, content, eventBus, eventHandlers, closeParent) {
    const contentItems = content.querySelectorAll('.navigation-menu-content-item');

    contentItems.forEach(contentItem => {
        const handleClick = () => {
            eventBus.publish('NAVIGATION_ITEM_SELECTED', {
                parentId: item.id,
                itemId: contentItem.dataset.id,
                href: contentItem.getAttribute('href'),
                title: contentItem.querySelector('.navigation-menu-content-item-title')?.textContent.trim(),
                description: contentItem.querySelector('.navigation-menu-content-item-description')?.textContent.trim(),
                timestamp: Date.now()
            });

            closeParent();
        };

        contentItem.addEventListener('click', handleClick);
        eventHandlers.push({ element: contentItem, event: 'click', handler: handleClick });
    });
}

/**
 * Close a trigger's content
 */
function closeTrigger(trigger) {
    const item = trigger.closest('.navigation-menu-item');
    const content = item?.querySelector('.navigation-menu-content, .navigation-menu-mega');
    
    if (content) content.dataset.state = 'closed';
    trigger.dataset.state = 'closed';
}
