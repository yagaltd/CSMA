/**
 * Transaction — atomic document operations with undo/redo support.
 *
 * A Transaction groups multiple document operations (create, set, delete)
 * into a single atomic unit. It maintains both forward operations and their
 * inverse operations for undo. All mutations happen on a copy-on-write draft,
 * leaving the original document untouched until apply.
 *
 * Ported from svedit lib/Transaction.svelte.js — all core ops minus
 * Svelte reactivity.
 *
 * @example
 * const tr = session.tr;
 * tr.set(['para_1', 'content'], newContent);
 * tr.create({ id: 'para_2', type: 'paragraph', content: { content: 'Hello', marks: [], annotations: [] } });
 * session.apply(tr);
 */

import { docGet, docPropertyType, docKind, docInspect } from './DocumentModel.js';
import { uid } from '../../../utils/id.js';
import { createDocumentDraft, applyOpToDraft, cascadeDeleteUnreferencedNodes } from './TransactionOps.js';
import { fillNodeDefaults } from './DocumentDefaults.js';
import { validateNode, isIdValid } from './NodeValidator.js';
import { traverse } from './ReferenceTraversal.js';
import {
    getSelectionRange,
    isSelectionCollapsed,
    createCursor,
    createTextSelection
} from './SelectionModel.js';
import {
    getSelectedMarks,
    getSelectedAnnotations,
    getSelectedRangeTypes,
    canSwitchMarkType
} from './SelectionUtils.js';
import {
    getCharLength,
    charSlice,
    adjustRangesForDeletion
} from './TextOperations.js';

export default class Transaction {
    /**
     * @param {Record<string, object>} schema
     * @param {object} doc — { document_id, nodes }
     * @param {object | null} selection
     * @param {object} config — { generate_id?, components?, inserters? }
     */
    constructor(schema, doc, selection, config) {
        this.schema = schema;
        /** @type {object} */
        this.doc = createDocumentDraft(doc);
        /** @type {object | null} */
        this.selection = selection ? { ...selection, path: [...selection.path] } : null;
        this.config = config || {};

        /** @type {Array<Array>} */
        this.ops = [];
        /** @type {Array<Array>} */
        this.inverse_ops = [];

        // Remember the selection before the transaction started
        this.selection_before = selection
            ? { ...selection, path: [...selection.path] }
            : null;

        /** @type {string[]} */
        this.created_node_ids = [];
        /** @type {string[]} */
        this.modified_node_ids = [];
        /** @type {string[]} */
        this.deleted_node_ids = [];
        /** @type {boolean} */
        this.changed_node_types = false;
    }

    // ===================================================================
    // Read operations (on the draft)
    // ===================================================================

    /**
     * Get a value from the draft at the specified path.
     * @param {Array<string|number>|string} path
     * @returns {any}
     */
    get(path) {
        return docGet(this.schema, this.doc, path);
    }

    /**
     * Get the property type from schema.
     * @param {string} type
     * @param {string} property
     * @returns {string | null}
     */
    propertyType(type, property) {
        return docPropertyType(this.schema, type, property);
    }

    /**
     * Get the kind of a node.
     * @param {{ type: string } | string} node
     * @returns {'document'|'block'|'text'|'mark'|'annotation'}
     */
    kind(node) {
        return docKind(this.schema, node);
    }

    /**
     * Inspect a path in the draft.
     * @param {Array<string|number>} path
     * @returns {object}
     */
    inspect(path) {
        return docInspect(this.schema, this.doc, path);
    }

    /**
     * Validate a node against the schema using draft state.
     * @param {object} node
     */
    validateNode(node) {
        validateNode(node, this.schema, this.doc.nodes, { require_references: false });
    }

    /**
     * Generate a new unique node ID.
     * @returns {string}
     */
    generateId() {
        const generate = this.config.generate_id;
        const id = generate ? generate() : uid('node');
        if (!isIdValid(id)) {
            throw new Error(
                `Generated node ID ${JSON.stringify(id)} is invalid. ` +
                'IDs must start with a letter or underscore, contain only letters, ' +
                'numbers, underscores, or dashes, and not contain "__".'
            );
        }
        return id;
    }

