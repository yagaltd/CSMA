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
    eventBus.subscribe('INTENT_DROPDOWN_ITEM_SELECTED', handleDropdownItemSelect);
    
    // Also handle the second test dropdown
    eventBus.subscribe('INTENT_DROPDOWN_ITEM_SELECTED', (payload) => {
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

        if (isPrev || isNext) {
            eventBus.publish('INTENT_PAGINATION_NAVIGATE', {
                direction: isPrev ? 'prev' : 'next',
                timestamp: Date.now()
            });
        } else if (pageNumber && !isNaN(parseInt(pageNumber))) {
            const newPage = parseInt(pageNumber);
            
            // Remove active state from current active button in parent pagination
            const parentPagination = button.closest('.pagination');
            const currentActive = parentPagination.querySelector('.pagination-button[data-state="active"]');
            if (currentActive) {
                currentActive.removeAttribute('data-state');
                currentActive.removeAttribute('aria-current');
            }
            
            // Add active state to clicked button
            button.setAttribute('data-state', 'active');
            button.setAttribute('aria-current', 'page');
            
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
        // No need to remove dropdown listener since it's handled by EventBus subscription
        document.removeEventListener('click', handlePaginationClick);
        document.removeEventListener('keydown', handleKeyboardNavigation);
    };
}

