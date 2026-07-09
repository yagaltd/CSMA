/**
 * Command — base class for editor commands.
 *
 * Commands are stateful and UI-aware, unlike transforms which are pure functions.
 * They have derived disabled state and can perform async operations.
 *
 * Ported from svedit lib/Command.svelte.js.
 */

export default class Command {
    /**
     * @param {object} context — { session, editable, ... }
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Check if the command can currently be executed.
     * Override in subclasses.
     * @returns {boolean}
     */
    isEnabled() {
        return true;
    }

    /**
     * Execute the command.
     * Override in subclasses.
     * @returns {void | Promise<void>}
     */
    execute() {
        throw new Error('Not implemented');
    }

    /**
     * Derived: whether the command is disabled.
     * @returns {boolean}
     */
    get disabled() {
        return !this.isEnabled();
    }

    /**
     * Get the session from the context.
     * @returns {import('../services/EditorSessionService.js').EditorSessionService}
     */
    get session() {
        return this.context.session;
    }
}
