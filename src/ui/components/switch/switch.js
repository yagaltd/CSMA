/**
 * CSMA Switch Component
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 */

export function initSwitchSystem(eventBus) {
    if (!eventBus) return () => { };

    // Support both CSS class and data attribute selectors
    const groups = document.querySelectorAll('.switch-group, [data-switch-group]');
    const cleanups = [];

    groups.forEach(group => {
        const input = group.querySelector('.switch-input');
        if (!input) return;

        const handleChange = () => {
            group.dataset.state = input.checked ? 'checked' : 'unchecked';
            group.setAttribute('aria-checked', input.checked);

            eventBus.publish('INTENT_INPUT_CHANGED', {
                inputId: input.id || `switch-${Date.now()}`,
                value: input.checked.toString(),
                isValid: true,
                timestamp: Date.now()
            });
        };

        input.addEventListener('change', handleChange);
        cleanups.push(() => input.removeEventListener('change', handleChange));

        // Handle clicks on the styled switch (not the hidden input)
        const handleGroupClick = (e) => {
            // Don't toggle if clicking on the actual input or if disabled
            if (e.target === input || group.dataset.state === 'disabled') return;
            
            input.checked = !input.checked;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        group.addEventListener('click', handleGroupClick);
        cleanups.push(() => group.removeEventListener('click', handleGroupClick));

        // Keyboard support
        const handleKeydown = (e) => {
            if ((e.key === ' ' || e.key === 'Enter') && group.dataset.state !== 'disabled') {
                e.preventDefault();
                group.click();
            }
        };

        group.addEventListener('keydown', handleKeydown);
        cleanups.push(() => group.removeEventListener('keydown', handleKeydown));

        group.dataset.state = input.checked ? 'checked' : 'unchecked';
        group.setAttribute('aria-checked', input.checked);
        
        // If the input is disabled, make sure group state reflects that
        if (input.disabled) {
            group.dataset.state = 'disabled';
            group.setAttribute('aria-disabled', 'true');
        }
    });

    return () => cleanups.forEach(fn => fn());
}
