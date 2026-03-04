/**
 * Example Module - Demonstrates CSMA Module Pattern
 * 
 * Modules are self-contained feature bundles that:
 * - Register their own services with the shared ServiceManager
 * - Define their own contracts
 * - Use the shared EventBus for communication
 * - Can be enabled/disabled via FEATURES config
 */

import { ExampleModuleService } from './services/ExampleModuleService.js';

/**
 * Module Manifest
 * Metadata about this module for discovery and documentation
 */
export const manifest = {
    name: 'Example Module',
    version: '1.0.0',
    description: 'Demonstrates the module pattern for organizing optional features',
    dependencies: [],  // Other modules this depends on
    bundleSize: '5KB',
    contracts: ['EXAMPLE_MODULE_EVENT']  // Events this module publishes
};

/**
 * Services exported by this module
 * ModuleManager will register these with ServiceManager
 */
export const services = {
    ExampleModuleService
};

/**
 * Module-specific contracts (optional)
 * These can be imported into the main Contracts.js
 */
export const contracts = {
    // Example: EXAMPLE_MODULE_EVENT: { ... }
};
