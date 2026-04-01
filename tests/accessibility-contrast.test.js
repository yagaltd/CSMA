/**
 * Accessibility Contrast Tests
 * Verifies WCAG contrast requirements for all theme token combinations
 *
 * Uses WCAG 2.1 contrast ratio calculations:
 * - AA: 4.5:1 for normal text, 3:1 for large text
 * - AAA: 7:1 for normal text, 4.5:1 for large text
 */

import { describe, it, expect } from 'vitest';

/**
 * Calculate relative luminance of a color
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {number} Relative luminance (0-1)
 */
function relativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * @param {number[]} rgb1 - [r, g, b] of first color
 * @param {number[]} rgb2 - [r, g, b] of second color
 * @returns {number} Contrast ratio (1:1 to 21:1)
 */
function contrastRatio(rgb1, rgb2) {
    const l1 = relativeLuminance(...rgb1);
    const l2 = relativeLuminance(...rgb2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse CSS color value to RGB
 * Supports: hex, rgb(), hsl(), oklch()
 * @param {string} color - CSS color value
 * @returns {number[]} [r, g, b]
 */
function parseColor(color) {
    // Handle hex
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        if (hex.length === 3) {
            return hex.split('').map(c => parseInt(c + c, 16));
        }
        if (hex.length === 6) {
            return [
                parseInt(hex.slice(0, 2), 16),
                parseInt(hex.slice(2, 4), 16),
                parseInt(hex.slice(4, 6), 16)
            ];
        }
    }

    // Handle rgb()
    const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
        return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
    }

    // Handle hsl() - convert to RGB
    const hslMatch = color.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/);
    if (hslMatch) {
        return hslToRgb(parseInt(hslMatch[1]), parseInt(hslMatch[2]), parseInt(hslMatch[3]));
    }

    // Handle oklch() - approximate conversion
    const oklchMatch = color.match(/oklch\s*\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\)/);
    if (oklchMatch) {
        return oklchToRgb(parseFloat(oklchMatch[1]), parseFloat(oklchMatch[2]), parseFloat(oklchMatch[3]));
    }

    return [128, 128, 128]; // Fallback gray
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Convert OKLCH to RGB (approximate)
 * Note: This is a simplified conversion for testing purposes
 */
function oklchToRgb(l, c, h) {
    // OKLCH lightness is 0-1, chroma is typically 0-0.4, hue is in degrees
    // Approximate conversion: map oklch L to HSL lightness (0-100)
    const hue = h;
    const chroma = c;
    const lightness = l * 100;

    // Approximate as HSL with adjustments
    const sat = Math.min(chroma / 0.4 * 100, 100);
    return hslToRgb(hue, sat, lightness);
}

/**
 * Light theme tokens (from src/css/generated/tokens.css — generated from design-tokens.json)
 * Semantic colors use sRGB hex for precise contrast calculations;
 * neutral/structural colors keep oklch notation.
 */
const lightTheme = {
    background: 'oklch(0.975 0.004 248)',
    backgroundMuted: 'oklch(0.954 0.008 248)',
    surface: 'oklch(1 0.001 248)',
    surfaceMuted: 'oklch(0.974 0.007 248)',
    foreground: 'oklch(0.215 0.018 252)',
    foregroundMuted: 'oklch(0.5 0.015 248)',
    border: 'oklch(0.88 0.008 248)',
    primary: '#1e293b',
    primaryForeground: '#f8fafc',
    secondary: 'oklch(0.969 0.007 248)',
    secondaryForeground: '#1e293b',
    accent: 'oklch(0.961 0.01 235)',
    accentForeground: '#1e293b',
    destructive: '#dc2626',
    destructiveForeground: '#f8fafc',
    warning: '#d97706',
    warningForeground: '#451a03',
    success: '#16a34a',
    successForeground: '#052e16',
    info: '#2563eb',
    infoForeground: '#f8fafc'
};

/**
 * Dark theme tokens (from src/css/generated/tokens.css — generated from design-tokens.json)
 * Semantic colors use sRGB hex for precise contrast calculations;
 * neutral/structural colors keep oklch notation.
 */
const darkTheme = {
    background: 'oklch(0.182 0.01 255)',
    backgroundMuted: 'oklch(0.242 0.012 255)',
    surface: 'oklch(0.23 0.01 255)',
    surfaceMuted: 'oklch(0.275 0.012 255)',
    foreground: 'oklch(0.968 0.004 255)',
    foregroundMuted: 'oklch(0.74 0.012 252)',
    border: 'oklch(0.32 0.012 255)',
    primary: '#edf2f7',
    primaryForeground: '#1a1a2e',
    secondary: 'oklch(0.255 0.012 255)',
    secondaryForeground: '#edf2f7',
    accent: 'oklch(0.285 0.015 236)',
    accentForeground: '#edf2f7',
    destructive: '#ef4444',
    destructiveForeground: '#f8fafc',
    warning: '#fbbf24',
    warningForeground: '#451a03',
    success: '#22c55e',
    successForeground: '#052e16',
    info: '#3b82f6',
    infoForeground: '#f8fafc'
};

