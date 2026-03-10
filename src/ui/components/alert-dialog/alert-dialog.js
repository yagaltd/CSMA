/**
 * Alert Dialog Component JavaScript
 */

export function initAlertDialogSystem(eventBus) {
    if (!eventBus) {
        console.warn('[AlertDialog] EventBus not provided');
        return () => {};
    }

    const overlays = document.querySelectorAll('.alert-dialog-overlay');
    const cleanups = Array.from(overlays).map((overlay) => initAlertDialog(overlay, eventBus));

    const unsubscribeOpen = eventBus.subscribe('INTENT_ALERT_DIALOG_OPEN', (payload) => {
        openAlertDialog(payload.id || payload.dialogId);
    });

    const unsubscribeClose = eventBus.subscribe('INTENT_ALERT_DIALOG_CLOSE', (payload) => {
        closeAlertDialog(payload.id || payload.dialogId);
    });

    return () => {
        unsubscribeOpen();
        unsubscribeClose();
        cleanups.forEach((cleanup) => cleanup());
    };
}

function initAlertDialog(overlay, eventBus) {
    if (!overlay.id) {
        overlay.id = `alert-dialog-${Math.random().toString(36).slice(2, 9)}`;
    }

    const handlers = [];
    overlay.dataset.state = overlay.dataset.state || 'closed';

    const closeButtons = overlay.querySelectorAll('.alert-dialog-cancel, .alert-dialog-action, [data-alert-dialog-close]');
    closeButtons.forEach((button) => {
        const handleClick = () => {
            eventBus.publish('INTENT_ALERT_DIALOG_CLOSE', {
                id: overlay.id,
                timestamp: Date.now()
            });
        };
        button.addEventListener('click', handleClick);
        handlers.push({ element: button, event: 'click', handler: handleClick });
    });

    const handleBackdropClick = (event) => {
        if (event.target === overlay) {
            eventBus.publish('INTENT_ALERT_DIALOG_CLOSE', {
                id: overlay.id,
                timestamp: Date.now()
            });
        }
    };
    overlay.addEventListener('click', handleBackdropClick);
    handlers.push({ element: overlay, event: 'click', handler: handleBackdropClick });

    const handleEscape = (event) => {
        if (event.key === 'Escape' && overlay.dataset.state === 'open') {
            eventBus.publish('INTENT_ALERT_DIALOG_CLOSE', {
                id: overlay.id,
                timestamp: Date.now()
            });
        }
    };
    document.addEventListener('keydown', handleEscape);
    handlers.push({ element: document, event: 'keydown', handler: handleEscape });

    return () => {
        handlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

export function openAlertDialog(dialogId) {
    const overlay = document.getElementById(dialogId);
    if (overlay) {
        overlay.dataset.state = 'open';
        document.body.style.overflow = 'hidden';
    }
}

export function closeAlertDialog(dialogId) {
    const overlay = document.getElementById(dialogId);
    if (overlay) {
        overlay.dataset.state = 'closed';
        document.body.style.overflow = '';
    }
}
