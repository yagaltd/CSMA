/**
 * Router Module - Client-side routing with History API
 * 
 * This module provides SPA routing capabilities.
 * Enable via FEATURES.ROUTER in config.js
 */

import { Router } from './services/Router.js';

export const manifest = {
    name: 'Client-Side Router',
    version: '1.0.0',
    description: 'SPA routing with History API',
    dependencies: [],
    bundleSize: '5KB',
    contracts: []  // Router handles navigation internally
};

export const services = {
    Router
};
