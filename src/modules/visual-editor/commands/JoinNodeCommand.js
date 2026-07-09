/**
 * JoinNode command — joins a text node with the previous sibling
 * when Backspace is pressed at position 0.
 */

import Command from './Command.js';
import { joinTextNode } from '../engine/Transforms.js';
import { isSelectionCollapsed } from '../engine/SelectionModel.js';

export class JoinNodeCommand extends Command {
    isEnabled() {
        if (this.context.editable === false) return false;
        const sel = this.session.selection;
        if (!sel || sel.type !== 'text') return false;
        if (!isSelectionCollapsed(sel)) return false;
        if (sel.anchor_offset !== 0) return false;

        // Check we're inside a text node inside a node_array with a previous sibling
        try {
            const node = this.session.get(sel.path.slice(0, -1));
            if (!node) return false;
            const is_node_array = this.session.inspect(sel.path.slice(0, -2))?.type === 'node_array';
            if (!is_node_array) return false;

            // Check there's a previous sibling
            const node_array_path = sel.path.slice(0, -2);
            const node_array_value = this.session.get(node_array_path);
            const current_index = node_array_value.nodes.indexOf(node.id);
            return current_index > 0;
        } catch {
            return false;
        }
    }

    execute() {
        const tr = this.session.tr;
        if (joinTextNode(tr)) {
            this.session.apply(tr, { batch: true });
        }
    }
}
