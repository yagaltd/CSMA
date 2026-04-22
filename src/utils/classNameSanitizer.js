/**
 * sanitizeClassName - Validate CSS class names against a whitelist
 * 
 * Use this when className comes from user input or external data to prevent
 * CSS injection attacks when using CSS-class reactivity pattern.
 * 
 * @param {string} className - Class name(s) to sanitize
 * @param {Set<string>} allowedClasses - Whitelist of allowed class names
 * @returns {string} Sanitized class names (space-separated)
 * 
 * @example
 * const ALLOWED_STATUS = new Set(['pending', 'completed', 'failed']);
 * element.className = sanitizeClassName(userInput, ALLOWED_STATUS);
 */
export function sanitizeClassName(className, allowedClasses) {
    if (!className || typeof className !== 'string') {
        return '';
    }

    const classes = className.split(' ').filter(cls => {
        // Only allow alphanumeric, dashes, underscores
        const isValidFormat = /^[a-zA-Z0-9_-]+$/.test(cls);

        // Check against whitelist if provided
        const isAllowed = allowedClasses ? allowedClasses.has(cls) : true;

        return isValidFormat && isAllowed;
    });

    return classes.join(' ');
}
