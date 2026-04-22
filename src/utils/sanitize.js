/**
 * Input Sanitization Utilities
 * XSS and injection prevention
 */

/**
 * Sanitize HTML - prevents XSS attacks
 */
export function sanitizeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text; // Auto-escapes HTML entities
    return div.innerHTML;
}

/**
 * Sanitize URL - prevents javascript: and data: attacks
 */
export function sanitizeURL(url) {
    try {
        const parsed = new URL(url);
        // Only allow safe protocols
        if (['http:', 'https:'].includes(parsed.protocol)) {
            return parsed.href;
        }
    } catch {
        return null;
    }
    return null;
}

/**
 * Sanitize LLM input - prevents prompt injection
 */
export function sanitizeLLMInput(userInput) {
    // Remove prompt injection attempts
    let cleaned = userInput
        .replace(/ignore\s+previous\s+instructions/gi, '[REMOVED]')
        .replace(/disregard\s+all\s+above/gi, '[REMOVED]')
        .replace(/you\s+are\s+now/gi, '[REMOVED]')
        .replace(/system\s+prompt:/gi, '[REMOVED]')
        .replace(/<\|im_start\|>/gi, '[REMOVED]')
        .replace(/<\|im_end\|>/gi, '[REMOVED]');

    // Limit special characters
    cleaned = cleaned.replace(/[^\w\s.,!?'-]/g, '');

    // Truncate to safe length (4K tokens ~ 16K chars)
    if (cleaned.length > 16000) {
        cleaned = cleaned.substring(0, 16000);
    }

    return cleaned;
}

/**
 * Sanitize CSS class name - prevents CSS injection
 * @param {string} input - User-controlled input
 * @param {Set<string>} allowedClasses - Whitelist of allowed class names
 * @returns {string} Safe class name or default fallback
 */
export function sanitizeClassName(input, allowedClasses) {
    // Validate input is a string
    if (typeof input !== 'string') {
        console.warn('[SECURITY] Invalid class name type:', typeof input);
        return 'default';
    }

    // Check against whitelist
    if (!allowedClasses.has(input)) {
        console.warn(`[SECURITY] Invalid class name: ${input}`);
        return 'default';
    }

    return input;
}

/**
 * Detect honeypot spam
 */
export function isHoneypotFilled(formData) {
    // Check for honeypot field (should be empty)
    return formData.get('website') || formData.get('hp') || formData.get('url');
}
