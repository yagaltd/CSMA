/**
 * CSMA Command Service
 * Manages command registration, search, and execution
 * 
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: service
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 */

/**
 * Command Service Class
 * Manages command palette commands
 */
export class CommandService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.commands = new Map();
        this.groups = new Map();
        this.listeners = [];
        this.setupSubscriptions();
    }

    /**
     * Setup EventBus subscriptions
     */
    setupSubscriptions() {
        // Register command
        this.listeners.push(
            this.eventBus.subscribe('INTENT_COMMAND_REGISTER', (payload) => {
                this.registerCommand(payload);
            })
        );

        // Unregister command
        this.listeners.push(
            this.eventBus.subscribe('INTENT_COMMAND_UNREGISTER', (payload) => {
                this.unregisterCommand(payload.id);
            })
        );

        // Execute command
        this.listeners.push(
            this.eventBus.subscribe('COMMAND_EXECUTED', (payload) => {
                this.executeCommand(payload.action, payload.value);
            })
        );

        // Search commands
        this.listeners.push(
            this.eventBus.subscribe('INTENT_COMMAND_SEARCH', (payload) => {
                const results = this.searchCommands(payload.query);
                this.eventBus.publish('COMMAND_SEARCH_RESULTS', {
                    query: payload.query,
                    results,
                    timestamp: Date.now()
                });
            })
        );
    }

    /**
     * Register a command
     * @param {Object} command - Command configuration
     */
    registerCommand(command) {
        const { id, label, action, group, keywords, shortcut, handler } = command;
        
        if (!id || !label || !action) {
            console.warn('[CommandService] Invalid command registration');
            return;
        }

        this.commands.set(id, {
            id,
            label,
            action,
            group: group || 'default',
            keywords: keywords || '',
            shortcut: shortcut || null,
            handler: handler || null
        });

        // Track groups
        if (!this.groups.has(group)) {
            this.groups.set(group, []);
        }
        this.groups.get(group).push(id);

        this.eventBus.publish('COMMAND_REGISTERED', {
            commandId: id,
            timestamp: Date.now()
        });
    }

    /**
     * Unregister a command
     * @param {string} id - Command ID
     */
    unregisterCommand(id) {
        const command = this.commands.get(id);
        if (command) {
            const groupCommands = this.groups.get(command.group);
            if (groupCommands) {
                const index = groupCommands.indexOf(id);
                if (index > -1) {
                    groupCommands.splice(index, 1);
                }
            }
            this.commands.delete(id);

            this.eventBus.publish('COMMAND_UNREGISTERED', {
                commandId: id,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Search commands by query
     * @param {string} query - Search query
     * @returns {Array} Matching commands
     */
    searchCommands(query) {
        if (!query) {
            return Array.from(this.commands.values());
        }

        const lowerQuery = query.toLowerCase();
        const results = [];

        this.commands.forEach(command => {
            const labelMatch = command.label.toLowerCase().includes(lowerQuery);
            const keywordMatch = command.keywords.toLowerCase().includes(lowerQuery);
            
            if (labelMatch || keywordMatch) {
                results.push({
                    ...command,
                    score: labelMatch ? 2 : 1
                });
            }
        });

        // Sort by score
        return results.sort((a, b) => b.score - a.score);
    }

    /**
     * Execute a command
     * @param {string} action - Command action
     * @param {*} value - Command value
     */
    executeCommand(action, value) {
        const command = Array.from(this.commands.values()).find(c => c.action === action);
        
        if (command) {
            if (command.handler) {
                command.handler(value);
            }
            
            this.eventBus.publish('COMMAND_ACTION_TRIGGERED', {
                action,
                value,
                commandId: command.id,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Get all commands grouped
     * @returns {Object} Commands by group
     */
    getGroupedCommands() {
        const grouped = {};
        
        this.groups.forEach((commandIds, groupName) => {
            grouped[groupName] = commandIds
                .map(id => this.commands.get(id))
                .filter(Boolean);
        });

        return grouped;
    }

    /**
     * Cleanup service
     */
    cleanup() {
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.commands.clear();
        this.groups.clear();
    }
}

/**
 * Create Command Service instance
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {CommandService}
 */
export function createCommandService(eventBus) {
    return new CommandService(eventBus);
}
