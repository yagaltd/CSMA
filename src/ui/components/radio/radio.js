/**
 * CSMA Radio Component
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 */

export function initRadioSystem(eventBus) {
    if (!eventBus) return () => { };

    // Support both CSS class and data attribute selectors
    const groups = document.querySelectorAll('.radio-group, [data-radio-group]');
    const cleanups = [];

    groups.forEach(group => {
        const radios = group.querySelectorAll('.radio-input');
        const items = group.querySelectorAll('.radio-item');

        radios.forEach(radio => {
            const handleChange = () => {
                if (radio.checked) {
                    // Update visual states for all items in this group
                    items.forEach(item => {
                        const itemInput = item.querySelector('.radio-input');
                        item.dataset.state = itemInput?.checked ? 'checked' : 'unchecked';
                    });

                    eventBus.publish('INTENT_INPUT_CHANGED', {
                        inputId: group.id || `radio-group-${Date.now()}`,
                        value: radio.value,
                        isValid: true,
                        timestamp: Date.now()
                    });
                }
            };

            radio.addEventListener('change', handleChange);
            cleanups.push(() => radio.removeEventListener('change', handleChange));
        });

        // Handle clicks on styled radio items
        items.forEach(item => {
            const handleItemClick = (e) => {
                const radio = item.querySelector('.radio-input');
                const itemState = item.dataset.state;
                
                if (!radio || itemState === 'disabled') return;
                
                // Don't toggle if clicking on the actual input
                if (e.target === radio) return;
                
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            };

            item.addEventListener('click', handleItemClick);
            cleanups.push(() => item.removeEventListener('click', handleItemClick));
        });
    });

    return () => cleanups.forEach(fn => fn());
}

