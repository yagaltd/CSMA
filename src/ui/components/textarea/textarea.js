/**
 * CSMA Textarea Component
 * 
 * ECCA Metadata:
 * - Version: 2.1.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Enhanced with rate limiting to prevent EventBus flooding during rapid typing
 */

import { rateLimiter } from '../../../runtime/RateLimiter.js';

export function initTextareaSystem(eventBus) {
    if (!eventBus) return () => { };

    // Support both CSS class and data attribute selectors
    const groups = document.querySelectorAll('.textarea-group, [data-textarea-group]');
    const cleanups = [];

    groups.forEach(group => {
        const textarea = group.querySelector('.textarea');
        if (!textarea) return;

        const handleInput = () => {
            updateCharCount(group);
            
            // Rate limiting: max 10 input events per second (100ms window)
            // This prevents EventBus flooding during rapid typing
            const rateLimitKey = `textarea-${textarea.id || 'anonymous'}`;
            if (!rateLimiter.checkRateLimit(rateLimitKey, { requests: 10, window: 1000 })) {
                // Skip publishing if rate limit exceeded - still update character count
                return;
            }
            
            eventBus.publish('INTENT_INPUT_CHANGED', {
                inputId: textarea.id || `textarea-${Date.now()}`,
                value: textarea.value,
                isValid: true,
                timestamp: Date.now()
            });
        };
        textarea.addEventListener('input', handleInput);
        cleanups.push(() => textarea.removeEventListener('input', handleInput));

        updateCharCount(group);
    });

    return () => cleanups.forEach(fn => fn());
}

function updateCharCount(group) {
    const textarea = group.querySelector('.textarea');
    const countEl = group.querySelector('.textarea-count');
    if (!countEl || !textarea) return;

    const maxLength = parseInt(group.dataset.maxLength) || 500;
    const count = textarea.value.length;
    countEl.textContent = `${count} / ${maxLength}`;
}
