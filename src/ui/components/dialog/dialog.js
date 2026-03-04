/**
 * CSMA Dialog Component
 * Modal dialog system using EventBus
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Contracts: INTENT_MODAL_OPEN, INTENT_MODAL_CLOSE
 */

/**
 * Initialize Dialog system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initDialogSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Dialog] EventBus not provided, Dialog system not initialized');
        return () => { };
    }

    const dialogCleanups = new Map();
    const dialogs = document.querySelectorAll('.dialog-overlay');

    dialogs.forEach(dialog => {
        const cleanup = initDialog(dialog, eventBus);
        if (dialog.id) {
            dialogCleanups.set(dialog.id, cleanup);
        }
    });

    const unsubscribeOpen = eventBus.subscribe('INTENT_MODAL_OPEN', (payload) => {
        try {
            openDialog(payload.modalId);
        } catch (error) {
            console.error('[Dialog] Failed to open dialog:', error);
        }
    });

    const unsubscribeClose = eventBus.subscribe('INTENT_MODAL_CLOSE', (payload) => {
        try {
            closeDialog(payload.modalId, payload.reason || 'button');
        } catch (error) {
            console.error('[Dialog] Failed to close dialog:', error);
        }
    });

    return () => {
        unsubscribeOpen();
        unsubscribeClose();
        dialogCleanups.forEach(cleanup => cleanup());
        dialogCleanups.clear();
    };
}

/**
 * Initialize a single dialog with EventBus integration
 * @param {HTMLElement} overlay - Dialog overlay element
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
function initDialog(overlay, eventBus) {
    if (!overlay || !eventBus) return () => { };

    const dialogId = overlay.id;
    const closeBtn = overlay.querySelector('.dialog-close');
    const eventHandlers = [];

    // Close on overlay click
    const handleOverlayClick = (e) => {
        if (e.target === overlay && overlay.dataset.state === 'open') {
            eventBus.publish('INTENT_MODAL_CLOSE', {
                modalId: dialogId,
                reason: 'backdrop',
                timestamp: Date.now()
            });
        }
    };
    overlay.addEventListener('click', handleOverlayClick);
    eventHandlers.push({ element: overlay, event: 'click', handler: handleOverlayClick });

    // Close button
    if (closeBtn) {
        const handleCloseClick = () => {
            eventBus.publish('INTENT_MODAL_CLOSE', {
                modalId: dialogId,
                reason: 'button',
                timestamp: Date.now()
            });
        };
        closeBtn.addEventListener('click', handleCloseClick);
        eventHandlers.push({ element: closeBtn, event: 'click', handler: handleCloseClick });
    }

    // ESC key (global listener)
    const handleEscape = (e) => {
        if (e.key === 'Escape' && overlay.dataset.state === 'open') {
            eventBus.publish('INTENT_MODAL_CLOSE', {
                modalId: dialogId,
                reason: 'escape',
                timestamp: Date.now()
            });
        }
    };
    document.addEventListener('keydown', handleEscape);
    eventHandlers.push({ element: document, event: 'keydown', handler: handleEscape });

    // Cleanup function
    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Open a dialog by ID
 * Can be called directly or via EventBus (INTENT_MODAL_OPEN)
 * @param {string} dialogId - Dialog element ID
 */
export function openDialog(dialogId) {
    const overlay = document.getElementById(dialogId);
    if (overlay) {
        overlay.dataset.state = 'open';
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close a dialog by ID
 * Can be called directly or via EventBus (INTENT_MODAL_CLOSE)
 * @param {string} dialogId - Dialog element ID
 * @param {string} reason - Close reason (button, backdrop, escape)
 */
export function closeDialog(dialogId, reason = 'button') {
    const overlay = document.getElementById(dialogId);
    if (overlay) {
        overlay.dataset.state = 'closed';
        document.body.style.overflow = '';
    }
}
