/**
 * Storage Module - IndexedDB wrapper for offline-first apps
 * 
 * This module provides a simple interface to IndexedDB for local storage.
 * Enable via FEATURES.INDEXEDDB in config.js
 */

import { Storage } from './services/Storage.js';

export const manifest = {
    name: 'IndexedDB Storage',
    version: '1.0.0',
    description: 'IndexedDB wrapper for offline-first applications',
    dependencies: [],
    bundleSize: '6KB',
    contracts: []  // Storage doesn't publish events directly
};

export const services = {
    Storage
};
