/**
 * Node Array Container — renders an ordered list of child nodes
 * within a node_array property.
 *
 * Part of Phase 2: Rendering Components.
 */

/**
 * Initialize a node array container.
 *
 * @param {Element} container
 * @param {import('../services/EditorSessionService.js').EditorSessionService} session
 * @param {Array<string|number>} path — path to the node_array property
 * @param {object} config — { renderNode: (el, node, ctx) => void, ctx: object }
 * @returns {Function} cleanup function
 */
export function initNodeArrayContainer(container, session, path, config) {
    const { renderNode, ctx } = config;

    container.className = 've-node-array-container';
    container.setAttribute('data-array-path', path.join(','));

    function render() {
        // Clear
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const value = session.get(path);
        if (!value || !Array.isArray(value.nodes)) {
            // Empty state
            container.setAttribute('data-state', 'empty');
            const placeholder = document.createElement('div');
            placeholder.className = 've-node-array-empty';
            placeholder.textContent = 'Click to add content...';
            container.appendChild(placeholder);
            return;
        }

        container.removeAttribute('data-state');

        if (value.nodes.length === 0) {
            container.setAttribute('data-state', 'empty');
            const placeholder = document.createElement('div');
            placeholder.className = 've-node-array-empty';
            placeholder.textContent = 'Click to add content...';
            container.appendChild(placeholder);
            return;
        }

        for (let i = 0; i < value.nodes.length; i++) {
            const node_id = value.nodes[i];
            const node = session.get(node_id);
            if (!node) continue;

            const wrapper = document.createElement('div');
            wrapper.className = 've-node-wrapper';
            wrapper.setAttribute('data-node-id', node.id);
            wrapper.setAttribute('data-node-index', String(i));

            // Node gap inserter before each node
            const gap = document.createElement('div');
            gap.className = 've-node-gap';
            gap.setAttribute('data-state', 'hidden');
            gap.setAttribute('data-gap-index', String(i));
            gap.addEventListener('click', (e) => {
                e.stopPropagation();
                handleGapClick(i);
            });
            gap.addEventListener('mouseenter', () => {
                gap.setAttribute('data-state', 'visible');
            });
            gap.addEventListener('mouseleave', () => {
                gap.setAttribute('data-state', 'hidden');
            });
            wrapper.appendChild(gap);

            // Render the node
            const node_el = document.createElement('div');
            node_el.className = 've-node-content';

            // Handle node selection via click
            node_el.addEventListener('click', (e) => {
                e.stopPropagation();
                session.selection = {
                    type: 'node',
                    path: [...path],
                    anchor_offset: i,
                    focus_offset: i + 1
                };
            });

            renderNode(node_el, node, ctx);
            wrapper.appendChild(node_el);

            container.appendChild(wrapper);
        }

        // Gap after the last node
        const end_gap = document.createElement('div');
        end_gap.className = 've-node-gap';
        end_gap.setAttribute('data-state', 'hidden');
        end_gap.setAttribute('data-gap-index', String(value.nodes.length));
        end_gap.addEventListener('click', (e) => {
            e.stopPropagation();
            handleGapClick(value.nodes.length);
        });
        end_gap.addEventListener('mouseenter', () => {
            end_gap.setAttribute('data-state', 'visible');
        });
        end_gap.addEventListener('mouseleave', () => {
            end_gap.setAttribute('data-state', 'hidden');
        });
        container.appendChild(end_gap);
    }

    function handleGapClick(index) {
        // Insert default node type at this position
        const tr = session.tr;

        // Get the default node type from schema
        const parent_node = session.get(path.slice(0, -1));
        const prop_name = path[path.length - 1];
        const prop_def = session.schema[parent_node.type]?.properties?.[prop_name];

        if (!prop_def || !prop_def.node_types) return;

        const default_type = prop_def.default_node_type ||
            (prop_def.node_types.length === 1 ? prop_def.node_types[0] : null);

        if (!default_type) return;

        const new_id = session.generateId();

        // Create the node
        tr.create({ id: new_id, type: default_type });

        // Insert into array
        const value = session.get(path);
        const new_nodes = [
            ...value.nodes.slice(0, index),
            new_id,
            ...value.nodes.slice(index)
        ];

        tr.set(path, { ...value, nodes: new_nodes });

        // Select the new node
        tr.setSelection({
            type: 'node',
            path: [...path],
            anchor_offset: index,
            focus_offset: index + 1
        });

        session.apply(tr);
    }

    // Subscribe to document changes
    const unsubscribe = ctx.eventBus?.subscribe('EDITOR_DOCUMENT_CHANGED', () => {
        render();
    });

    // Initial render
    render();

    return () => {
        if (unsubscribe) try { unsubscribe(); } catch { /* ignore */ }
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    };
}
