/**
 * ToggleMark command — toggles a mark type on the current selection.
 *
 * Supports two registration patterns:
 * 1. Factory: register('toggleMark:strong', ToggleMarkCommand.forMarkType('strong'))
 * 2. Direct: new ToggleMarkCommand('strong', context)
 */

import Command from './Command.js';
import { canSwitchMarkType } from '../engine/SelectionUtils.js';

export class ToggleMarkCommand extends Command {
    /**
     * @param {string} mark_type
     * @param {object} context
     */
    constructor(mark_type, context) {
        super(context);
        this.mark_type = mark_type;
    }

    /**
     * Create a factory function that produces ToggleMarkCommand instances
     * for a specific mark type. Compatible with CommandRegistry.register().
     *
     * @param {string} mark_type
     * @returns {function(object): ToggleMarkCommand}
     */
    static forMarkType(mark_type) {
        return (context) => new ToggleMarkCommand(mark_type, context);
    }

    isEnabled() {
        if (this.context.editable === false) return false;

        const sel = this.session.selection;
        if (!sel) return false;
        if (sel.type === 'property') return false;

        const selected_marks = this.session.selectedMarks;
        const available = this.session.getAvailableMarkTypes();

        return canSwitchMarkType(selected_marks, available) &&
            available.includes(this.mark_type);
    }

    execute() {
        const tr = this.session.tr;
        tr.toggleMark(this.mark_type);
        this.session.apply(tr);
    }
}