    /**
     * Get all node IDs referenced by a node (recursively, excluding the node itself).
     * @param {string} node_id
     * @returns {string[]}
     */
    getReferencedNodes(node_id) {
        return traverse(node_id, this.schema, this.doc.nodes).slice(0, -1);
    }

    get availableMarkTypes() {
        if (!this.selection || this.selection.type === 'property') return [];
        if (this.selection.type !== 'text' && this.selection.type !== 'node') return [];
        try {
            const prop_def = this.inspect(this.selection.path);
            return prop_def.mark_types || [];
        } catch {
            return [];
        }
    }

    get availableAnnotationTypes() {
        if (!this.selection || this.selection.type === 'property') return [];
        if (this.selection.type !== 'text' && this.selection.type !== 'node') return [];
        try {
            const prop_def = this.inspect(this.selection.path);
            return prop_def.annotation_types || [];
        } catch {
            return [];
        }
    }

    get selectedMarks() {
        return getSelectedMarks(this.schema, this.doc, this.selection);
    }

    get activeMark() {
        return this.selectedMarks.length === 1 ? this.selectedMarks[0] : null;
    }

    get selectedAnnotations() {
        return getSelectedAnnotations(this.schema, this.doc, this.selection);
    }

    get activeAnnotation() {
        return this.selectedAnnotations.length === 1 ? this.selectedAnnotations[0] : null;
    }

    // ===================================================================
    // Write operations
    // ===================================================================

    /**
     * Set a property of a node to a new value.
     *
     * @param {Array<string|number>} path — e.g. ['para_1', 'content']
     * @param {any} value
     * @returns {Transaction} this
     */
    set(path, value) {
        const path_info = this.inspect(path);

        if (path_info?.kind !== 'property') {
            throw new Error(
                `Transaction.set requires a path that points to a property, got ${JSON.stringify(path)}`
            );
        }

        const node = this.get(path.slice(0, -1));
        const normalized_path = [node.id, path[path.length - 1]];
        const property_key = String(path[path.length - 1]);
        const previous_value = structuredClone(node[property_key]);

        // Determine if setting this property could orphan referenced nodes
        const prop_type = this.propertyType(node.type, property_key);
        /** @type {string[]} */
        let removed_node_ids = [];

        if (prop_type === 'node' && typeof previous_value === 'string' && previous_value !== value) {
            removed_node_ids = [previous_value];
        } else if (prop_type === 'node_array' && previous_value && Array.isArray(previous_value.nodes)) {
            const next_node_ids = new Set(value?.nodes || []);
            removed_node_ids = previous_value.nodes.filter(id => !next_node_ids.has(id));
        }

        const op = ['set', normalized_path, value];
        this.ops.push(op);
        this.inverse_ops.push(['set', normalized_path, previous_value]);
        applyOpToDraft(this.doc, op);
        this._trackNodeId(this.modified_node_ids, node.id);

        if (property_key === 'type') {
            this.changed_node_types = true;
        }

        // Cascade-delete orphaned nodes
        if (removed_node_ids.length > 0) {
            this._cascadeDeleteUnreferencedNodes(removed_node_ids);
        }

        return this;
    }

    /**
     * Create a new node in the document.
     *
     * @param {object} node — must include id, type; defaults filled for missing properties
     * @returns {Transaction} this
     */
    create(node) {
        const node_with_defaults = fillNodeDefaults(node, this.schema);

        // Validate node against schema
        validateNode(node_with_defaults, this.schema, this.doc.nodes, { require_references: false });

        if (this.doc.nodes[node_with_defaults.id]) {
            throw new Error(`Node "${node_with_defaults.id}" already exists`);
        }

        const op = ['create', node_with_defaults];
        this.ops.push(op);
        this.inverse_ops.push(['delete', node_with_defaults.id]);
        applyOpToDraft(this.doc, op);
        this._trackNodeId(this.created_node_ids, node_with_defaults.id);

        return this;
    }