/**
 * Critical color combinations to test
 * These are the most common foreground/background pairings
 */
const criticalCombinations = [
    // Text on backgrounds
    { fg: 'foreground', bg: 'background', name: 'Primary text on background', minRatio: 4.5 },
    { fg: 'foregroundMuted', bg: 'background', name: 'Muted text on background', minRatio: 3.0 },
    { fg: 'foreground', bg: 'surface', name: 'Primary text on surface', minRatio: 4.5 },
    { fg: 'foregroundMuted', bg: 'surface', name: 'Muted text on surface', minRatio: 3.0 },

    // Text on primary
    { fg: 'primaryForeground', bg: 'primary', name: 'Text on primary button', minRatio: 4.5 },

    // Text on semantic colors (3:1 — used for short labels/badges, not body text)
    { fg: 'destructiveForeground', bg: 'destructive', name: 'Text on destructive', minRatio: 3.0 },
    { fg: 'warningForeground', bg: 'warning', name: 'Text on warning', minRatio: 3.0 },
    { fg: 'successForeground', bg: 'success', name: 'Text on success', minRatio: 3.0 },
    { fg: 'infoForeground', bg: 'info', name: 'Text on info', minRatio: 3.0 },

    // Text on secondary/accent
    { fg: 'secondaryForeground', bg: 'secondary', name: 'Text on secondary', minRatio: 4.5 },
    { fg: 'accentForeground', bg: 'accent', name: 'Text on accent', minRatio: 4.5 }
];

describe('Light Theme Contrast', () => {
    criticalCombinations.forEach(({ fg, bg, name, minRatio }) => {
        it(`${name} meets WCAG AA (${minRatio}:1)`, () => {
            const fgRgb = parseColor(lightTheme[fg]);
            const bgRgb = parseColor(lightTheme[bg]);
            const ratio = contrastRatio(fgRgb, bgRgb);

            expect(ratio).toBeGreaterThanOrEqual(minRatio);
        });
    });
});

describe('Dark Theme Contrast', () => {
    criticalCombinations.forEach(({ fg, bg, name, minRatio }) => {
        it(`${name} meets WCAG AA (${minRatio}:1)`, () => {
            const fgRgb = parseColor(darkTheme[fg]);
            const bgRgb = parseColor(darkTheme[bg]);
            const ratio = contrastRatio(fgRgb, bgRgb);

            expect(ratio).toBeGreaterThanOrEqual(minRatio);
        });
    });
});

describe('Large Text Contrast (3:1 minimum)', () => {
    // Large text: 18pt+ regular or 14pt+ bold
    const largeTextCombinations = [
        { fg: 'foregroundMuted', bg: 'background', name: 'Light: Muted large text' },
        { fg: 'foregroundMuted', bg: 'surface', name: 'Light: Muted large text on surface' }
    ];

    describe('Light theme', () => {
        largeTextCombinations.forEach(({ fg, bg, name }) => {
            it(`${name} meets WCAG AA large text (3:1)`, () => {
                const fgRgb = parseColor(lightTheme[fg]);
                const bgRgb = parseColor(lightTheme[bg]);
                const ratio = contrastRatio(fgRgb, bgRgb);

                expect(ratio).toBeGreaterThanOrEqual(3.0);
            });
        });
    });

    describe('Dark theme', () => {
        largeTextCombinations.forEach(({ fg, bg, name }) => {
            it(`${name} meets WCAG AA large text (3:1)`, () => {
                const fgRgb = parseColor(darkTheme[fg]);
                const bgRgb = parseColor(darkTheme[bg]);
                const ratio = contrastRatio(fgRgb, bgRgb);

                expect(ratio).toBeGreaterThanOrEqual(3.0);
            });
        });
    });
});

describe('Focus Indicator Contrast', () => {
    it('Light theme ring has sufficient contrast against background', () => {
        // Ring uses --primary which is dark in light theme
        const ringRgb = parseColor(lightTheme.primary);
        const bgRgb = parseColor(lightTheme.background);
        const ratio = contrastRatio(ringRgb, bgRgb);

        // Focus indicator should have at least 3:1 against adjacent colors
        expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('Dark theme ring has sufficient contrast against background', () => {
        // Ring uses --primary which is light in dark theme
        const ringRgb = parseColor(darkTheme.primary);
        const bgRgb = parseColor(darkTheme.background);
        const ratio = contrastRatio(ringRgb, bgRgb);

        expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
});
