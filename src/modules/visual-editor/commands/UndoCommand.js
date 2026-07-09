/**
 * Undo command — undoes the last change to the document.
 */

import Command from './Command.js';

export class UndoCommand extends Command {
    isEnabled() {
        return this.context.editable !== false && this.session.canUndo;
    }

    execute() {
        this.session.undo();
    }
}