    /**
     * Delete a node from the document by its ID.
     * This is a force-delete — callers are responsible for handling
     * dangling references. For ref-count-aware cleanup, see
     * _cascadeDeleteUnreferencedNodes.
     *
     * @param {string} id
     * @returns {Transaction} this
     */
    delete(id) {
        const previous_value = this.doc.nodes[id];
        if (!previous_value) {
            console.warn(`Deletion of node "${id}" skipped: does not exist`);
            return this;
        }

        const referenced_nodes = this.getReferencedNodes(id);
        const op = ['delete', id];
        this.ops.push(op);
        this.inverse_ops.push(['create', { ...previous_value }]);
        applyOpToDraft(this.doc, op);
        this._trackNodeId(this.deleted_node_ids, id);

        // Cascade delete orphaned descendants
        this._cascadeDeleteUnreferencedNodes(referenced_nodes);

        return this;
    }

    /**
     * Set the document selection. Applied after the transaction.
     *
     * @param {object} selection
     * @returns {Transaction} this
     */
    setSelection(selection) {
        this.selection = selection;
        return this;
    }

    /**
     * Delete the currently selected text or nodes.
     *
     * @returns {Transaction} this
     */
    deleteSelection() {
        if (!this.selection) return this;
        if (isSelectionCollapsed(this.selection)) return this;

        if (this.selection.type === 'text') {
            this._deleteTextSelection();
        } else if (this.selection.type === 'node') {
            this._deleteNodeSelection();
        }

        return this;
    }

    /**
     * Delete selected text range.
     * @private
     */
    _deleteTextSelection() {
        const sel = this.selection;
        const path = sel.path;
        const range = getSelectionRange(sel);
        const text_value = this.get(path);

        if (!text_value || typeof text_value.content !== 'string') return;

        // Slice out the deleted portion
        const before = charSlice(text_value, 0, range.start_offset);
        const after = charSlice(text_value, range.end_offset, text_value.content.length);
        const new_content = before.content + after.content;

        // Merge marks and annotations from both sides
        const new_marks = [
            ...before.marks,
            ...after.marks.map(m => ({
                start_offset: m.start_offset + before.content.length,
                end_offset: m.end_offset + before.content.length,
                node_id: m.node_id
            }))
        ];
        const new_annotations = [
            ...before.annotations,
            ...after.annotations.map(a => ({
                start_offset: a.start_offset + before.content.length,
                end_offset: a.end_offset + before.content.length,
                node_id: a.node_id
            }))
        ];

        this.set(path, {
            content: new_content,
            marks: new_marks,
            annotations: new_annotations
        });

        // Collapse selection to deletion point
        this.selection = createCursor(path, range.start_offset);
    }

    /**
     * Delete selected nodes in a node_array.
     * @private
     */
    _deleteNodeSelection() {
        const sel = this.selection;
        const path = sel.path;
        const range = getSelectionRange(sel);
        const value = this.get(path);

        if (!value || !Array.isArray(value.nodes)) return;

        const { nodes, marks, annotations } = value;
        const new_nodes = [
            ...nodes.slice(0, range.start_offset),
            ...nodes.slice(range.end_offset)
        ];

        // Adjust marks and annotations for the deletion
        const adjusted_marks = adjustRangesForDeletion(
            marks, range.start_offset, range.end_offset - range.start_offset
        );
        const adjusted_annotations = adjustRangesForDeletion(
            annotations, range.start_offset, range.end_offset - range.start_offset
        );

        this.set(path, {
            nodes: new_nodes,
            marks: adjusted_marks,
            annotations: adjusted_annotations
        });

        // Set cursor at the deletion point
        const new_offset = Math.min(range.start_offset, new_nodes.length);
        this.selection = { type: 'node', path, anchor_offset: new_offset, focus_offset: new_offset };
    }

    // ===================================================================
    // Higher-level operations
    // ===================================================================

