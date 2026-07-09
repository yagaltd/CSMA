/**
 * SelectParent command — selects the parent of the current selection.
 * Navigates up the document hierarchy.
 */

import Command from './Command.js';

export class SelectParentCommand extends Command {
    isEnabled() {
        if (this.context.editable === false) return false;
        const sel = this.session.selection;
        return sel && sel.path && sel.path.length > 3;
    }

    execute() {
        const sel = this.session.selection;
        if (!sel) return;

        // Strip the last two path segments (property + node id or index + prop)
        const new_path = sel.path.slice(0, -2);

        if (new_path.length === 0) return;

        // Create a property selection on the parent
        this.session.selection = {
            type: 'property',
            path: new_path
        };
    }
}
