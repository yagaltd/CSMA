/**
 * ThreadManager - Centralized Web Worker Management
 * 
 * CSMA Principle: Thread isolation and lifecycle management should be 
 * handled by the runtime, not individual services.
 * 
 * Responsibilities:
 * - Create and manage Web Worker instances
 * - Handle worker lifecycle (spawn, terminate, restart)
 * - Provide message routing between services and workers
 * - Monitor worker health and resource usage
 */

class ThreadManager {
    constructor() {
        this.workers = new Map(); // Map<workerId, WorkerContext>
        this.messageHandlers = new Map(); // Map<workerId, Set<callback>>
    }

    /**
     * Spawn a new Web Worker
     * @param {string} workerId - Unique identifier for this worker
     * @param {string|URL} workerUrl - URL to the worker script
     * @param {Object} options - Worker options (type: 'module', etc.)
     * @returns {string} workerId
     */
    spawn(workerId, workerUrl, options = {}) {
        if (this.workers.has(workerId)) {
            console.warn(`ThreadManager: Worker ${workerId} already exists. Returning existing instance.`);
            return workerId;
        }

        try {
            const worker = new Worker(workerUrl, options);
            const context = {
                worker,
                url: workerUrl,
                options,
                createdAt: Date.now(),
                messageCount: 0,
                errorCount: 0,
                status: 'running'
            };

            // Set up internal message handler for routing
            worker.onmessage = (event) => {
                context.messageCount++;
                this._routeMessage(workerId, event);
            };

            worker.onerror = (error) => {
                context.errorCount++;
                console.error(`ThreadManager: Worker ${workerId} error:`, error);
                this._routeError(workerId, error);
            };

            this.workers.set(workerId, context);
            this.messageHandlers.set(workerId, new Set());

            if (import.meta.env && import.meta.env.DEV) {
                console.log(`ThreadManager: Spawned worker ${workerId}`);
            }
            return workerId;

        } catch (error) {
            console.error(`ThreadManager: Failed to spawn worker ${workerId}:`, error);
            throw error;
        }
    }

    /**
     * Subscribe to messages from a specific worker
     * @param {string} workerId - Worker to listen to
     * @param {Function} callback - Handler function (receives MessageEvent)
     */
    subscribe(workerId, callback) {
        if (!this.workers.has(workerId)) {
            throw new Error(`ThreadManager: Worker ${workerId} does not exist`);
        }

        const handlers = this.messageHandlers.get(workerId);
        handlers.add(callback);

        // Return unsubscribe function
        return () => {
            handlers.delete(callback);
        };
    }

    /**
     * Post a message to a worker
     * @param {string} workerId - Target worker
     * @param {*} message - Message to send
     * @param {Array} transfer - Optional transferable objects
     */
    postMessage(workerId, message, transfer = []) {
        const context = this.workers.get(workerId);
        if (!context) {
            throw new Error(`ThreadManager: Worker ${workerId} does not exist`);
        }

        if (context.status !== 'running') {
            console.warn(`ThreadManager: Worker ${workerId} is ${context.status}, message may not be processed`);
        }

        context.worker.postMessage(message, transfer);
    }

    /**
     * Terminate a worker
     * @param {string} workerId - Worker to terminate
     */
    terminate(workerId) {
        const context = this.workers.get(workerId);
        if (!context) {
            console.warn(`ThreadManager: Worker ${workerId} does not exist`);
            return;
        }

        context.worker.terminate();
        context.status = 'terminated';
        this.workers.delete(workerId);
        this.messageHandlers.delete(workerId);

        if (import.meta.env && import.meta.env.DEV) {
            console.log(`ThreadManager: Terminated worker ${workerId}`);
        }
    }

    /**
     * Restart a worker (terminate and respawn)
     * @param {string} workerId - Worker to restart
     * @returns {string} workerId
     */
    restart(workerId) {
        const context = this.workers.get(workerId);
        if (!context) {
            throw new Error(`ThreadManager: Cannot restart non-existent worker ${workerId}`);
        }

        const { url, options } = context;

        // Preserve message handlers
        const handlers = Array.from(this.messageHandlers.get(workerId) || []);

        this.terminate(workerId);
        this.spawn(workerId, url, options);

        // Re-attach handlers
        handlers.forEach(handler => this.subscribe(workerId, handler));

        if (import.meta.env && import.meta.env.DEV) {
            console.log(`ThreadManager: Restarted worker ${workerId}`);
        }
        return workerId;
    }

    /**
     * Get worker status and metrics
     * @param {string} workerId - Worker to inspect
     * @returns {Object} Worker metadata
     */
    getStatus(workerId) {
        const context = this.workers.get(workerId);
        if (!context) {
            return null;
        }

        return {
            workerId,
            status: context.status,
            uptime: Date.now() - context.createdAt,
            messageCount: context.messageCount,
            errorCount: context.errorCount,
            handlerCount: this.messageHandlers.get(workerId)?.size || 0
        };
    }

    /**
     * Get all workers status
     * @returns {Array} Array of worker statuses
     */
    getAllStatus() {
        return Array.from(this.workers.keys()).map(id => this.getStatus(id));
    }

    /**
     * Terminate all workers (cleanup)
     */
    terminateAll() {
        if (import.meta.env && import.meta.env.DEV) {
            console.log('ThreadManager: Terminating all workers...');
        }
        for (const workerId of this.workers.keys()) {
            this.terminate(workerId);
        }
    }

    // Private methods

    _routeMessage(workerId, event) {
        const handlers = this.messageHandlers.get(workerId);
        if (!handlers || handlers.size === 0) {
            console.warn(`ThreadManager: No handlers for worker ${workerId}`);
            return;
        }

        handlers.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error(`ThreadManager: Handler error for worker ${workerId}:`, error);
            }
        });
    }

    _routeError(workerId, error) {
        const handlers = this.messageHandlers.get(workerId);
        if (!handlers) return;

        // Create synthetic error event
        const errorEvent = {
            type: 'error',
            data: { type: 'WORKER_ERROR', error: error.message }
        };

        handlers.forEach(callback => {
            try {
                callback(errorEvent);
            } catch (err) {
                console.error(`ThreadManager: Error handler failed for worker ${workerId}:`, err);
            }
        });
    }
}

// Singleton instance
export const threadManager = new ThreadManager();
const handleThreadManagerBeforeUnload = () => {
    threadManager.terminateAll();
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleThreadManagerBeforeUnload);
}

export function destroyThreadManager() {
    threadManager.terminateAll();
    if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleThreadManagerBeforeUnload);
    }
}
