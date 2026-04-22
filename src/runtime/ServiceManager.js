/**
 * ServiceManager - Enhanced with Metadata Tracking
 * 
 * CSMA Enhancement: Track service metadata including version, dependencies,
 * health status, and initialization metrics for better observability.
 */

class ServiceManager {
    constructor(eventBus) {
        this.services = new Map(); // Map<name, ServiceContext>
        this.eventBus = eventBus;
        this.registrationOrder = [];
    }

    /**
     * Register a service with metadata
     * @param {string} name - Service name
     * @param {Object} service - Service instance
     * @param {Object} metadata - Optional metadata
     * @param {string} metadata.version - Service version
     * @param {Array<string>} metadata.dependencies - Service dependencies
     * @param {string} metadata.description - Service description
     */
    register(name, service, metadata = {}) {
        if (this.services.has(name)) {
            console.warn(`Service ${name} is already registered.`);
            return this.get(name);
        }

        if (service && typeof service.setEventBus === 'function') {
            service.setEventBus(this.eventBus);
        }

        const context = {
            service,
            metadata: {
                version: metadata.version || '1.0.0',
                dependencies: metadata.dependencies || [],
                description: metadata.description || '',
                registeredAt: Date.now(),
                ...metadata
            },
            health: {
                status: 'registered', // registered, initializing, running, failed
                lastCheck: Date.now(),
                initTime: null,
                errorCount: 0,
                lastError: null
            }
        };

        this.services.set(name, context);
        this.registrationOrder.push(name);
        console.log(`ServiceManager: Registered service ${name} (v${context.metadata.version})`);
        return service;
    }

    async unregister(name, { destroy = true } = {}) {
        const context = this.services.get(name);
        if (!context) {
            return false;
        }

        this.services.delete(name);
        this.registrationOrder = this.registrationOrder.filter((entry) => entry !== name);

        if (destroy) {
            const teardown = context.service?.destroy || context.service?.cleanup;
            if (typeof teardown === 'function') {
                try {
                    await teardown.call(context.service);
                } catch (error) {
                    context.health.status = 'failed';
                    context.health.errorCount++;
                    context.health.lastError = error?.message || String(error);
                    console.error(`Failed to destroy service ${name}:`, error);
                }
            }
        }

        return true;
    }

    async destroyAll() {
        const orderedNames = this.registrationOrder.length
            ? [...this.registrationOrder].reverse()
            : Array.from(this.services.keys()).reverse();

        for (const name of orderedNames) {
            await this.unregister(name);
        }
    }

    /**
     * Start all services with dependency resolution
     */
    async startAll() {
        console.log('Starting all services...');

        // Sort services by dependency order
        const sorted = this._topologicalSort();

        for (const name of sorted) {
            const context = this.services.get(name);
            if (!context) continue;

            if (typeof context.service.init === 'function') {
                context.health.status = 'initializing';
                const startTime = Date.now();

                try {
                    await context.service.init();
                    context.health.initTime = Date.now() - startTime;
                    context.health.status = 'running';
                    context.health.lastCheck = Date.now();

                    console.log(`Service ${name} initialized in ${context.health.initTime}ms.`);
                } catch (e) {
                    context.health.status = 'failed';
                    context.health.errorCount++;
                    context.health.lastError = e.message;
                    console.error(`Failed to initialize service ${name}:`, e);
                }
            } else {
                // No init method, mark as running
                context.health.status = 'running';
            }
        }

        console.log('All services started.');
        this._printHealthReport();
    }

    /**
     * Get service by name
     * @param {string} name - Service name
     * @returns {Object|null} Service instance
     */
    get(name) {
        const context = this.services.get(name);
        return context ? context.service : null;
    }

    /**
     * Get service metadata
     * @param {string} name - Service name
     * @returns {Object|null} Service metadata
     */
    getMetadata(name) {
        const context = this.services.get(name);
        return context ? { ...context.metadata } : null;
    }

    /**
     * Get service health status
     * @param {string} name - Service name
     * @returns {Object|null} Health status
     */
    getHealth(name) {
        const context = this.services.get(name);
        return context ? { ...context.health } : null;
    }

    /**
     * Get all services status
     * @returns {Array} Array of service statuses
     */
    getAllStatus() {
        const statuses = [];
        for (const [name, context] of this.services) {
            statuses.push({
                name,
                version: context.metadata.version,
                status: context.health.status,
                initTime: context.health.initTime,
                errorCount: context.health.errorCount,
                dependencies: context.metadata.dependencies
            });
        }
        return statuses;
    }

    /**
     * Check if all dependencies are satisfied
     * @param {string} name - Service name
     * @returns {boolean} True if all dependencies are registered
     */
    checkDependencies(name) {
        const context = this.services.get(name);
        if (!context) return false;

        for (const dep of context.metadata.dependencies) {
            if (!this.services.has(dep)) {
                console.warn(`Service ${name} depends on ${dep}, which is not registered`);
                return false;
            }
        }
        return true;
    }

    // Private methods

    /**
     * Topological sort for dependency resolution
     * @returns {Array<string>} Sorted service names
     */
    _topologicalSort() {
        const sorted = [];
        const visited = new Set();
        const temp = new Set();

        const visit = (name) => {
            if (temp.has(name)) {
                console.warn(`ServiceManager: Circular dependency detected involving ${name}`);
                return;
            }
            if (visited.has(name)) return;

            temp.add(name);
            const context = this.services.get(name);

            if (context) {
                for (const dep of context.metadata.dependencies) {
                    if (this.services.has(dep)) {
                        visit(dep);
                    }
                }
            }

            temp.delete(name);
            visited.add(name);
            sorted.push(name);
        };

        for (const name of this.services.keys()) {
            visit(name);
        }

        return sorted;
    }

    /**
     * Print health report to console
     */
    _printHealthReport() {
        console.log('\n=== Service Health Report ===');
        const statuses = this.getAllStatus();

        statuses.forEach(s => {
            const icon = s.status === 'running' ? '✓' : s.status === 'failed' ? '✗' : '○';
            const time = s.initTime ? `(${s.initTime}ms)` : '';
            console.log(`${icon} ${s.name} v${s.version} - ${s.status} ${time}`);

            if (s.dependencies.length > 0) {
                console.log(`  └─ deps: ${s.dependencies.join(', ')}`);
            }
        });
        console.log('============================\n');
    }
}

export { ServiceManager };
