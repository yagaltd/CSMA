/**
 * I18n Module - Internationalization support
 * 
 * This module provides multi-language support for the application.
 * Enable via FEATURES.I18N in config.js
 */

import { I18n } from './services/I18n.js';

export const manifest = {
    name: 'Internationalization',
    version: '1.0.0',
    description: 'Multi-language support with translation management',
    dependencies: [],
    bundleSize: '4KB',
    contracts: []  // I18n doesn't publish events
};

export const services = {
    I18n
};
