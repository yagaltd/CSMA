/**
 * CSMA Platform Service
 * Unified API for platform-specific features
 * Abstracts file system, camera, and notifications across web/mobile/desktop
 */

import { detectPlatform, PLATFORMS, platformCapabilities } from '../utils/platform.js';

export class PlatformService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.platform = detectPlatform();
        this.capabilities = platformCapabilities;
    }

    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }

    init() {
        // Platform-specific initialization
        this._initPlatformFeatures();
    }

    _initPlatformFeatures() {
        // Request notification permissions on supported platforms
        if (this.capabilities.notifications()) {
            this._requestNotificationPermission();
        }
    }

    // ========================================
    // FILE SYSTEM API
    // ========================================

    /**
     * Check if file system is available
     */
    hasFileSystem() {
        return this.capabilities.fileSystem();
    }

    /**
     * Read file from platform-specific location
     * @param {string} path - File path
     * @returns {Promise<string>} File content
     */
    async readFile(path) {
        if (!this.hasFileSystem()) {
            throw new Error('File system not available on this platform');
        }

        switch (this.platform) {
            case PLATFORMS.MOBILE:
                return this._readFileCapacitor(path);
            case PLATFORMS.DESKTOP:
                return this._readFileNeutralino(path);
            default:
                throw new Error('File system not supported on web platform');
        }
    }

    /**
     * Write file to platform-specific location
     * @param {string} path - File path
     * @param {string} content - File content
     */
    async writeFile(path, content) {
        if (!this.hasFileSystem()) {
            throw new Error('File system not available on this platform');
        }

        switch (this.platform) {
            case PLATFORMS.MOBILE:
                return this._writeFileCapacitor(path, content);
            case PLATFORMS.DESKTOP:
                return this._writeFileNeutralino(path, content);
            default:
                throw new Error('File system not supported on web platform');
        }
    }

    /**
     * List files in directory
     * @param {string} path - Directory path
     * @returns {Promise<string[]>} Array of file names
     */
    async listFiles(path) {
        if (!this.hasFileSystem()) {
            throw new Error('File system not available on this platform');
        }

        switch (this.platform) {
            case PLATFORMS.MOBILE:
                return this._listFilesCapacitor(path);
            case PLATFORMS.DESKTOP:
                return this._listFilesNeutralino(path);
            default:
                throw new Error('File system not supported on web platform');
        }
    }

    // Capacitor file system implementation
    async _readFileCapacitor(path) {
        try {
            const { Filesystem } = await import('@capacitor/filesystem');
            const result = await Filesystem.readFile({
                path: path,
                directory: 'DOCUMENTS'
            });
            return result.data;
        } catch (error) {
            throw new Error('Capacitor Filesystem not available');
        }
    }

    async _writeFileCapacitor(path, content) {
        try {
            const { Filesystem } = await import('@capacitor/filesystem');
            await Filesystem.writeFile({
                path: path,
                data: content,
                directory: 'DOCUMENTS'
            });
        } catch (error) {
            throw new Error('Capacitor Filesystem not available');
        }
    }

    async _listFilesCapacitor(path) {
        // Capacitor filesystem is limited, implement basic listing
        return [];
    }

    // Neutralino file system implementation
    async _readFileNeutralino(path) {
        const result = await window.Neutralino.filesystem.readFile(path);
        return result;
    }

    async _writeFileNeutralino(path, content) {
        await window.Neutralino.filesystem.writeFile(path, content);
    }

    async _listFilesNeutralino(path) {
        const entries = await window.Neutralino.filesystem.readDirectory(path);
        return entries.map(entry => entry.entry);
    }

    // ========================================
    // CAMERA API
    // ========================================

    /**
     * Check if camera is available
     */
    hasCamera() {
        return this.capabilities.camera();
    }

    /**
     * Capture photo from camera
     * @param {Object} options - Camera options
     * @returns {Promise<string>} Base64 image data
     */
    async capturePhoto(options = {}) {
        if (!this.hasCamera()) {
            throw new Error('Camera not available on this platform');
        }

        switch (this.platform) {
            case PLATFORMS.MOBILE:
                return this._capturePhotoCapacitor(options);
            case PLATFORMS.WEB:
                return this._capturePhotoWeb(options);
            default:
                throw new Error('Camera not supported on desktop platform');
        }
    }

    // Capacitor camera implementation
    async _capturePhotoCapacitor(options) {
        try {
            const { Camera } = await import('@capacitor/camera');
            const image = await Camera.getPhoto({
                quality: options.quality || 90,
                allowEditing: options.allowEditing || false,
                resultType: 'base64',
                source: 'CAMERA'
            });
            return image.base64String;
        } catch (error) {
            throw new Error('Capacitor Camera not available');
        }
    }

    // Web camera implementation
    async _capturePhotoWeb(options) {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment'; // Use back camera on mobile

            input.onchange = (event) => {
                const file = event.target.files[0];
                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1]; // Remove data:image/jpeg;base64,
                    resolve(base64);
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            };

            input.click();
        });
    }

    // ========================================
    // NOTIFICATIONS API
    // ========================================

    /**
     * Check if notifications are available
     */
    hasNotifications() {
        return this.capabilities.notifications();
    }

    /**
     * Request notification permission
     */
    async _requestNotificationPermission() {
        if (this.platform === PLATFORMS.WEB && 'Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return true; // Mobile/desktop platforms handle this differently
    }

    /**
     * Show notification
     * @param {string} title - Notification title
     * @param {Object} options - Notification options
     */
    async showNotification(title, options = {}) {
        if (!this.hasNotifications()) {
            console.warn('Notifications not available on this platform');
            return;
        }

        switch (this.platform) {
            case PLATFORMS.MOBILE:
                return this._showNotificationCapacitor(title, options);
            case PLATFORMS.DESKTOP:
                return this._showNotificationNeutralino(title, options);
            case PLATFORMS.WEB:
                return this._showNotificationWeb(title, options);
        }
    }

    // Capacitor notifications
    async _showNotificationCapacitor(title, options) {
        try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            await LocalNotifications.schedule({
                notifications: [{
                    title,
                    body: options.body || '',
                    id: Date.now(),
                    schedule: { at: new Date(Date.now() + 100) } // Show immediately
                }]
            });
        } catch (error) {
            throw new Error('Capacitor LocalNotifications not available');
        }
    }

    // Neutralino notifications
    async _showNotificationNeutralino(title, options) {
        await window.Neutralino.os.showNotification(title, options.body || '');
    }

    // Web notifications
    async _showNotificationWeb(title, options) {
        if (Notification.permission !== 'granted') {
            throw new Error('Notification permission not granted');
        }

        const notification = new Notification(title, {
            body: options.body,
            icon: options.icon,
            tag: options.tag
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        return notification;
    }

    // ========================================
    // PLATFORM INFO
    // ========================================

    /**
     * Get platform information
     */
    getPlatformInfo() {
        return {
            platform: this.platform,
            capabilities: {
                fileSystem: this.hasFileSystem(),
                camera: this.hasCamera(),
                notifications: this.hasNotifications()
            },
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        };
    }

    /**
     * Check if running in development mode
     */
    isDevelopment() {
        return import.meta.env.DEV;
    }

    /**
     * Get platform-specific storage path
     */
    getStoragePath(type = 'documents') {
        switch (this.platform) {
            case PLATFORMS.MOBILE:
                return `capacitor://${type}`;
            case PLATFORMS.DESKTOP:
                return `neutralino://${type}`;
            case PLATFORMS.WEB:
                return `localStorage://${type}`;
            default:
                return `unknown://${type}`;
        }
    }
}

export default PlatformService;