/**
 * CSMA Pagination Component
 * Pagination with dropdown integration for items per page selector
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Integrates with dropdown component for responsive items-per-page selector
 */

/**
 * Initialize Pagination system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initPaginationSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Pagination] EventBus not provided, Pagination system not initialized');
        return () => { };
    }

    // Handle pagination size dropdown selections (now handled by dropdown system)
    // Subscribe to dropdown item selection events instead
    const handleDropdownItemSelect = (payload) => {
        // Check if this is from our pagination dropdown
        if (payload.dropdownId === 'pagination-size-dropdown') {
            const value = payload.itemValue;
            const trigger = document.querySelector('.pagination-size-value');
            
            if (trigger && value) {
                trigger.textContent = value;
                
                // Publish pagination size change event
                eventBus.publish('PAGINATION_SIZE_CHANGED', {
                    size: parseInt(value),
                    timestamp: Date.now()
                });
            }
        }
    };

    // Subscribe to dropdown item selection
    const unsubscribePrimaryDropdown = eventBus.subscribe('INTENT_DROPDOWN_ITEM_SELECTED', handleDropdownItemSelect);
    
    // Also handle the second test dropdown
    const unsubscribeSecondaryDropdown = eventBus.subscribe('INTENT_DROPDOWN_ITEM_SELECTED', (payload) => {
        // Handle the second test dropdown
        if (payload.dropdownId === 'pagination-size-dropdown-2') {
            const value = payload.itemValue;
            const trigger = document.querySelector('#pagination-size-dropdown-2 .pagination-size-value');
            
            if (trigger && value) {
                trigger.textContent = value;
                
                // Publish pagination size change event
                eventBus.publish('PAGINATION_SIZE_CHANGED', {
                    size: parseInt(value),
                    timestamp: Date.now()
                });
            }
        }
    });

    // Handle pagination button clicks
    const handlePaginationClick = (e) => {
        const button = e.target.closest('.pagination-button');
        if (!button || button.dataset.state === 'disabled') return;

        const isPrev = button.classList.contains('pagination-prev');
        const isNext = button.classList.contains('pagination-next');
        const pageNumber = button.textContent.trim();
        const parentPagination = button.closest('.pagination');

        if (!parentPagination) return;

        if (isPrev || isNext) {
            const numericButtons = getNumericButtons(parentPagination);
            const currentIndex = numericButtons.findIndex(candidate => candidate.dataset.state === 'active');
            const targetIndex = isPrev ? currentIndex - 1 : currentIndex + 1;
            const targetButton = numericButtons[targetIndex];

            if (targetButton) {
                setActivePage(parentPagination, targetButton);
                eventBus.publish('PAGINATION_PAGE_CHANGED', {
                    page: parseInt(targetButton.textContent.trim(), 10),
                    timestamp: Date.now()
                });
            }

            eventBus.publish('INTENT_PAGINATION_NAVIGATE', {
                direction: isPrev ? 'prev' : 'next',
                timestamp: Date.now()
            });
        } else if (pageNumber && !isNaN(parseInt(pageNumber))) {
            const newPage = parseInt(pageNumber);
            setActivePage(parentPagination, button);
            
            eventBus.publish('PAGINATION_PAGE_CHANGED', {
                page: newPage,
                timestamp: Date.now()
            });
        }
    };

    // Handle keyboard navigation
    const handleKeyboardNavigation = (e) => {
        if (!e.target.closest('.pagination')) return;
        
        const pagination = e.target.closest('.pagination');
        const buttons = Array.from(pagination.querySelectorAll('.pagination-button:not([data-state="disabled"])'));
        const currentIndex = buttons.findIndex(btn => btn === document.activeElement);
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                if (currentIndex > 0) {
                    buttons[currentIndex - 1].focus();
                } else {
                    buttons[buttons.length - 1].focus();
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (currentIndex < buttons.length - 1) {
                    buttons[currentIndex + 1].focus();
                } else {
                    buttons[0].focus();
                }
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (document.activeElement.classList.contains('pagination-button')) {
                    document.activeElement.click();
                }
                break;
            case 'Home':
                e.preventDefault();
                buttons[0]?.focus();
                break;
            case 'End':
                e.preventDefault();
                buttons[buttons.length - 1]?.focus();
                break;
        }
    };

    document.addEventListener('click', handlePaginationClick);
    document.addEventListener('keydown', handleKeyboardNavigation);

    return () => {
        unsubscribePrimaryDropdown();
        unsubscribeSecondaryDropdown();
        document.removeEventListener('click', handlePaginationClick);
        document.removeEventListener('keydown', handleKeyboardNavigation);
    };
}

function getNumericButtons(pagination) {
    return Array.from(pagination.querySelectorAll('.pagination-button'))
        .filter(button => {
            if (button.dataset.state === 'disabled') return false;
            return Number.isFinite(parseInt(button.textContent.trim(), 10));
        });
}

function setActivePage(pagination, button) {
    const numericButtons = getNumericButtons(pagination);
    numericButtons.forEach(candidate => {
        candidate.removeAttribute('data-state');
        candidate.removeAttribute('aria-current');
    });

    button.setAttribute('data-state', 'active');
    button.setAttribute('aria-current', 'page');

    const activeIndex = numericButtons.indexOf(button);
    const prevButton = pagination.querySelector('.pagination-prev');
    const nextButton = pagination.querySelector('.pagination-next');

    if (prevButton) {
        if (activeIndex <= 0) prevButton.setAttribute('data-state', 'disabled');
        else prevButton.removeAttribute('data-state');
    }

    if (nextButton) {
        if (activeIndex >= numericButtons.length - 1) nextButton.setAttribute('data-state', 'disabled');
        else nextButton.removeAttribute('data-state');
    }
}
