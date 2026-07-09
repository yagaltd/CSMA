/**
 * KeyMapper — maps keyboard events to editor commands.
 *
 * Supports modifier keys (Mod = Ctrl on Windows/Linux, Meta/Cmd on Mac)
 * and registers keydown listeners on a DOM element.
 *
 * Ported from svedit lib/KeyMapper.svelte.js.
 */

/**
 * @typedef {{ key: string, ctrl?: boolean, meta?: boolean, shift?: boolean, alt?: boolean }} KeyCombo
 */

export class KeyMapper {
    /**
     * @param {import('../commands/CommandRegistry.js').CommandRegistry} commandRegistry
     */
    constructor(commandRegistry) {
        this.commandRegistry = commandRegistry;
        /** @type {Map<string, string>} */
        this._keymap = new Map();
        /** @type {Element | null} */
        this._element = null;
        this._boundHandler = this.handleKeyEvent.bind(this);
    }

    /**
     * Define a keymap from key combos to command names.
     *
     * Key combo format:
     *   'Mod+Key' — Mod = Ctrl on Windows/Linux, Meta (Cmd) on Mac
     *   'Mod+Shift+Key' — with Shift
     *   'Key' — bare key, no modifiers
     *
     * Examples:
     *   'Mod+z' → undo
     *   'Mod+Shift+z' → redo
     *   'Mod+b' → toggleMark:strong
     *   'Enter' → breakNode
     *   'Backspace' → joinNode
     *
     * @param {Record<string, string>} map — { keyCombo: 'commandName' }
     */
    defineKeymap(map) {
        for (const [combo, command] of Object.entries(map)) {
            this._keymap.set(this._normalizeCombo(combo), command);
        }
    }

    /**
     * Handle a KeyboardEvent. Returns true if the event was handled.
     * @param {KeyboardEvent} event
     * @returns {boolean}
     */
    handleKeyEvent(event) {
        const command_name = this._matchEvent(event);
        if (!command_name) return false;
        if (!this.commandRegistry.isEnabled(command_name)) return false;

        event.preventDefault();
        event.stopPropagation();

        // Handle parameterized commands: 'toggleMark:strong' → execute('toggleMark', 'strong')
        const colon_index = command_name.indexOf(':');
        if (colon_index !== -1) {
            const base = command_name.substring(0, colon_index);
            const param = command_name.substring(colon_index + 1);

            // For toggleMark, we need to pass the mark type differently
            if (base === 'toggleMark') {
                // The ToggleMarkCommand needs its mark_type in constructor
                // We handle this by re-registering as 'toggleMark:type'
                this.commandRegistry.execute(command_name);
            } else {
                this.commandRegistry.execute(command_name);
            }
        } else {
            this.commandRegistry.execute(command_name);
        }

        return true;
    }

    /**
     * Attach the keydown listener to a DOM element.
     * @param {Element} element
     */
    attach(element) {
        this.detach();
        this._element = element;
        element.addEventListener('keydown', this._boundHandler);
    }

    /**
     * Detach the keydown listener from the current element.
     */
    detach() {
        if (this._element) {
            this._element.removeEventListener('keydown', this._boundHandler);
            this._element = null;
        }
    }

    /**
     * Destroy the KeyMapper — detach and clear keymap.
     */
    destroy() {
        this.detach();
        this._keymap.clear();
    }

    // ===================================================================
    // Private helpers
    // ===================================================================

    /**
     * Detect if the current platform is macOS.
     * @returns {boolean}
     * @private
     */
    _isMac() {
        return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || '');
    }

    /**
     * Normalize a key combo string for consistent matching.
     * @param {string} combo
     * @returns {string}
     * @private
     */
    _normalizeCombo(combo) {
        const parts = combo.split('+').map(p => p.trim()).filter(Boolean);
        const modifiers = [];
        let key = '';

        for (const part of parts) {
            const lower = part.toLowerCase();
            if (lower === 'mod' || lower === 'ctrl' || lower === 'control') {
                modifiers.push('ctrl');
            } else if (lower === 'cmd' || lower === 'meta' || lower === 'command') {
                modifiers.push('meta');
            } else if (lower === 'shift') {
                modifiers.push('shift');
            } else if (lower === 'alt' || lower === 'option') {
                modifiers.push('alt');
            } else {
                key = part;
            }
        }

        modifiers.sort();
        return [...modifiers, key].join('+');
    }

    /**
     * Build a normalized combo string from a KeyboardEvent.
     * @param {KeyboardEvent} event
     * @returns {string}
     * @private
     */
    _eventToCombo(event) {
        const modifiers = [];

        // Mod maps to Ctrl on non-Mac, Meta (Cmd) on Mac
        const is_mac = this._isMac();
        const has_mod = is_mac ? event.metaKey : event.ctrlKey;

        if (has_mod || event.ctrlKey) {
            if (!is_mac || event.ctrlKey) modifiers.push('ctrl');
        }
        if (event.metaKey) modifiers.push('meta');
        if (event.shiftKey) modifiers.push('shift');
        if (event.altKey) modifiers.push('alt');

        // Normalize key name
        let key = event.key;
        if (key === ' ' || key === 'Spacebar') key = 'Space';
        if (key.length === 1) key = key.toLowerCase();

        modifiers.sort();
        return [...modifiers, key].join('+');
    }

    /**
     * Match a KeyboardEvent against the registered keymap.
     * @param {KeyboardEvent} event
     * @returns {string | null} command name or null
     * @private
     */
    _matchEvent(event) {
        // Ignore events from input/textarea/select elements (they need native handling)
        const target = /** @type {Element} */ (event.target);
        if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
            return null;
        }

        // Ignore if inside a contenteditable that isn't our editor
        // (our editor's contenteditable divs are fine)
        // For now, we handle all key events on the attached element

        const combo = this._eventToCombo(event);
        return this._keymap.get(combo) || null;
    }
}

/**
 * Create and populate a default keymap for a KeyMapper.
 *
 * @param {KeyMapper} key_mapper
 * @param {object} [overrides] — optional key → command overrides
 */
export function defineDefaultKeymap(key_mapper, overrides = {}) {
    const default_map = {
        'Mod+z': 'undo',
        'Mod+Shift+z': 'redo',
        'Mod+y': 'redo',
        'Mod+b': 'toggleMark:strong',
        'Mod+i': 'toggleMark:emphasis',
        'Mod+k': 'toggleMark:link',
        'Enter': 'breakNode',
        'Backspace': 'joinNode',
        'Delete': 'deleteSelection',
        'Escape': 'selectParent'
    };

    key_mapper.defineKeymap({ ...default_map, ...overrides });
}
