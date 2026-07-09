/**
 * BreakNode command — breaks a text node at the cursor (Enter key).
 */

import Command from './Command.js';
import { breakTextNode } from '../engine/Transforms.js';

export class BreakNodeCommand extends Command {
    isEnabled() {
        if (this.context.editable === false) return false;
        const sel = this.session.selection;
        if (!sel || sel.type !== 'text') return false;

        // Check we're inside a text node inside a node_array
        try {
            const node = this.session.get(sel.path.slice(0, -1));
            if (!node) return false;
            const node_kind = this.session.inspect(sel.path.slice(0, -2))?.type;
            return node_kind === 'node_array';
        } catch {
            return false;
        }
    }

    execute() {
        const tr = this.session.tr;
        if (breakTextNode(tr)) {
            this.session.apply(tr, { batch: true });
        }
    }
}
