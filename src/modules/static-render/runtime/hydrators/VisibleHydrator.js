export function scheduleVisibleHydration(element, callback) {
    if (!('IntersectionObserver' in window)) {
        callback();
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                observer.disconnect();
                callback();
            }
        });
    }, { threshold: 0.1 });
    observer.observe(element);
}
