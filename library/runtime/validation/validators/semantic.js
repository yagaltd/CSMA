/**
 * CSMA Validation - Semantic Validators
 * Domain-specific validation functions
 */

import { refine } from '../types/refinements.js';
import { string } from '../types/primitives.js';

/**
 * Validate email addresses
 */
export function email(message) {
    return refine(string(), 'email', (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return message || `Expected a valid email address, but received: ${value}`;
        }
        return true;
    });
}

/**
 * Validate URLs
 */
export function url(message) {
    return refine(string(), 'url', (value) => {
        try {
            new URL(value);
            return true;
        } catch {
            return message || `Expected a valid URL, but received: ${value}`;
        }
    });
}

/**
 * Validate UUIDs (v4 by default)
 */
export function uuid(version = 4, message) {
    const regex = version === 4
        ? /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    return refine(string(), 'uuid', (value) => {
        if (!regex.test(value)) {
            return message || `Expected a valid UUID v${version}, but received: ${value}`;
        }
        return true;
    });
}

/**
 * Validate phone numbers (basic international format)
 */
export function phone(message) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format

    return refine(string(), 'phone', (value) => {
        const cleaned = value.replace(/[\s()-]/g, ''); // Remove common formatting
        if (!phoneRegex.test(cleaned)) {
            return message || `Expected a valid phone number, but received: ${value}`;
        }
        return true;
    });
}

/**
 * Validate hexadecimal color codes
 */
export function hexColor(message) {
    const hexRegex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

    return refine(string(), 'hexColor', (value) => {
        if (!hexRegex.test(value)) {
            return message || `Expected a valid hex color (e.g., #fff or #ffffff), but received: ${value}`;
        }
        return true;
    });
}

/**
 * Validate ISO 8601 date strings
 */
export function isoDate(message) {
    const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

    return refine(string(), 'isoDate', (value) => {
        if (!isoRegex.test(value)) {
            return message || `Expected an ISO 8601 date string, but received: ${value}`;
        }

        // Also verify it's a valid date
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return message || `Expected a valid date, but received: ${value}`;
        }

        return true;
    });
}
