/**
 * CSMA Multi-Select Component
 * Multiple selection with tags using EventBus
 * 
 * Contracts: INTENT_MULTI_SELECT_TOGGLE, MULTI_SELECT_CHANGED
 */

/**
 * Initialize Multi-Select system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initMultiSelectSystem(eventBus) {
    if (!eventBus) {
        console.warn('[MultiSelect] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const selects = document.querySelectorAll('.multi-select');

    selects.forEach(select => {
        const cleanup = initMultiSelect(select, eventBus);
        cleanups.push(cleanup);
    });

    const unsubscribe = eventBus.subscribe('INTENT_MULTI_SELECT_TOGGLE', (payload) => {
        const select = document.getElementById(payload.selectId);
        if (select) {
            toggleOption(select, payload.value, payload.selected, eventBus);
        }
    });

    return () => {
        unsubscribe();
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single multi-select
 */
function initMultiSelect(container, eventBus) {
    const trigger = container.querySelector('.multi-select-trigger');
    const dropdown = container.querySelector('.multi-select-dropdown');
    const input = container.querySelector('.multi-select-input');
    const tagsContainer = container.querySelector('.multi-select-tags');
    const placeholder = container.querySelector('.multi-select-placeholder');
    
    if (!trigger || !dropdown) {
        return () => {};
    }

    // Assign ID if not present
    if (!container.id) {
        container.id = `multi-select-${Math.random().toString(36).substr(2, 9)}`;
    }

    const eventHandlers = [];
    let selectedValues = new Set();

    // Parse initial selected values from data attribute
    if (container.dataset.selected) {
        try {
            const initial = JSON.parse(container.dataset.selected);
            initial.forEach(v => selectedValues.add(v));
        } catch (e) {
            // Ignore parse errors
        }
    }

    // Toggle dropdown
    const toggleDropdown = (open) => {
        const newState = open ? 'open' : 'closed';
        trigger.dataset.state = newState;
        dropdown.dataset.state = newState;
    };

    // Update UI
    const updateUI = () => {
        // Update options
        const options = dropdown.querySelectorAll('.multi-select-option');
        options.forEach(option => {
            const value = option.dataset.value;
            option.dataset.selected = selectedValues.has(value) ? 'true' : 'false';
        });

        // Update tags
        if (tagsContainer) {
            tagsContainer.innerHTML = '';
            selectedValues.forEach(value => {
                const option = dropdown.querySelector(`[data-value="${value}"]`);
                const label = option ? option.querySelector('.multi-select-option-label')?.textContent : value;
                const tag = createTag(value, label || value, eventBus, container.id);
                tagsContainer.appendChild(tag);
            });
        }

        // Update placeholder visibility
        if (placeholder) {
            placeholder.style.display = selectedValues.size === 0 ? 'block' : 'none';
        }

        // Update hidden input if present
        const hiddenInput = container.querySelector('input[type="hidden"]');
        if (hiddenInput) {
            hiddenInput.value = JSON.stringify(Array.from(selectedValues));
        }
    };

    // Trigger click
    const handleTriggerClick = (e) => {
        if (e.target.closest('.multi-select-tag-remove')) return;
        const isOpen = trigger.dataset.state === 'open';
        toggleDropdown(!isOpen);
    };
    trigger.addEventListener('click', handleTriggerClick);
    eventHandlers.push({ element: trigger, event: 'click', handler: handleTriggerClick });

    // Option click
    const options = dropdown.querySelectorAll('.multi-select-option');
    options.forEach(option => {
        const handleOptionClick = () => {
            if (option.disabled || option.hasAttribute('disabled')) return;
            const value = option.dataset.value;
            const newSelected = !selectedValues.has(value);
            toggleOption(container, value, newSelected, eventBus);
            selectedValues = getSelectedValues(container);
            updateUI();
        };
        option.addEventListener('click', handleOptionClick);
        eventHandlers.push({ element: option, event: 'click', handler: handleOptionClick });
    });

    // Filter options
    if (input) {
        const handleInput = (e) => {
            const filter = e.target.value.toLowerCase();
            const options = dropdown.querySelectorAll('.multi-select-option');
            let hasVisible = false;

            options.forEach(option => {
                const label = option.textContent.toLowerCase();
                const visible = label.includes(filter);
                option.style.display = visible ? '' : 'none';
                hasVisible = hasVisible || visible;
            });

            // Show/hide empty state
            const empty = dropdown.querySelector('.multi-select-empty');
            if (empty) {
                empty.style.display = hasVisible ? 'none' : '';
            }
        };
        input.addEventListener('input', handleInput);
        eventHandlers.push({ element: input, event: 'input', handler: handleInput });
    }

    // Close on outside click
    const handleOutsideClick = (e) => {
        if (!container.contains(e.target) && trigger.dataset.state === 'open') {
            toggleDropdown(false);
        }
    };
    document.addEventListener('click', handleOutsideClick);
    eventHandlers.push({ element: document, event: 'click', handler: handleOutsideClick });

    // ESC to close
    const handleEscape = (e) => {
        if (e.key === 'Escape' && trigger.dataset.state === 'open') {
            toggleDropdown(false);
            input?.focus();
        }
    };
    document.addEventListener('keydown', handleEscape);
    eventHandlers.push({ element: document, event: 'keydown', handler: handleEscape });

    // Initial UI update
    updateUI();

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Create a tag element
 */
function createTag(value, label, eventBus, selectId) {
    const tag = document.createElement('span');
    tag.className = 'multi-select-tag';
    tag.dataset.value = value;

    tag.innerHTML = `
        <span class="multi-select-tag-label">${label}</span>
        <button type="button" class="multi-select-tag-remove" aria-label="Remove ${label}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;

    const removeBtn = tag.querySelector('.multi-select-tag-remove');
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        eventBus.publish('INTENT_MULTI_SELECT_TOGGLE', {
            selectId,
            value,
            selected: false,
            timestamp: Date.now()
        });
    });

    return tag;
}

/**
 * Toggle an option
 */
function toggleOption(container, value, selected, eventBus) {
    const dropdown = container.querySelector('.multi-select-dropdown');
    const option = dropdown?.querySelector(`[data-value="${value}"]`);
    
    if (option) {
        option.dataset.selected = selected ? 'true' : 'false';
    }

    const selectedValues = getSelectedValues(container);

    eventBus.publish('MULTI_SELECT_CHANGED', {
        selectId: container.id,
        value,
        selected,
        selectedValues: Array.from(selectedValues),
        timestamp: Date.now()
    });
}

/**
 * Get selected values from container
 */
function getSelectedValues(container) {
    const selected = new Set();
    const options = container.querySelectorAll('.multi-select-option[data-selected="true"]');
    options.forEach(option => {
        selected.add(option.dataset.value);
    });
    return selected;
}
