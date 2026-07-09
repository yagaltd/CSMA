/**
 * Redo command — redoes the last undone change.
 */

import Command from './Command.js';

export class RedoCommand extends Command {
    isEnabled() {
        return this.context.editable !== false && this.session.canRedo;
    }

    execute() {
        this.session.redo();
    }
}