    /**
     * Deep-clone a subgraph with new IDs.
     * Takes a root node_id and a nodes map (from another document or template),
     * clones all reachable nodes with new IDs, and returns the new root ID.
     *
     * @param {string} node_id — root of subgraph to clone
     * @param {Record<string, object>} nodes — source nodes map
     * @returns {string} new root node ID
     */
    build(node_id, nodes) {
        const depth_first_nodes = traverse(node_id, this.schema, nodes);
        const id_map = {};

        for (const src_node_id of depth_first_nodes) {
            const src_node = nodes[src_node_id];
            if (!src_node) continue;

            const new_id = this.generateId();
            id_map[src_node_id] = new_id;
            let new_node = { ...src_node, id: new_id };
            const node_schema = this.schema[src_node.type];

            if (!node_schema) continue;

            for (const [prop_name, prop_def] of Object.entries(node_schema.properties)) {
                const value = new_node[prop_name];
                if (value === undefined || value === null) continue;

                const remapRanges = (ranges) =>
                    (ranges ?? []).map(({ start_offset, end_offset, node_id: rid }) => ({
                        start_offset,
                        end_offset,
                        node_id: id_map[rid] || rid
                    }));

                if (prop_def.type === 'node_array' && typeof value === 'object') {
                    new_node[prop_name] = {
                        nodes: value.nodes ? value.nodes.map(ref_id => id_map[ref_id] || ref_id) : [],
                        marks: remapRanges(value.marks),
                        annotations: remapRanges(value.annotations)
                    };
                } else if (prop_def.type === 'node' && typeof value === 'string') {
                    new_node[prop_name] = id_map[value] || value;
                } else if (prop_def.type === 'text' && value) {
                    new_node[prop_name] = {
                        content: value.content || '',
                        marks: remapRanges(value.marks),
                        annotations: remapRanges(value.annotations)
                    };
                }
            }

            new_node = fillNodeDefaults(new_node, this.schema);
            this.create(new_node);
        }

        return id_map[node_id];
    }

    /**
     * Toggle a mark on the current selection.
     *
     * @param {string} mark_type
     * @returns {Transaction} this
     */
    toggleMark(mark_type) {
        if (!this.selection) return this;

        // Helper to get the path for the affected property
        const sel = this.selection;
        let property_path;

        if (sel.type === 'text') {
            property_path = sel.path;
        } else if (sel.type === 'node') {
            property_path = sel.path;
        } else {
            return this;
        }

        const range = getSelectionRange(sel);
        let start = range.start_offset;
        let end = range.end_offset;

        // If collapsed, extend to word boundaries
        if (isSelectionCollapsed(sel) && sel.type === 'text') {
            const text_value = this.get(property_path);
            if (text_value && typeof text_value.content === 'string') {
                const content = text_value.content;
                // Extend start to word boundary (backward)
                while (start > 0 && /\w/.test(content[start - 1])) start--;
                // Extend end to word boundary (forward)
                while (end < content.length && /\w/.test(content[end])) end++;
            }
            if (start === end) return this; // nothing to mark
        }

        if (start === end) return this;

        // Get currently selected marks to determine toggle behavior
        const selected_marks = getSelectedMarks(this.schema, this.doc, sel);
        const same_type_marks = selected_marks.filter(
            m => m.node && m.node.type === mark_type
        );

        // Check if a same-type mark already fully contains the selection
        const full_contain = same_type_marks.find(
            m => m.start_offset <= start && m.end_offset >= end
        );

        if (full_contain) {
            // Remove the existing mark — shrink or split it
            this._removeMarkRange(property_path, full_contain, start, end);
        } else if (same_type_marks.length === 0) {
            // Check for property-less marks: if one different-type mark fully
            // contains the selection, switch its type (delete old, create new)
            const schema_mark = this.schema[mark_type];
            const has_properties = schema_mark && Object.keys(schema_mark.properties).length > 0;

            if (!has_properties && selected_marks.length === 1) {
                const existing = selected_marks[0];
                if (existing.node && Object.keys(this.schema[existing.node.type]?.properties || {}).length === 0) {
                    if (existing.start_offset <= start && existing.end_offset >= end) {
                        // Switch: delete old property-less mark, create new
                        this._removeMarkRange(property_path, existing, start, end);
                    }
                }
            }
            // Add new mark
            this._addMark(property_path, start, end, mark_type);
        }
        // Multiple mixed marks — do nothing (disambiguate by clear-first)

        return this;
    }

