/**
 * Example Service
 * Demonstrates CSMA service pattern with EventBus integration
 */
export class ExampleService {
    constructor() {
        this.eventBus = null;
        this.items = new Map();
        this.subscriptions = [];
        this.initialized = false;
    }

    /**
     * Set EventBus (called by ServiceManager)
     */
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }

    /**
     * Initialize service (called by ServiceManager)
     */
    init() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.setupSubscriptions();
        this.loadFromStorage();
    }

    /**
     * Setup event subscriptions
     */
    setupSubscriptions() {
        if (!this.eventBus?.subscribe) {
            return;
        }

        this.subscriptions.push(
            this.eventBus.subscribe('INTENT_CREATE_ITEM', this.handleCreateItem.bind(this)),
            this.eventBus.subscribe('ITEM_STATUS_CHANGED', this.handleStatusChanged.bind(this))
        );
    }

    /**
     * Handle create item intent
     */
    handleCreateItem({ title, description, priority }) {
        const item = {
            id: this.generateId(),
            version: 1,
            title,
            description: description || '',
            status: 'pending',
            priority: priority || 'medium',
            timestamp: Date.now()
        };

        this.items.set(item.id, item);
        this.saveToStorage();

        // Publish event
        this.eventBus.publish('ITEM_SAVED', item);
    }

    /**
     * Handle status change
     */
    handleStatusChanged({ id, status, timestamp }) {
        const item = this.items.get(id);

        if (!item) {
            console.error(`[ExampleService] Item not found: ${id}`);
            return;
        }

        item.status = status;
        item.timestamp = timestamp;

        this.items.set(id, item);
        this.saveToStorage();

        // Publish updated item
        this.eventBus.publish('ITEM_SAVED', item);
    }

    /**
     * Load items from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('csma_items');
            if (stored) {
                const items = JSON.parse(stored);
                items.forEach(item => this.items.set(item.id, item));
                console.log(`[ExampleService] Loaded ${items.length} items from storage`);
            }
        } catch (e) {
            console.error('[ExampleService] Failed to load from storage:', e);
        }
    }

    /**
     * Save items to localStorage
     */
    saveToStorage() {
        try {
            const items = Array.from(this.items.values());
            localStorage.setItem('csma_items', JSON.stringify(items));
        } catch (e) {
            console.error('[ExampleService] Failed to save to storage:', e);
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get all items
     */
    getAll() {
        return Array.from(this.items.values());
    }

    /**
     * Cleanup (called by ServiceManager on unregister)
     */
    destroy() {
        this.initialized = false;
        this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
        this.items.clear();
    }
}
