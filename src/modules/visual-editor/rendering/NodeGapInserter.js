/**
 * Node Gap Inserter — between-node insertion indicators.
 *
 * Shows a clickable line between nodes in a node_array that inserts
 * a new node of the default type when clicked.
 *
 * Part of Phase 2: Rendering Components.
 */

/**
 * Create a node gap element for insertion between nodes.
 *
 * @param {number} index — insertion position in the node array
 * @param {Function} onInsert — called with (index) when gap is clicked
 * @returns {Element}
 */
export function createNodeGapInserter(index, onInsert) {
    const gap = document.createElement('div');
    gap.className = 've-node-gap';
    gap.setAttribute('data-gap-index', String(index));
    gap.setAttribute('data-state', 'hidden');
    gap.setAttribute('role', 'button');
    gap.setAttribute('aria-label', 'Insert content here');
    gap.setAttribute('tabindex', '0');

    // Visual indicator line
    const line = document.createElement('div');
    line.className = 've-node-gap-line';
    gap.appendChild(line);

    // Insert button
    const button = document.createElement('button');
    button.className = 've-node-gap-button';
    button.setAttribute('aria-hidden', 'true');
    button.textContent = '+';
    gap.appendChild(button);

    // Interaction handlers
    let hover_timeout = null;

    gap.addEventListener('mouseenter', () => {
        clearTimeout(hover_timeout);
        gap.setAttribute('data-state', 'visible');
    });

    gap.addEventListener('mouseleave', () => {
        hover_timeout = setTimeout(() => {
            gap.setAttribute('data-state', 'hidden');
        }, 200);
    });

    gap.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        gap.setAttribute('data-state', 'active');
        onInsert(index);
        setTimeout(() => {
            gap.setAttribute('data-state', 'hidden');
        }, 300);
    });

    gap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onInsert(index);
        }
    });

    return gap;
}
