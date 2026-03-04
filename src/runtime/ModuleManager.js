/**
 * ModuleManager - Loads feature modules dynamically
 * 
 * Modules are organizational units for services. They don't have separate
 * runtimes - all services use the SHARED EventBus and ServiceManager.
 * 
 * Adapted for CSMA starter-template architecture.
 */
export class ModuleManager {
    constructor(eventBus, serviceManager) {
        this.eventBus = eventBus;
        this.serviceManager = serviceManager;
        this.modules = new Map(); // id -> { manifest, status }
    }

    /**
     * Load a feature module
     * @param {string} moduleId - Module identifier (e.g., 'basic-classification')
     */
    async loadModule(moduleId) {
        if (this.modules.has(moduleId)) {
            console.warn(`[ModuleManager] Module ${moduleId} already loaded`);
            return;
        }

        try {
            // Dynamic import
            const module = await import(`../modules/${moduleId}/index.js`);

            console.log(`[ModuleManager] Loading: ${module.manifest.name}`);

            // Register services with the SHARED ServiceManager
            for (const [serviceName, ServiceClass] of Object.entries(module.services)) {
                const service = new ServiceClass(this.eventBus);

                this.serviceManager.register(serviceName, service, {
                    version: module.manifest.version,
                    description: module.manifest.description,
                    dependencies: module.manifest.dependencies || [],
                    moduleId: moduleId
                });
            }

            // Track loaded module
            this.modules.set(moduleId, {
                manifest: module.manifest,
                status: 'loaded'
            });

            // Publish event
            this.eventBus.publish('MODULE_LOADED', {
                version: 1,
                id: moduleId,
                manifest: module.manifest
            });

            console.log(`[ModuleManager] ✓ ${module.manifest.name} loaded`);
        } catch (error) {
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
}
