import { validateModuleDefinition, MODULE_CONTRIBUTION_TYPES } from './ModuleManifest.js';

const REGISTRY_KEY_BY_CONTRIBUTION = {
    commands: 'commands',
    routes: 'routes',
    navigation: 'navigation',
    panels: 'panels',
    adapters: 'adapters'
};

/**
 * ModuleManager - Loads feature modules dynamically
 *
 * Modules are organizational units for services. They don't have separate
 * runtimes - all services use the SHARED EventBus and ServiceManager.
 *
 * Adapted for CSMA starter-template architecture.
 */
export class ModuleManager {
    constructor(eventBus, serviceManager, registries = {}) {
        this.eventBus = eventBus;
        this.serviceManager = serviceManager;
        this.registries = registries;
        this.modules = new Map(); // id -> { manifest, status }
    }

    /**
     * Load a feature module
     * @param {string} moduleId - Module identifier (e.g., 'basic-classification')
     */
    async loadModule(moduleId) {
        if (this.modules.has(moduleId)) {
            console.warn(`[ModuleManager] Module ${moduleId} already loaded`);
            return this.modules.get(moduleId);
        }

        const serviceNames = [];
        let manifest = null;

        try {
            // Dynamic import
            const moduleDefinition = await import(`../modules/${moduleId}/index.js`);
            const normalized = validateModuleDefinition(moduleId, moduleDefinition);
            manifest = normalized.manifest;

            console.log(`[ModuleManager] Loading: ${manifest.name}`);

            // Register services with the SHARED ServiceManager
            for (const [serviceName, ServiceClass] of Object.entries(normalized.services)) {
                const service = new ServiceClass(this.eventBus);

                this.serviceManager.register(serviceName, service, {
                    version: manifest.version,
                    description: manifest.description,
                    dependencies: manifest.dependencies || [],
                    moduleId: moduleId
                });
                serviceNames.push(serviceName);
            }

            this.registerContributions(manifest);

            // Track loaded module
            this.modules.set(moduleId, {
                manifest,
                status: 'loaded',
                serviceNames
            });

            // Publish event
            this.eventBus.publishSync?.('MODULE_LOADED', {
                version: 1,
                id: moduleId,
                manifest,
                serviceNames,
                contributions: this.summarizeContributions(manifest)
            });

            console.log(`[ModuleManager] ✓ ${manifest.name} loaded`);
            return this.modules.get(moduleId);
        } catch (error) {
            await this.rollbackLoad(moduleId, manifest, serviceNames);
            console.error(`[ModuleManager] Failed to load ${moduleId}:`, error);
            throw error;
        }
    }

    /**
     * Check if a module is loaded
     */
    isModuleLoaded(moduleId) {
        return this.modules.has(moduleId);
    }

    /**
     * Get list of loaded module IDs
     */
    getLoadedModules() {
        return Array.from(this.modules.keys());
    }

    /**
     * Get module manifest
     */
    getModuleManifest(moduleId) {
        const module = this.modules.get(moduleId);
        return module ? module.manifest : null;
    }

    async unloadModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) {
            return false;
        }

        this.unregisterContributions(module.manifest);

        const serviceNames = (module.serviceNames || []).slice().reverse();
        for (const serviceName of serviceNames) {
            await this.serviceManager.unregister(serviceName);
        }

        this.modules.delete(moduleId);
        this.eventBus?.publishSync?.('MODULE_UNLOADED', {
            version: 1,
            id: moduleId,
            manifest: module.manifest,
            serviceNames,
            contributions: this.summarizeContributions(module.manifest)
        });
        return true;
    }

    async destroy() {
        for (const moduleId of Array.from(this.modules.keys()).reverse()) {
            await this.unloadModule(moduleId);
        }
    }

    registerContributions(manifest) {
        const contributes = manifest?.contributes || {};

        MODULE_CONTRIBUTION_TYPES.forEach((contributionType) => {
            const registry = this.registries[REGISTRY_KEY_BY_CONTRIBUTION[contributionType]];
            const entries = contributes[contributionType] || [];

            if (!registry || entries.length === 0) {
                return;
            }

            entries.forEach((entry) => registry.register(manifest.id, entry));
        });
    }

    unregisterContributions(manifest) {
        if (!manifest?.id) {
            return;
        }

        MODULE_CONTRIBUTION_TYPES.forEach((contributionType) => {
            const registry = this.registries[REGISTRY_KEY_BY_CONTRIBUTION[contributionType]];
            registry?.unregisterAll?.(manifest.id);
        });
    }

    summarizeContributions(manifest) {
        const contributes = manifest?.contributes || {};
        return MODULE_CONTRIBUTION_TYPES.reduce((summary, type) => {
            summary[type] = contributes[type]?.length || 0;
            return summary;
        }, {});
    }

    async rollbackLoad(moduleId, manifest, serviceNames) {
        if (manifest) {
            this.unregisterContributions(manifest);
        }

        for (const serviceName of [...serviceNames].reverse()) {
            try {
                await this.serviceManager.unregister(serviceName);
            } catch (error) {
                console.warn(`[ModuleManager] Failed to roll back service ${serviceName} for module ${moduleId}:`, error);
            }
        }
    }
}
