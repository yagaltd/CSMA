/**
 * Storage Module - IndexedDB wrapper for offline-first apps
 * 
 * This module provides a simple interface to IndexedDB for local storage.
 * Enable via FEATURES.INDEXEDDB in config.js
 */

import { Storage } from './services/Storage.js';
import { StorageContracts } from './contracts/storage-contracts.js';

export const manifest = {
    id: 'storage',
    name: 'IndexedDB Storage',
    version: '1.0.0',
    description: 'IndexedDB wrapper for offline-first applications',
    dependencies: [],
    services: ['Storage'],
    bundleSize: '6KB',
    contracts: [
        'STORAGE_READY',
        'STORAGE_ADDED',
        'STORAGE_UPDATED',
        'STORAGE_DELETED',
        'STORAGE_CLEARED'
    ]
};

export const services = {
    Storage
};

export const contracts = StorageContracts;
