/**
 * CSMA Platform Detection Utility
 * Runtime detection of execution environment
 */

/**
 * Platform types
 */
export const PLATFORMS = {
    WEB: 'web',
    MOBILE: 'mobile', // Capacitor
    DESKTOP: 'desktop' // Neutralino
};

/**
 * Detect current platform at runtime
 * @returns {string} Platform identifier
 */
export function detectPlatform() {
    // Check for Capacitor (mobile apps)
    if (typeof window !== 'undefined' && window.Capacitor) {
        return PLATFORMS.MOBILE;
    }

    // Check for Neutralino (desktop apps)
    if (typeof window !== 'undefined' && window.Neutralino) {
        return PLATFORMS.DESKTOP;
    }

    // Default to web
    return PLATFORMS.WEB;
}

/**
 * Platform capability checks
 */
export const platformCapabilities = {
    // File system access
    fileSystem: () => {
        if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function') {
            return true;
        }

        const platform = detectPlatform();
        return platform === PLATFORMS.DESKTOP || platform === PLATFORMS.MOBILE;
    },

    // Camera access
    camera: () => {
        const platform = detectPlatform();
        return platform === PLATFORMS.MOBILE || (platform === PLATFORMS.WEB && navigator.mediaDevices);
    },

    // Notifications
    notifications: () => {
        const platform = detectPlatform();
        return platform === PLATFORMS.MOBILE || platform === PLATFORMS.DESKTOP ||
            (platform === PLATFORMS.WEB && 'Notification' in window);
    },

    // Service Worker (PWA)
    serviceWorker: () => {
        const platform = detectPlatform();
        return platform === PLATFORMS.WEB && 'serviceWorker' in navigator;
    },

    // Geolocation
    geolocation: () => {
        return 'geolocation' in navigator;
    },

    // Vibration (mobile haptic feedback)
    vibration: () => {
        const platform = detectPlatform();
        return platform === PLATFORMS.MOBILE || (platform === PLATFORMS.WEB && 'vibrate' in navigator);
    }
};

/**
 * Get platform-specific configuration
 * @returns {Object} Platform config object
 */
export function getPlatformConfig() {
    const platform = detectPlatform();

    return {
        platform,
        isWeb: platform === PLATFORMS.WEB,
        isMobile: platform === PLATFORMS.MOBILE,
        isDesktop: platform === PLATFORMS.DESKTOP,
        capabilities: {
            fileSystem: platformCapabilities.fileSystem(),
            camera: platformCapabilities.camera(),
            notifications: platformCapabilities.notifications(),
            serviceWorker: platformCapabilities.serviceWorker(),
            geolocation: platformCapabilities.geolocation(),
            vibration: platformCapabilities.vibration()
        }
    };
}

/**
 * Platform-specific user agent detection (fallback)
 * @returns {string} Detected platform
 */
export function detectPlatformFromUserAgent() {
    if (typeof navigator === 'undefined') {
        return PLATFORMS.WEB;
    }

    const ua = navigator.userAgent.toLowerCase();

    // Capacitor apps have specific user agent patterns
    if (ua.includes('capacitor')) {
        return PLATFORMS.MOBILE;
    }

    // Neutralino apps
    if (ua.includes('neutralino')) {
        return PLATFORMS.DESKTOP;
    }

    // Mobile browsers
    if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
        return PLATFORMS.MOBILE;
    }

    return PLATFORMS.WEB;
}

// Export current platform for convenience
export const currentPlatform = detectPlatform();
export const platformConfig = getPlatformConfig();