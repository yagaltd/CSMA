/**
 * CSMA Command Palette Component
 * Keyboard-accessible command palette UI using EventBus
 * Works with CommandService for search and filtering
 * 
 * Contracts: INTENT_COMMAND_OPEN, INTENT_COMMAND_CLOSE, COMMAND_EXECUTED
 */

/**
 * Initialize Command palette UI with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initCommandUI(eventBus) {
    if (!eventBus) {
        console.warn('[Command] EventBus not provided');
        return () => {};
    }

    const overlay = document.querySelector('.command-overlay');
    if (!overlay) {
        return () => {};
    }

    const command = overlay.querySelector('.command');
    const input = overlay.querySelector('.command-input');
    const list = overlay.querySelector('.command-list');
    
    const eventHandlers = [];
    let selectedIndex = 0;
    let visibleItems = [];

    // Set initial state
    overlay.dataset.state = 'closed';

    // Open command palette
    const openCommand = (trigger = 'click') => {
        overlay.dataset.state = 'open';
        input?.focus();
        input.value = '';
        selectedIndex = 0;
        updateVisibleItems();
        updateSelection();
        eventBus.publish('COMMAND_OPENED', {
            trigger,
            timestamp: Date.now()
        });
    };

    // Close command palette
    const closeCommand = (trigger = 'blur') => {
        overlay.dataset.state = 'closed';
        input.value = '';
        eventBus.publish('COMMAND_CLOSED', {
            trigger,
            timestamp: Date.now()
        });
    };

    // Update visible items based on filter
    const updateVisibleItems = () => {
        const filter = input?.value.toLowerCase() || '';
        const groups = list?.querySelectorAll('.command-group') || [];
        visibleItems = [];

        groups.forEach(group => {
            const items = group.querySelectorAll('.command-item');
            let groupHasVisible = false;

            items.forEach(item => {
                const label = item.querySelector('.command-item-label')?.textContent.toLowerCase() || '';
                const keywords = item.dataset.keywords?.toLowerCase() || '';
                const matches = label.includes(filter) || keywords.includes(filter);
                
                item.style.display = matches ? '' : 'none';
                if (matches) {
                    visibleItems.push(item);
                    groupHasVisible = true;
                }
            });

            // Hide group if no visible items
            group.style.display = groupHasVisible ? '' : 'none';
        });

        // Update empty state
        const empty = list?.querySelector('.command-empty');
        if (empty) {
            list.dataset.empty = visibleItems.length === 0 ? 'true' : 'false';
            empty.style.display = visibleItems.length === 0 ? '' : 'none';
        }

        selectedIndex = 0;
    };

    // Update selection highlight
    const updateSelection = () => {
        visibleItems.forEach((item, index) => {
            item.dataset.selected = index === selectedIndex ? 'true' : 'false';
        });
    };

    // Execute selected command
    const executeCommand = (item) => {
        const action = item.dataset.action;
        const value = item.dataset.value;
        
        eventBus.publish('COMMAND_EXECUTED', {
            commandId: value || action || item.textContent.trim().toLowerCase().replace(/\s+/g, '-'),
            command: action || value || item.textContent.trim(),
            payload: value ? { value } : undefined,
            timestamp: Date.now()
        });

        closeCommand('execute');
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (overlay.dataset.state !== 'open') {
            // Open on Cmd/Ctrl + K
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                openCommand('keyboard');
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, visibleItems.length - 1);
                updateSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (visibleItems[selectedIndex]) {
                    executeCommand(visibleItems[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                closeCommand('escape');
                break;
        }
    };

    // Event subscriptions
    document.addEventListener('keydown', handleKeyDown);
    eventHandlers.push({ element: document, event: 'keydown', handler: handleKeyDown });

    // Input handler
    if (input) {
        const handleInput = () => {
            updateVisibleItems();
            updateSelection();
        };
        input.addEventListener('input', handleInput);
        eventHandlers.push({ element: input, event: 'input', handler: handleInput });
    }

    // Overlay click to close
    const handleOverlayClick = (e) => {
        if (e.target === overlay) {
            closeCommand('blur');
        }
    };
    overlay.addEventListener('click', handleOverlayClick);
    eventHandlers.push({ element: overlay, event: 'click', handler: handleOverlayClick });

    // Item click handlers
    const items = list?.querySelectorAll('.command-item') || [];
    items.forEach(item => {
        const handleClick = () => executeCommand(item);
        item.addEventListener('click', handleClick);
        eventHandlers.push({ element: item, event: 'click', handler: handleClick });
    });

    // EventBus subscriptions
    const unsubscribeOpen = eventBus.subscribe('INTENT_COMMAND_OPEN', (payload = {}) => {
        openCommand(payload.trigger || 'click');
    });
    const unsubscribeClose = eventBus.subscribe('INTENT_COMMAND_CLOSE', (payload = {}) => {
        closeCommand(payload.trigger || 'blur');
    });

    return () => {
        unsubscribeOpen();
        unsubscribeClose();
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}