    /**
     * Add a mark spanning [start, end) on the given property.
     * @private
     */
    _addMark(property_path, start, end, mark_type) {
        const mark_id = this.generateId();
        this.create({ id: mark_id, type: mark_type });

        const text_value = this.get(property_path);
        if (!text_value) return;

        const new_marks = [...(text_value.marks || []), {
            start_offset: start,
            end_offset: end,
            node_id: mark_id
        }];

        this.set(property_path, {
            ...text_value,
            marks: new_marks
        });
    }

    /**
     * Remove a mark range that overlaps [start, end).
     * If the mark extends beyond the range on either side, it is split.
     * @private
     */
    _removeMarkRange(property_path, mark, start, end) {
        const text_value = this.get(property_path);
        if (!text_value) return;

        const new_marks = [];
        let fully_removed = true;

        for (const m of text_value.marks) {
            if (m.node_id === mark.node_id &&
                m.start_offset === mark.start_offset &&
                m.end_offset === mark.end_offset) {
                // This is the mark to remove — potentially split it
                if (m.start_offset < start) {
                    new_marks.push({
                        start_offset: m.start_offset,
                        end_offset: start,
                        node_id: m.node_id
                    });
                    fully_removed = false;
                }
                if (m.end_offset > end) {
                    // Second half gets a NEW mark node to avoid two ranges
                    // sharing the same node_id (violates exclusivity model)
                    const new_mark_id = this.generateId();
                    const old_mark_node = this.get(m.node_id);
                    if (old_mark_node) {
                        this.create({ id: new_mark_id, type: old_mark_node.type });
                    }
                    new_marks.push({
                        start_offset: end,
                        end_offset: m.end_offset,
                        node_id: new_mark_id
                    });
                    fully_removed = false;
                }
                // The covered portion [start, end) is removed
            } else {
                new_marks.push(m);
            }
        }

        this.set(property_path, { ...text_value, marks: new_marks });

        // Delete the mark node only if it was fully removed
        if (fully_removed) {
            try { this.delete(mark.node_id); } catch { /* already deleted */ }
        }
    }

    /**
     * Add an annotation to the current selection.
     *
     * @param {string} ann_type
     * @returns {Transaction} this
     */
    addAnnotation(ann_type) {
        if (!this.selection) return this;

        const sel = this.selection;
        if (sel.type === 'property') return this;

        const range = getSelectionRange(sel);
        if (range.start_offset === range.end_offset) return this;

        const ann_id = this.generateId();
        this.create({ id: ann_id, type: ann_type });

        const value = this.get(sel.path);
        if (!value || !Array.isArray(value.annotations)) return this;

        const new_annotations = [...value.annotations, {
            start_offset: range.start_offset,
            end_offset: range.end_offset,
            node_id: ann_id
        }];

        this.set(sel.path, { ...value, annotations: new_annotations });
        return this;
    }

    /**
     * Remove an annotation by its node ID.
     *
     * @param {string} ann_node_id
     * @returns {Transaction} this
     */
    removeAnnotation(ann_node_id) {
        if (!this.selection) return this;

        const sel = this.selection;
        if (sel.type === 'property') return this;

        const value = this.get(sel.path);
        if (!value || !Array.isArray(value.annotations)) return this;

        const new_annotations = value.annotations.filter(a => a.node_id !== ann_node_id);
        this.set(sel.path, { ...value, annotations: new_annotations });

        // Delete the annotation node
        try {
            this.delete(ann_node_id);
        } catch {
            // Already deleted or never existed — OK
        }

        return this;
    }

    // ===================================================================
    // Internal helpers
    // ===================================================================

    /**
     * Track a node ID in a tracking array (deduplicated).
     * @private
     */
    _trackNodeId(node_ids, node_id) {
        if (!node_ids.includes(node_id)) {
            node_ids.push(node_id);
        }
    }

    /**
     * Cascade-delete nodes that have zero references.
     * @private
     */
    _cascadeDeleteUnreferencedNodes(candidate_ids) {
        cascadeDeleteUnreferencedNodes(
            this.doc, this.schema, candidate_ids,
            this.ops, this.inverse_ops,
            this.created_node_ids, this.modified_node_ids, this.deleted_node_ids
        );
    }
}
