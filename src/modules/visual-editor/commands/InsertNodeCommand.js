/**
 * InsertNode command — inserts a default node type at the current selection.
 */

import Command from './Command.js';
import { insertDefaultNode } from '../engine/Transforms.js';

export class InsertNodeCommand extends Command {
    isEnabled() {
        if (this.context.editable === false) return false;
        const sel = this.session.selection;
        if (!sel || sel.type !== 'node') return false;

        try {
            const path_info = this.session.inspect(sel.path);
            return path_info?.type === 'node_array';
        } catch {
            return false;
        }
    }

    execute() {
        const tr = this.session.tr;
        if (insertDefaultNode(tr)) {
            this.session.apply(tr);
        }
    }
}
