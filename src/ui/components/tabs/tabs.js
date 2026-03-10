/**
 * CSMA Tabs Component
 * Tab navigation system using EventBus
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Contracts: INTENT_TAB_SWITCH, TAB_SWITCHED
 */

/**
 * Initialize Tabs system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initTabsSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Tabs] EventBus not provided, Tabs system not initialized');
        return () => { };
    }


    // Track initialized tabs
    const tabsCleanups = new Map();

    // Initialize all tabs on page - support both CSS class and data attribute
    const containers = document.querySelectorAll('.tabs-container, .tabs[data-tabs], [data-tabs]');
    containers.forEach(container => {
        const cleanup = initTabsWithEventBus(container, eventBus);
        if (container.id) {
            tabsCleanups.set(container.id, cleanup);
        }
    });

    // Subscribe to tab switch intents
    const unsubscribe = eventBus.subscribe('INTENT_TAB_SWITCH', (payload) => {
        try {
            const container = document.getElementById(payload.containerId);
            if (container) {
                const tab = container.querySelector(`[data-tab-id="${payload.tabId}"]`);
                if (tab) {
                    const tabs = Array.from(container.querySelectorAll('.tabs-trigger'));
                    const tabIndex = tabs.indexOf(tab);
                    if (tabIndex !== -1) {
                        switchTab(container, tabIndex, payload.tabId, eventBus);
                    }
                }
            }
        } catch (error) {
            console.error('[Tabs] Failed to switch tab:', error);
        }
    });


    // Return cleanup function
    return () => {
        unsubscribe();
        tabsCleanups.forEach(cleanup => cleanup());
        tabsCleanups.clear();
    };
}

/**
 * Initialize tabs with EventBus integration
 * @param {HTMLElement} container - Tabs container element
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
function initTabsWithEventBus(container, eventBus) {
    if (!container || !eventBus) return () => { };

    const containerId = container.id || `tabs-${Date.now()}`;
    if (!container.id) container.id = containerId;

    const tablist = container.querySelector('.tabs-list');
    const tabs = container.querySelectorAll('.tabs-trigger');
    const eventHandlers = [];

    // Click handler for tabs
    tabs.forEach((tab, index) => {
        const handleClick = () => {
            const tabId = tab.dataset.tabId || tab.id || `tab-${index}`;
            switchTab(container, index, tabId, eventBus);
        };
        tab.addEventListener('click', handleClick);
        eventHandlers.push({ element: tab, event: 'click', handler: handleClick });
    });

    // Keyboard navigation
    if (tablist) {
        const handleKeydown = (e) => {
            const currentTab = document.activeElement;
            const tabsArray = Array.from(tabs);
            const currentIndex = tabsArray.indexOf(currentTab);

            let newIndex;
            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    newIndex = (currentIndex + 1) % tabs.length;
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    break;
                case 'Home':
                    e.preventDefault();
                    newIndex = 0;
                    break;
                case 'End':
                    e.preventDefault();
                    newIndex = tabs.length - 1;
                    break;
                default:
                    return;
            }

            tabs[newIndex].focus();
            const tabId = tabs[newIndex].dataset.tabId || tabs[newIndex].id || `tab-${newIndex}`;
            switchTab(container, newIndex, tabId, eventBus);
        };
        tablist.addEventListener('keydown', handleKeydown);
        eventHandlers.push({ element: tablist, event: 'keydown', handler: handleKeydown });
    }

    // Cleanup function
    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Switch to a specific tab by index
 * @param {HTMLElement} container - Tabs container
 * @param {number} tabIndex - Tab index to switch to
 * @param {string} tabId - Tab ID (optional)
 * @param {EventBus} eventBus - EventBus instance (optional)
 */
export function switchTab(container, tabIndex, tabId = null, eventBus = null) {
    const tabs = container.querySelectorAll('.tabs-trigger');
    const panels = container.querySelectorAll('.tabs-panel');
    const containerId = container.id;

    // Get previous active tab
    const previousTab = Array.from(tabs).find(tab => tab.getAttribute('aria-selected') === 'true');
    const previousTabId = previousTab ? (previousTab.dataset.tabId || previousTab.id) : undefined;

    tabs.forEach((tab, index) => {
        const isSelected = index === tabIndex;
        tab.setAttribute('aria-selected', isSelected);
    });

    panels.forEach((panel, index) => {
        panel.dataset.state = index === tabIndex ? 'active' : 'inactive';
    });

    // Publish tab switched event if EventBus is available
    if (eventBus) {
        const payload = {
            containerId,
            tabId: tabId || `tab-${tabIndex}`,
            timestamp: Date.now()
        };
        if (previousTabId) {
            payload.previousTab = previousTabId;
        }
        eventBus.publish('TAB_SWITCHED', payload);
    }
}
