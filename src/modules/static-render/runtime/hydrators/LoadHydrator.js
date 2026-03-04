export function scheduleLoadHydration(callback) {
    if (document.readyState === 'complete') {
        callback();
        return;
    }
    window.addEventListener('load', () => callback(), { once: true });
}
