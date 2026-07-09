/**
 * Editor Toolbar — optional toolbar UI component.
 *
 * Minimal formatting toolbar that reacts to editor selection state.
 * Part of Phase 2: Rendering Components.
 */

/**
 * Initialize a toolbar for an editor session.
 *
 * @param {Element} container — DOM element to mount toolbar into
 * @param {import('../services/EditorSessionService.js').EditorSessionService} session
 * @param {object} eventBus
 * @param {string} editorId
 * @returns {Function} cleanup function
 */
export function initEditorToolbar(container, session, eventBus, editorId) {
    container.className = 've-toolbar';
    container.setAttribute('data-editor-id', editorId);

    // Define toolbar buttons
    const buttons = [
        { command: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
        { command: 'redo', label: 'Redo', shortcut: 'Ctrl+Y' },
        { type: 'separator' },
        { command: 'toggleMark:strong', label: 'B', shortcut: 'Ctrl+B', title: 'Bold' },
        { command: 'toggleMark:emphasis', label: 'I', shortcut: 'Ctrl+I', title: 'Italic' },
        { command: 'toggleMark:link', label: 'Link', shortcut: 'Ctrl+K', title: 'Link' },
    ];

    const button_elements = [];

    for (const btn of buttons) {
        if (btn.type === 'separator') {
            const sep = document.createElement('div');
            sep.className = 've-toolbar-separator';
            container.appendChild(sep);
            continue;
        }

        const button = document.createElement('button');
        button.className = 've-toolbar-button';
        button.setAttribute('data-command', btn.command);
        button.setAttribute('title', btn.title || btn.label);
        button.setAttribute('aria-label', btn.title || btn.label);
        button.textContent = btn.label;

        if (btn.shortcut) {
            button.setAttribute('data-shortcut', btn.shortcut);
        }

        button.addEventListener('click', () => {
            // Execute command through session's tr
            const command_name = btn.command;
            const colon_index = command_name.indexOf(':');

            if (colon_index !== -1) {
                const base = command_name.substring(0, colon_index);
                const param = command_name.substring(colon_index + 1);

                if (base === 'toggleMark') {
                    const tr = session.tr;
                    tr.toggleMark(param);
                    session.apply(tr);
                } else {
                    // Other parameterized commands
                }
            } else if (command_name === 'undo') {
                session.undo();
            } else if (command_name === 'redo') {
                session.redo();
            }
        });

        button_elements.push(button);
        container.appendChild(button);
    }

    // Update button states on selection change
    function updateStates() {
        for (const button of button_elements) {
            const command_name = button.getAttribute('data-command');
            if (!command_name) continue;

            const sel = session.selection;
            if (!sel || sel.type === 'property') {
                button.setAttribute('disabled', '');
                continue;
            }

            const colon_index = command_name.indexOf(':');
            if (colon_index !== -1) {
                const base = command_name.substring(0, colon_index);
                const param = command_name.substring(colon_index + 1);

                if (base === 'toggleMark') {
                    const selected_marks = session.selectedMarks;
                    const has_mark = selected_marks.some(m => m.node && m.node.type === param);
                    const available = session.getAvailableMarkTypes();

                    if (available.includes(param)) {
                        button.removeAttribute('disabled');
                        if (has_mark) {
                            button.setAttribute('data-state', 'selected');
                        } else {
                            button.removeAttribute('data-state');
                        }
                    } else {
                        button.setAttribute('disabled', '');
                    }
                }
            } else if (command_name === 'undo') {
                if (session.canUndo) {
                    button.removeAttribute('disabled');
                } else {
                    button.setAttribute('disabled', '');
                }
            } else if (command_name === 'redo') {
                if (session.canRedo) {
                    button.removeAttribute('disabled');
                } else {
                    button.setAttribute('disabled', '');
                }
            }
        }
    }

    const unsubscribe = eventBus?.subscribe('EDITOR_SELECTION_CHANGED', (payload) => {
        if (payload.editorId === editorId) {
            updateStates();
        }
    });

    // Initial state
    updateStates();

    return () => {
        if (unsubscribe) try { unsubscribe(); } catch { /* ignore */ }
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        container.className = '';
        container.removeAttribute('data-editor-id');
    };
}
