/**
 * CSMA Dropdown Component
 * Accessible dropdown menu with EventBus integration
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Contracts: INTENT_DROPDOWN_TOGGLE, DROPDOWN_TOGGLED, DROPDOWN_INITIALIZED, INTENT_DROPDOWN_ITEM_SELECTED
 */

/**
 * Initialize Dropdown system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initDropdownSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Dropdown] EventBus not provided');
        return () => { };
    }

    const cleanups = new Map();
    // Support both CSS class and data attribute selectors
    const dropdowns = document.querySelectorAll('.dropdown, [data-dropdown]');

    dropdowns.forEach(dropdown => {
        const cleanup = initDropdownWithEventBus(dropdown, eventBus);
        if (dropdown.id) cleanups.set(dropdown.id, cleanup);
    });

    // Subscribe to toggle intents
    const unsubscribeToggle = eventBus.subscribe('INTENT_DROPDOWN_TOGGLE', (payload) => {
        try {
            const dropdown = document.getElementById(payload.dropdownId);
            if (dropdown) {
                const button = dropdown.querySelector('.dropdown-button');
                if (button) toggleDropdown(dropdown, button, eventBus);
            }
        } catch (error) {
            console.error('[Dropdown] Failed to toggle:', error);
        }
    });

    // Subscribe to item selection intents
    const unsubscribeSelect = eventBus.subscribe('INTENT_DROPDOWN_ITEM_SELECTED', (payload) => {
        try {
            const dropdown = document.getElementById(payload.dropdownId);
            if (dropdown) {
                const button = dropdown.querySelector('.dropdown-trigger');
                const menu = dropdown.querySelector('.dropdown-content');
                if (button) {
                    // Update button text based on selection
                    const buttonText = button.querySelector('.dropdown-button-text');
                    if (buttonText) {
                        buttonText.textContent = payload.itemLabel || button.textContent;
                    }
                    // Close dropdown after selection if autoClose is enabled
                    if (dropdown.dataset.autoClose !== 'false') {
                        dropdown.dataset.state = 'closed';
                        if (menu) menu.dataset.state = 'closed';
                        button.setAttribute('aria-expanded', 'false');
                        eventBus.publish('DROPDOWN_TOGGLED', {
                            dropdownId: dropdown.id,
                            action: 'close',
                            timestamp: Date.now()
                        });
                    }
                }
            }
        } catch (error) {
            console.error('[Dropdown] Failed to handle selection:', error);
        }
    });

    return () => {
        unsubscribeToggle();
        unsubscribeSelect();
        cleanups.forEach(fn => fn());
        cleanups.clear();
    };
}

/**
 * Initialize dropdown with EventBus
 */
function initDropdownWithEventBus(dropdown, eventBus) {
    const dropdownId = dropdown.id || `dropdown-${Date.now()}`;
    if (!dropdown.id) dropdown.id = dropdownId;

    const button = dropdown.querySelector('.dropdown-trigger');
    const menu = dropdown.querySelector('.dropdown-content');
    const items = dropdown.querySelectorAll('.dropdown-item');
    const eventHandlers = [];

    if (!button || !menu) {
        console.warn('[Dropdown] Missing required elements (button or menu)');
        return () => { };
    }

    // Button click handler
    const handleButtonClick = (e) => {
        e.stopPropagation();
        toggleDropdown(dropdown, button, eventBus);
    };
    button.addEventListener('click', handleButtonClick);
    eventHandlers.push({ element: button, event: 'click', handler: handleButtonClick });

    // Item click handlers
    items.forEach(item => {
        const handleItemClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const itemLabel = item.textContent.trim();
            const itemValue = item.dataset.value || itemLabel;
            eventBus.publish('INTENT_DROPDOWN_ITEM_SELECTED', {
                dropdownId,
                itemId: item.id || `item-${Date.now()}`,
                itemValue,
                itemLabel,
                timestamp: Date.now()
            });
        };
        item.addEventListener('click', handleItemClick);
        eventHandlers.push({ element: item, event: 'click', handler: handleItemClick });
    });

    // Outside click handler
    const handleOutsideClick = (e) => {
        if (!dropdown.contains(e.target) && dropdown.dataset.state === 'open') {
            dropdown.dataset.state = 'closed';
            menu.dataset.state = 'closed';
            button.setAttribute('aria-expanded', 'false');
            eventBus.publish('DROPDOWN_TOGGLED', {
                dropdownId,
                action: 'close',
                timestamp: Date.now()
            });
        }
    };
    document.addEventListener('click', handleOutsideClick);
    eventHandlers.push({ element: document, event: 'click', handler: handleOutsideClick });

    // Escape key handler
    const handleKeydown = (e) => {
        if (e.key === 'Escape' && dropdown.dataset.state === 'open') {
            dropdown.dataset.state = 'closed';
            menu.dataset.state = 'closed';
            button.setAttribute('aria-expanded', 'false');
            button.focus();
            eventBus.publish('DROPDOWN_TOGGLED', {
                dropdownId,
                action: 'close',
                timestamp: Date.now()
            });
        }
        // Arrow key navigation
        if (dropdown.dataset.state === 'open') {
            const currentItem = document.activeElement;
            const itemsArray = Array.from(items);
            const currentIndex = itemsArray.indexOf(currentItem);
            let newIndex;
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    newIndex = (currentIndex + 1) % items.length;
                    itemsArray[newIndex].focus();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    newIndex = (currentIndex - 1 + items.length) % items.length;
                    itemsArray[newIndex].focus();
                    break;
                case 'Home':
                    e.preventDefault();
                    itemsArray[0].focus();
                    break;
                case 'End':
                    e.preventDefault();
                    itemsArray[items.length - 1].focus();
                    break;
            }
        }
    };
    dropdown.addEventListener('keydown', handleKeydown);
    eventHandlers.push({ element: dropdown, event: 'keydown', handler: handleKeydown });

    // Initial state
    dropdown.dataset.state = 'closed';
    menu.dataset.state = 'closed';
    button.setAttribute('aria-expanded', 'false');

    // Publish initialized event
    eventBus.publish('DROPDOWN_INITIALIZED', {
        dropdownId,
        itemCount: items.length,
        timestamp: Date.now()
    });

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Toggle dropdown state
 */
export function toggleDropdown(dropdown, button = null, eventBus = null) {
    const currentState = dropdown.dataset.state;
    const isOpen = currentState === 'open';
    const action = isOpen ? 'close' : 'open';
    const menu = dropdown.querySelector('.dropdown-content');

    dropdown.dataset.state = isOpen ? 'closed' : 'open';
    if (menu) {
        menu.dataset.state = isOpen ? 'closed' : 'open';
    }
    if (button) {
        button.setAttribute('aria-expanded', !isOpen);
    }

    if (eventBus) {
        eventBus.publish('DROPDOWN_TOGGLED', {
            dropdownId: dropdown.id,
            action,
            timestamp: Date.now()
        });
    }
}
