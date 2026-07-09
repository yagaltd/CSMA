/**
 * DeleteSelection command — deletes the currently selected text or nodes.
 */

import Command from './Command.js';
import { isSelectionCollapsed } from '../engine/SelectionModel.js';

export class DeleteSelectionCommand extends Command {
    isEnabled() {
        if (this.context.editable === false) return false;
        const sel = this.session.selection;
        if (!sel) return false;
        if (sel.type === 'property') return false;
        return !isSelectionCollapsed(sel);
    }

    execute() {
        const tr = this.session.tr;
        tr.deleteSelection();
        this.session.apply(tr);
    }
}
