/**
 * CSMA Checkbox Component
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 */

export function initCheckboxSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Checkbox] EventBus not provided, Checkbox system not initialized');
        return () => { };
    }

    const items = document.querySelectorAll('.checkbox-item');
    const cleanups = [];

    items.forEach(item => {
        const input = item.querySelector('.checkbox-input');
        if (!input) return;

        const handleChange = () => {
            item.dataset.state = input.checked ? 'checked' : 'unchecked';
            eventBus.publish('INTENT_INPUT_CHANGED', {
                inputId: input.id || `checkbox-${Date.now()}`,
                value: input.checked.toString(),
                isValid: true,
                timestamp: Date.now()
            });
        };

        input.addEventListener('change', handleChange);
        cleanups.push(() => input.removeEventListener('change', handleChange));

        // Handle clicks on the styled checkbox (not the hidden input)
        const handleItemClick = (e) => {
            // Don't toggle if clicking on the actual input or if disabled
            if (e.target === input || item.dataset.state === 'disabled') return;
            
            input.checked = !input.checked;
            // Trigger the change event manually
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        item.addEventListener('click', handleItemClick);
        cleanups.push(() => item.removeEventListener('click', handleItemClick));

        item.dataset.state = input.checked ? 'checked' : 'unchecked';
    });

    return () => cleanups.forEach(fn => fn());
}

