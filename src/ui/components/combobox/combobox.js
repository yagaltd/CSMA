/**
 * CSMA Combobox Component
 * Input with autocomplete dropdown using EventBus
 * 
 * Contracts: INTENT_COMBOBOX_SELECT, INTENT_COMBOBOX_FILTER, COMBOBOX_CHANGED
 */

/**
 * Initialize Combobox system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initComboboxSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Combobox] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const comboboxes = document.querySelectorAll('.combobox');

    comboboxes.forEach(combobox => {
        const cleanup = initCombobox(combobox, eventBus);
        cleanups.push(cleanup);
    });

    const unsubscribe = eventBus.subscribe('INTENT_COMBOBOX_SELECT', (payload) => {
        const combobox = document.getElementById(payload.comboboxId);
        if (combobox) {
            selectItem(combobox, payload.value, eventBus);
        }
    });

    return () => {
        unsubscribe();
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single combobox
 */
function initCombobox(combobox, eventBus) {
    const trigger = combobox.querySelector('.combobox-trigger');
    const input = combobox.querySelector('.combobox-input');
    const content = combobox.querySelector('.combobox-content');
    const items = Array.from(combobox.querySelectorAll('.combobox-item'));
    const eventHandlers = [];

    if (!trigger || !content) return () => {};

    // Assign ID if not present
    if (!combobox.id) {
        combobox.id = `combobox-${Math.random().toString(36).substr(2, 9)}`;
    }

    let isOpen = false;
    let highlightedIndex = -1;
    let selectedValue = null;

    // Get initial selected
    const selected = items.find(item => item.dataset.selected === 'true');
    if (selected) {
        selectedValue = selected.dataset.value;
        if (input) input.value = selected.textContent.trim();
    }

    const open = () => {
        isOpen = true;
        content.dataset.state = 'open';
        trigger.dataset.state = 'open';
        highlightedIndex = -1;
    };

    const close = () => {
        isOpen = false;
        content.dataset.state = 'closed';
        trigger.dataset.state = 'closed';
        highlightedIndex = -1;
    };

    const toggle = () => {
        if (isOpen) close();
        else open();
    };

    const highlightItem = (index) => {
        items.forEach((item, i) => {
            item.dataset.highlighted = i === index ? 'true' : 'false';
        });
        highlightedIndex = index;
        
        // Scroll into view
        if (index >= 0 && items[index]) {
            items[index].scrollIntoView({ block: 'nearest' });
        }
    };

    const selectHighlighted = () => {
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
            selectItem(combobox, items[highlightedIndex].dataset.value, eventBus);
            close();
        }
    };

    const filterItems = (query) => {
        const lowerQuery = query.toLowerCase();
        let hasVisible = false;

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            const matches = text.includes(lowerQuery);
            item.hidden = !matches;
            if (matches) hasVisible = true;
        });

        // Toggle empty state
        const empty = combobox.querySelector('.combobox-empty');
        if (empty) {
            empty.hidden = hasVisible;
        }

        eventBus.publish('COMBOBOX_FILTERED', {
            comboboxId: combobox.id,
            query,
            hasResults: hasVisible
        });
    };

    // Click trigger to toggle
    const handleTriggerClick = (e) => {
        e.preventDefault();
        toggle();
        if (input) input.focus();
    };

    trigger.addEventListener('click', handleTriggerClick);
    eventHandlers.push({ element: trigger, event: 'click', handler: handleTriggerClick });

    // Input handling
    if (input) {
        const handleInput = (e) => {
            if (!isOpen) open();
            filterItems(e.target.value);
        };

        input.addEventListener('input', handleInput);
        eventHandlers.push({ element: input, event: 'input', handler: handleInput });
    }

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
            e.preventDefault();
            open();
            return;
        }

        const visibleItems = items.filter(item => !item.hidden);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                highlightItem((highlightedIndex + 1) % visibleItems.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                highlightItem(highlightedIndex <= 0 ? visibleItems.length - 1 : highlightedIndex - 1);
                break;
            case 'Enter':
                e.preventDefault();
                selectHighlighted();
                break;
            case 'Escape':
                e.preventDefault();
                close();
                break;
            case 'Tab':
                close();
                break;
        }
    };

    combobox.addEventListener('keydown', handleKeyDown);
    eventHandlers.push({ element: combobox, event: 'keydown', handler: handleKeyDown });

    // Item clicks
    items.forEach(item => {
        const handleClick = () => {
            if (item.disabled || item.hasAttribute('disabled')) return;
            selectItem(combobox, item.dataset.value, eventBus);
            close();
        };

        item.addEventListener('click', handleClick);
        eventHandlers.push({ element: item, event: 'click', handler: handleClick });
    });

    // Close on outside click
    const handleOutsideClick = (e) => {
        if (!combobox.contains(e.target)) {
            close();
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
 * Programmatically select an item
 */
function selectItem(combobox, value, eventBus) {
    const input = combobox.querySelector('.combobox-input');
    const trigger = combobox.querySelector('.combobox-trigger');
    const items = combobox.querySelectorAll('.combobox-item');
    
    const targetItem = Array.from(items).find(item => item.dataset.value === value);
    if (!targetItem) return;

    // Update selection state
    items.forEach(item => {
        item.dataset.selected = item.dataset.value === value ? 'true' : 'false';
    });

    // Update input value
    if (input) {
        input.value = targetItem.textContent.trim();
    }

    eventBus.publish('COMBOBOX_CHANGED', {
        comboboxId: combobox.id,
        value,
        label: targetItem.textContent.trim(),
        timestamp: Date.now()
    });
}
