/**
 * CSMA module contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums, optional, array, any } from '../validation/index.js';

export const ModuleContracts = {
    MODULE_LOADED: {
        version: 1,
        type: 'event',
        owner: 'module-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Module loaded and registered its services/contributions',

        schema: object({
            version: number(),
            id: string(),
            manifest: object({
                id: string(),
                name: string(),
                version: string(),
                description: string(),
                dependencies: array(string()),
                services: array(string()),
                contracts: array(string()),
                contributes: optional(any()),
                aiUi: optional(any())
            }),
            serviceNames: array(string()),
            contributions: object({
                commands: number(),
                navigation: number(),
                panels: number(),
                adapters: number(),
                views: number()
            })
        })
    },

    MODULE_UNLOADED: {
        version: 1,
        type: 'event',
        owner: 'module-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Module unloaded and removed its services/contributions',

        schema: object({
            version: number(),
            id: string(),
            manifest: object({
                id: string(),
                name: string(),
                version: string(),
                description: string(),
                dependencies: array(string()),
                services: array(string()),
                contracts: array(string()),
                contributes: optional(any()),
                aiUi: optional(any())
            }),
            serviceNames: array(string()),
            contributions: object({
                commands: number(),
                navigation: number(),
                panels: number(),
                adapters: number(),
                views: number()
            })
        })
    },

    MODULE_CONTRIBUTION_REGISTERED: {
        version: 1,
        type: 'event',
        owner: 'module-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Module contribution registered into a runtime registry',

        schema: object({
            registry: enums(['commands', 'navigation', 'panels', 'adapters', 'views']),
            moduleId: string(),
            contributionId: string(),
            timestamp: number()
        })
    },

    MODULE_CONTRIBUTION_UNREGISTERED: {
        version: 1,
        type: 'event',
        owner: 'module-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Module contribution removed from a runtime registry',

        schema: object({
            registry: enums(['commands', 'navigation', 'panels', 'adapters', 'views']),
            moduleId: string(),
            contributionId: string(),
            timestamp: number()
        })
    },
};
