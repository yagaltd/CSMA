/**
 * Command Registry — manages named commands and dispatches execution.
 */

export class CommandRegistry {
    /**
     * @param {import('../services/EditorSessionService.js').EditorSessionService} session
     * @param {object} context — shared context for all commands (e.g. { editable })
     */
    constructor(session, context = {}) {
        this.session = session;
        this.context = { session, ...context };
        /** @type {Map<string, typeof import('./Command.js').default>} */
        this._commands = new Map();
    }

    /**
     * Register a command class by name.
     * @param {string} name
     * @param {typeof import('./Command.js').default} CommandClass
     */
    register(name, CommandClass) {
        this._commands.set(name, CommandClass);
    }

    /**
     * Get a command instance by name. Creates a new instance each call.
     * Accepts both class constructors and factory functions.
     *
     * - Constructor: `new Cmd(this.context)` — Cmd has prototype.execute
     * - Factory: `Cmd(this.context)` — Cmd is (ctx) => new SomeCmd('type', ctx)
     *
     * @param {string} name
     * @returns {import('./Command.js').default | null}
     */
    get(name) {
        const Cmd = this._commands.get(name);
        if (!Cmd) return null;
        // Detect if it's a class constructor (has execute on prototype)
        // or a plain factory function
        if (Cmd.prototype && typeof Cmd.prototype.execute !== 'undefined') {
            return new Cmd(this.context);
        }
        return Cmd(this.context);
    }

    /**
     * Execute a command by name.
     * @param {string} name
     * @returns {void | Promise<void>}
     */
    execute(name) {
        const command = this.get(name);
        if (!command) {
            console.warn(`[CommandRegistry] Unknown command: "${name}"`);
            return;
        }
        if (!command.isEnabled()) {
            console.warn(`[CommandRegistry] Command "${name}" is disabled`);
            return;
        }
        return command.execute();
    }

    /**
     * Check if a command is enabled.
     * @param {string} name
     * @returns {boolean}
     */
    isEnabled(name) {
        const command = this.get(name);
        return command ? command.isEnabled() : false;
    }

    /**
     * Get all registered command names.
     * @returns {string[]}
     */
    getRegisteredNames() {
        return Array.from(this._commands.keys());
    }

    /**
     * Remove a command from the registry.
     * @param {string} name
     */
    unregister(name) {
        this._commands.delete(name);
    }

    /**
     * Clear all registered commands.
     */
    destroy() {
        this._commands.clear();
    }
}
