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
import { contract, object, string, number } from '../../../src/runtime/validation/index.js';


/**
 * Module Manifest
 * Metadata about this module for discovery and documentation
 */
export const manifest = {
    id: 'example-module',
    name: 'Example Module',
    version: '1.0.0',
    description: 'Demonstrates the module pattern for organizing optional features',
    dependencies: [],  // Other modules this depends on
    services: ['ExampleModuleService'],
    bundleSize: '5KB',
    contracts: ['EXAMPLE_MODULE_EVENT'],  // Events this module publishes
    contributes: {
        commands: [
            {
                id: 'example-module.say-hello',
                title: 'Example: Say Hello',
                handlerService: 'ExampleModuleService',
                handlerMethod: 'runHelloCommand',
                group: 'examples',
                payloadSchema: {
                    message: 'string'
                },
                order: 10
            }
        ],
        navigation: [
            {
                id: 'example-module.nav',
                label: 'Example Module',
                href: '/example-module',
                group: 'examples',
                order: 10
            }
        ],
        panels: [
            {
                id: 'example-module.panel',
                title: 'Example Diagnostics',
                mount: '#example-module-panel',
                placement: 'right',
                order: 10
            }
        ],
        adapters: [
            {
                id: 'example-module.adapter',
                type: 'demo',
                serviceName: 'ExampleModuleService',
                capabilities: ['hello']
            }
        ],
        views: [
            {
                id: 'example-module.status-card',
                title: 'Example Status Card',
                target: '#example-module-panel',
                renderService: 'ExampleModuleService',
                renderMethod: 'renderStatusCard',
                mode: 'replace',
                allowedTargets: ['#example-module-panel', '#example-output'],
                propsSchema: {
                    title: 'string',
                    message: 'string'
                },
                requiredProps: ['title', 'message'],
                stateSchema: {
                    tone: 'string'
                }
            }
        ]
    }
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
    EXAMPLE_MODULE_EVENT: contract({
        version: 1,
        type: 'event',
        owner: 'example-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Example module command result event',
        schema: object({
            id: string(),
            message: string(),
            timestamp: number()
        })
    }),
    EXAMPLE_MODULE_VIEW_RENDERED: contract({
        version: 1,
        type: 'event',
        owner: 'example-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Example module contributed view render event',
        schema: object({
            id: string(),
            viewId: string(),
            target: string(),
            title: string(),
            message: string(),
            tone: string(),
            timestamp: number()
        })
    })
};
