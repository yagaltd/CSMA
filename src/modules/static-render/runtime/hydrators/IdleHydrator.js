export function scheduleIdleHydration(callback) {
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(callback, { timeout: 1000 });
        return;
    }
    setTimeout(callback, 500);
}
