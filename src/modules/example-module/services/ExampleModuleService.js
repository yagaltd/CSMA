/**
 * ExampleModuleService
 * 
 * Demonstrates a service within a module
 */

export class ExampleModuleService {
    constructor(eventBus) {
        this.eventBus = eventBus;
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
}
