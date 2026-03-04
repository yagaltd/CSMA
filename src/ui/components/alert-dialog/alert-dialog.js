/**
 * Alert Dialog Component JavaScript
 */

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

