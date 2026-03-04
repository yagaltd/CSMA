/**
 * CSMA Validation - Security Validators
 * Validators for security-critical inputs
 */

import { refine, size } from '../types/refinements.js';
import { string } from '../types/primitives.js';

/**
 * Validate LLM input with prompt injection detection
 * 
 * @param {number} maxTokens - Maximum tokens (default: 4000, ~16000 chars)
 * @returns {Struct} LLM input validator
 */
export function llmInput(maxTokens = 4000) {
    const maxChars = maxTokens * 4; // ~4 chars per token estimate

    const sizedString = size(string(), 1, maxChars);

    return refine(sizedString, 'llm-input', (value) => {
        // Prompt injection patterns to detect
        const injectionPatterns = [
            /ignore\s+(previous|above|all)\s+instructions/i,
            /disregard\s+(previous|above|all)\s+(instructions|prompts)/i,
            /system:\s*you\s+are/i,
            /new\s+instructions?:/i,
            /override\s+previous/i,
            /\[SYSTEM\]/i,
            /\[ADMIN\]/i,
            /<\|im_start\|>/i,  // ChatGPT delimiter
            /<\|im_end\|>/i,    // ChatGPT delimiter

            // ✅ ADDED: Modern prompt injection patterns
            /role:\s*(system|assistant|developer)/i,
            /\[INST\]/i,  // Llama format
            /\[\/INST\]/i,
            /<s>/i,  // Special tokens
            /<\/s>/i,
            /{{.*}}/i,  // Template injection
            /""".*"""/s,  // Multi-line injection
            /translate\s+to\s+python/i,
            /execute\s+this/i,
            /forget\s+(all|everything|previous)/i,
            /pretend\s+(you\s+are|to\s+be)/i,
            /import\s+os/i,  // Code execution attempts
            /subprocess\.run/i,
            /eval\s*\(/i,
            /exec\s*\(/i
        ];

        for (const pattern of injectionPatterns) {
            if (pattern.test(value)) {
                return 'Input contains potential prompt injection pattern';
            }
        }

        // Check for excessive repetition (another injection technique)
        const words = value.split(/\s+/);
        const uniqueWords = new Set(words);
        if (words.length > 50 && uniqueWords.size / words.length < 0.3) {
            return 'Input contains excessive repetition';
        }

        return true;
    });
}

/**
 * Validate that HTML content is safe (no dangerous tags/attributes)
 */
export function sanitizedHTML() {
    return refine(string(), 'sanitized-html', (value) => {
        // Dangerous patterns
        const dangerousPatterns = [
            /<script[\s>]/i,
            /<iframe[\s>]/i,
            /on\w+\s*=/i,  // Event handlers like onclick=
            /javascript:/i,
            /<object[\s>]/i,
            /<embed[\s>]/i,
            /<link[\s>]/i
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(value)) {
                return 'HTML contains potentially dangerous content';
            }
        }

        return true;
    });
}

/**
 * Validate that URL is safe (no javascript:, data:, etc.)
 */
export function sanitizedURL() {
    return refine(string(), 'sanitized-url', (value) => {
        // Dangerous URL schemes
        const dangerousSchemes = [
            /^javascript:/i,
            /^data:/i,
            /^vbscript:/i,
            /^file:/i
        ];

        for (const scheme of dangerousSchemes) {
            if (scheme.test(value.trim())) {
                return 'URL scheme is not allowed';
            }
        }

        // Should be http(s) or relative
        if (value.includes(':')) {
            if (!value.match(/^https?:\/\//i)) {
                return 'Only HTTP(S) URLs are allowed';
            }
        }

        return true;
    });
}

/**
 * Validate SQL-safe string (no SQL injection patterns)
 */
export function sqlSafe() {
    return refine(string(), 'sql-safe', (value) => {
        // Common SQL injection patterns
        const sqlPatterns = [
            /('\s*OR\s*'?\d)/i,
            /(--)/,
            /(;.*(DROP|DELETE|UPDATE|INSERT))/i,
            /(UNION\s+SELECT)/i,
            /(EXEC\s*\()/i
        ];

        for (const pattern of sqlPatterns) {
            if (pattern.test(value)) {
                return 'Input contains potential SQL injection pattern';
            }
        }

        return true;
    });
}

/**
 * Validate password strength
 */
export function strongPassword(minLength = 12) {
    return refine(size(string(), minLength, 128), 'strong-password', (value) => {
        const hasUpper = /[A-Z]/.test(value);
        const hasLower = /[a-z]/.test(value);
        const hasDigit = /\d/.test(value);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);

        const strength = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

        if (strength < 3) {
            return 'Password must contain at least 3 of: uppercase, lowercase, digits, special characters';
        }

        return true;
    });
}
