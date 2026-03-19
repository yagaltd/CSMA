const SCROLL_LOCK_COUNT_KEY = 'scrollLockCount';
const SCROLL_LOCKED_KEY = 'scrollLocked';

function getBody() {
    return document.body;
}

export function lockDocumentScroll() {
    const body = getBody();
    const currentCount = Number(body.dataset[SCROLL_LOCK_COUNT_KEY] || '0');
    const nextCount = currentCount + 1;

    body.dataset[SCROLL_LOCK_COUNT_KEY] = String(nextCount);
    body.dataset[SCROLL_LOCKED_KEY] = 'true';
}

export function unlockDocumentScroll() {
    const body = getBody();
    const currentCount = Number(body.dataset[SCROLL_LOCK_COUNT_KEY] || '0');
    const nextCount = Math.max(currentCount - 1, 0);

    if (nextCount === 0) {
        delete body.dataset[SCROLL_LOCK_COUNT_KEY];
        delete body.dataset[SCROLL_LOCKED_KEY];
        return;
    }

    body.dataset[SCROLL_LOCK_COUNT_KEY] = String(nextCount);
    body.dataset[SCROLL_LOCKED_KEY] = 'true';
}
