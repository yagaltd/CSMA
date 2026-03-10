/**
 * CSMA Progress Component
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Contracts: INTENT_PROGRESS_UPDATE, PROGRESS_UPDATE, PROGRESS_COMPLETED
 */

export function initProgressSystem(eventBus) {
    if (!eventBus) return () => { };

    // Subscribe to progress update intents
    const unsubscribe = eventBus.subscribe('INTENT_PROGRESS_UPDATE', (payload) => {
        try {
            const container = document.getElementById(payload.progressId);
            if (container) {
                setProgress(container, payload.percentage);

                // Publish progress update event
                eventBus.publish('PROGRESS_UPDATE', {
                    progressId: payload.progressId,
                    percentage: payload.percentage,
                    status: payload.status || 'loading',
                    label: payload.label,
                    timestamp: Date.now()
                });

                // Publish completed event if at 100%
                if (payload.percentage >= 100) {
                    eventBus.publish('PROGRESS_COMPLETED', {
                        progressId: payload.progressId,
                        timestamp: Date.now()
                    });
                }
            }
        } catch (error) {
            console.error('[Progress] Failed to update:', error);
        }
    });

    return () => {
        unsubscribe();
    };
}

/**
 * Set progress value using CSS custom property (C-DAD compliant)
 */
export function setProgress(container, percentage) {
    const bar = container.querySelector('.progress-bar');
    const label = container.querySelector('.progress-percentage')
        || container.parentElement?.querySelector('.progress-percentage');

    const value = Math.min(100, Math.max(0, percentage));

    if (bar) {
        // Set CSS custom property on container (inherited by bar)
        container.style.setProperty('--progress-value', `${value}%`);
        bar.setAttribute('aria-valuenow', value);
    }

    if (label) {
        label.textContent = `${Math.round(value)}%`;
    }
}

/**
 * Set indeterminate state
 */
export function setIndeterminate(container, indeterminate) {
    container.dataset.state = indeterminate ? 'indeterminate' : 'default';
}
