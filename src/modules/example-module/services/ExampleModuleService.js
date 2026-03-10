/**
 * ExampleModuleService
 * 
 * Demonstrates a service within a module
 */

export class ExampleModuleService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.lastMessage = null;
    }

    init() {
        console.log('[ExampleModuleService] Initialized');

        // Subscribe to events as needed
        // this.eventBus.subscribe('SOME_EVENT', this.handleEvent.bind(this));
    }

    // Service methods
    doSomething() {
        console.log('[ExampleModuleService] Doing something...');
    }

    runHelloCommand(payload = {}) {
        const message = payload.message || 'Hello from the example module';
        this.lastMessage = message;
        console.log(`[ExampleModuleService] ${message}`);
        this.eventBus?.publishSync?.('EXAMPLE_MODULE_EVENT', {
            id: 'example-module',
            message,
            timestamp: Date.now()
        });
        return { ok: true, message };
    }

    cleanup() {
        this.lastMessage = null;
    }
}
