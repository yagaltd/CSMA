/**
 * CSMA Toggle Group Component
 * Group of toggle buttons using EventBus
 * 
 * Contracts: INTENT_TOGGLE_GROUP_SELECT, TOGGLE_GROUP_CHANGED
 */

/**
 * Initialize Toggle Group system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initToggleGroupSystem(eventBus) {
    if (!eventBus) {
        console.warn('[ToggleGroup] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const groups = document.querySelectorAll('.toggle-group');

    groups.forEach(group => {
        const cleanup = initToggleGroup(group, eventBus);
        cleanups.push(cleanup);
    });

    const unsubscribe = eventBus.subscribe('INTENT_TOGGLE_GROUP_SELECT', (payload) => {
        const group = document.getElementById(payload.groupId);
        if (group) {
            selectItem(group, payload.value, eventBus);
        }
    });

    return () => {
        unsubscribe();
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single toggle group
 */
function initToggleGroup(group, eventBus) {
    const items = group.querySelectorAll('.toggle-group-item');
    const eventHandlers = [];
    
    // Assign ID if not present
    if (!group.id) {
        group.id = `toggle-group-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Get group type (single or multiple)
    const type = group.dataset.type || 'single';
    const allowDeselect = group.dataset.allowDeselect !== 'false';

    // Get initial selected values
    let selectedValues = new Set();
    items.forEach(item => {
        if (item.dataset.state === 'on') {
            selectedValues.add(item.dataset.value);
        }
    });

    items.forEach(item => {
        const handleClick = () => {
            if (item.disabled || item.hasAttribute('disabled')) return;

            const value = item.dataset.value;

            if (type === 'single') {
                // Single select mode
                const wasSelected = selectedValues.has(value);
                
                // Deselect all
                items.forEach(i => {
                    i.dataset.state = 'off';
                });
                selectedValues.clear();

                // Select new item (or deselect if allowDeselect)
                if (!wasSelected || !allowDeselect) {
                    item.dataset.state = 'on';
                    selectedValues.add(value);
                }
            } else {
                // Multiple select mode
                if (selectedValues.has(value)) {
                    selectedValues.delete(value);
                    item.dataset.state = 'off';
                } else {
                    selectedValues.add(value);
                    item.dataset.state = 'on';
                }
            }

            eventBus.publish('TOGGLE_GROUP_CHANGED', {
                groupId: group.id,
                value,
                selectedValues: Array.from(selectedValues),
                type,
                timestamp: Date.now()
            });
        };

        item.addEventListener('click', handleClick);
        eventHandlers.push({ element: item, event: 'click', handler: handleClick });
    });

    // Keyboard navigation
    const handleKeyDown = (e) => {
        const focusableItems = Array.from(items).filter(item => !item.disabled);
        const currentIndex = focusableItems.indexOf(document.activeElement);

        let nextIndex = -1;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            nextIndex = (currentIndex + 1) % focusableItems.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            nextIndex = (currentIndex - 1 + focusableItems.length) % focusableItems.length;
        } else if (e.key === 'Home') {
            e.preventDefault();
            nextIndex = 0;
        } else if (e.key === 'End') {
            e.preventDefault();
            nextIndex = focusableItems.length - 1;
        }

        if (nextIndex >= 0) {
            focusableItems[nextIndex].focus();
        }
    };

    group.addEventListener('keydown', handleKeyDown);
    eventHandlers.push({ element: group, event: 'keydown', handler: handleKeyDown });

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Programmatically select an item
 */
function selectItem(group, value, eventBus) {
    const items = group.querySelectorAll('.toggle-group-item');
    const type = group.dataset.type || 'single';
    const targetItem = Array.from(items).find(item => item.dataset.value === value);

    if (!targetItem) return;

    // Update state
    if (type === 'single') {
        items.forEach(i => {
            i.dataset.state = 'off';
        });
        targetItem.dataset.state = 'on';
    } else {
        targetItem.dataset.state = targetItem.dataset.state === 'on' ? 'off' : 'on';
    }

    // Get all selected
    const selectedValues = Array.from(items)
        .filter(i => i.dataset.state === 'on')
        .map(i => i.dataset.value);

    eventBus.publish('TOGGLE_GROUP_CHANGED', {
        groupId: group.id,
        value,
        selectedValues,
        type,
        timestamp: Date.now()
    });
}
