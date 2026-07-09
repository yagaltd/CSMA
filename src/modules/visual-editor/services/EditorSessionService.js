import Transaction from '../engine/Transaction.js';
import { createDocumentDraft, applyOpToDraft } from '../engine/TransactionOps.js';
import { validateDocumentSchema } from '../engine/DocumentSchema.js';
import { validateDocument } from '../engine/DocumentModel.js';
import { validateConfigComponents, validateNode } from '../engine/NodeValidator.js';
import { docGet, docInspect, docKind } from '../engine/DocumentModel.js';
import { isIdValid } from '../engine/NodeValidator.js';
import { validateSelection } from '../engine/SelectionModel.js';
import {
    getSelectedMarks,
    getSelectedAnnotations
} from '../engine/SelectionUtils.js';
import { getReferencingNodeIds } from '../engine/ReferenceTraversal.js';
/**
 * Editor Session Service — CSMA integration point for the visual editor engine.
 *
 * Wraps the document model, selection, transaction engine, and undo/redo
 * history. Publishes events on the CSMA EventBus.
 *
 * Ported from svedit lib/Session.svelte.js — all core session logic minus
 * Svelte reactivity ($state, $derived).
 */

const BATCH_WINDOW_MS = 1000;

export class EditorSessionService {

    /** @type {Map<string, EditorSessionService>} */
    static _sessions = new Map();
    /**
     * @param {object} eventBus — CSMA EventBus instance
     */
    constructor(eventBus) {
        this.eventBus = eventBus;

        /** @type {Record<string, object> | null} */
        this.schema = null;

        /** @type {object | null} */
        this.doc = null;

        /** @type {object | null} */
        this.config = null;

        /** @type {object | null} */
        this._selection = null;

        /** @type {Array<object>} */
        this.history = [];

        /** @type {number} */
        this.history_index = -1;

        /** @type {number | undefined} */
        this.last_batch_started = undefined;

        /** @type {boolean} */
        this.initialized = false;

        /** @type {string | null} */
        this._editorId = null;

        /** @type {Record<string, Function>} */
        this._commands = {};

        /** @type {Array<Function>} */
        this._intentUnsubscribers = [];
        this._subscriptions = [];

        // Subscribe to EventBus intents for multi-editor coordination
        this._subscribeIntents();
    }

    // ===================================================================
    // Lifecycle
    // ===================================================================

    /**
     * Initialize the editor session with a schema, document, and config.
     *
     * @param {object} options
     * @param {string} options.editorId — unique editor instance ID
     * @param {Record<string, object>} options.schema
     * @param {object} options.doc — { document_id, nodes }
     * @param {object} [options.config] — { generate_id?, components?, inserters? }
     * @param {object} [options.selection] — initial selection
     */
    init({ editorId, schema, doc, config = {}, selection = null }) {
        if (this.initialized) {
            this.destroy();
        }

        this._editorId = editorId;

        // Store in multi-session registry
        EditorSessionService._sessions.set(editorId, this);

        // Validate schema
        validateDocumentSchema(schema);
        this.schema = schema;

        // Validate document
        validateDocument(doc, schema);
        this.doc = doc;

        // Validate config components
        validateConfigComponents(schema, config);
        this.config = config;

        // Set initial selection (null = no selection)
        if (selection) {
            this._validateSelection(selection);
        }
        this._selection = selection;

        this.history = [];
        this.history_index = -1;
        this.last_batch_started = undefined;
        this.initialized = true;

        // Publish ready event
        this._publish('EDITOR_READY', {
            editorId: this._editorId,
            documentId: this.doc.document_id,
            schemaNodeTypes: Object.keys(this.schema),
            timestamp: Date.now()
        });
    }

    /**
     * Destroy the editor session. Clears all state and subscriptions.
     */
    destroy() {
        this.initialized = false;
        this.schema = null;
        this.doc = null;
        this.config = null;
        this._selection = null;
        this.history = [];
        this.history_index = -1;
        this.last_batch_started = undefined;

        // Clean up intent subscriptions
        for (const unsubscribe of this._intentUnsubscribers) {
            try { unsubscribe(); } catch { /* ignore */ }
        }
        this._intentUnsubscribers = [];

        // Clean up general subscriptions
        for (const unsubscribe of this._subscriptions) {
            try { unsubscribe(); } catch { /* ignore */ }
        }
        this._subscriptions = [];

        // Remove from multi-session registry
        if (this._editorId) {
            EditorSessionService._sessions.delete(this._editorId);
        }
        this._editorId = null;
    }

    get isInitialized() {
        return this.initialized;
    }

    get editorId() {
        return this._editorId;
    }

    // ===================================================================
    // Document access
    // ===================================================================

    get documentId() {
        return this.doc ? this.doc.document_id : null;
    }

    // ===================================================================
    // Selection
    // ===================================================================

    get selection() {
        return this._selection;
    }

    set selection(value) {
        this._validateSelection(value);
        this._selection = value;

        this._publish('EDITOR_SELECTION_CHANGED', {
            editorId: this._editorId,
            selection: value ? { ...value, path: [...value.path] } : null,
            availableMarkTypes: this.getAvailableMarkTypes(),
            availableAnnotationTypes: this.getAvailableAnnotationTypes(),
            activeMark: this.activeMark?.node_id || null,
            activeAnnotation: this.activeAnnotation?.node_id || null,
            selectedNodeType: this.getSelectedNode()?.type || null,
            timestamp: Date.now()
        });
    }

    // ===================================================================
    // Read operations
    // ===================================================================

    /**
     * Get a node or property value at the specified path.
     * @param {Array<string|number>|string} path
     * @returns {any}
     */
    get(path) {
        return docGet(this.schema, this.doc, path);
    }

    /**
     * Inspect a path — returns { kind: 'property'|'node', ...metadata }.
     * @param {Array<string|number>} path
     * @returns {object}
     */
    inspect(path) {
        return docInspect(this.schema, this.doc, path);
    }

    /**
     * Generate a new unique node ID.
     * @returns {string}
     */
    generateId() {
        const id = this.config?.generate_id
            ? this.config.generate_id()
            : `node_${crypto.randomUUID()}`;
        if (!isIdValid(id)) {
            throw new Error(
                `Generated node ID ${JSON.stringify(id)} is invalid.`
            );
        }
        return id;
    }

    /**
     * Get the currently selected node (if any).
     * @returns {object | null}
     */
    getSelectedNode() {
        if (!this._selection) return null;

        const sel = this._selection;

        if (sel.type === 'node') {
            const start = Math.min(sel.anchor_offset, sel.focus_offset);
            const end = Math.max(sel.anchor_offset, sel.focus_offset);
            if (end - start !== 1) return null; // Only single-node selection

            try {
                const node_array = this.get(sel.path);
                const node_id = node_array.nodes[start];
                return node_id ? this.get(node_id) : null;
            } catch {
                return null;
            }
        }

        // Text or property selection — get the owner node
        // Path for text: [node_id, 'content']
        // Path for property: [node_id, 'property_name']
        try {
            const owner_node_path = sel.path.slice(0, -1);
            const owner_node = this.get(owner_node_path);
            return owner_node && owner_node.id ? owner_node : null;
        } catch {
            return null;
        }
    }

    /**
     * Get available mark types for the current selection.
     * @returns {string[]}
     */
    getAvailableMarkTypes() {
        if (!this._selection) return [];
        if (this._selection.type === 'property') return [];
        try {
            const prop_def = this.inspect(this._selection.path);
            return prop_def.mark_types || [];
        } catch {
            return [];
        }
    }

    /**
     * Get available annotation types for the current selection.
     * @returns {string[]}
     */
    getAvailableAnnotationTypes() {
        if (!this._selection) return [];
        if (this._selection.type === 'property') return [];
        try {
            const prop_def = this.inspect(this._selection.path);
            return prop_def.annotation_types || [];
        } catch {
            return [];
        }
    }

    get selectedMarks() {
        return getSelectedMarks(this.schema, this.doc, this._selection);
    }

    get activeMark() {
        return this.selectedMarks.length === 1 ? this.selectedMarks[0] : null;
    }

    get selectedAnnotations() {
        return getSelectedAnnotations(this.schema, this.doc, this._selection);
    }

    get activeAnnotation() {
        return this.selectedAnnotations.length === 1 ? this.selectedAnnotations[0] : null;
    }

    // ===================================================================
    // Mutation
    // ===================================================================

    /**
     * Create a new transaction from the current state.
     * @returns {Transaction}
     */
    get tr() {
        return new Transaction(this.schema, this.doc, this._selection, this.config);
    }

    /**
     * Apply a transaction to the document.
     *
     * @param {Transaction} transaction
     * @param {object} [options]
     * @param {boolean} [options.batch=false] — allow batching with previous transaction
     * @returns {EditorSessionService} this
     */
    apply(transaction, { batch = false } = {}) {
        // Validate only affected nodes
        this._validateTransactionResult(transaction);

        // Swap doc if anything changed
        if (transaction.ops.length > 0) {
            this.doc = transaction.doc;
        }

        // Update selection (clone for new reference)
        this._selection = transaction.selection
            ? structuredClone(transaction.selection)
            : null;

        // Truncate future history if we undid before this edit
        const has_ops = transaction.ops.length > 0;

        if (has_ops) {
            // Truncate future history if we undid before this edit
            if (this.history_index < this.history.length - 1) {
                this.history = this.history.slice(0, this.history_index + 1);
            }

            const now = Date.now();
            const should_batch =
                batch &&
                this.last_batch_started !== undefined &&
                now - this.last_batch_started < BATCH_WINDOW_MS;

            if (should_batch) {
                const last_entry = this.history[this.history_index];
                last_entry.ops.push(...transaction.ops);
                last_entry.inverse_ops.push(...transaction.inverse_ops);
                last_entry.selection_after = this._selection
                    ? structuredClone(this._selection)
                    : null;
                this.history = [...this.history];
            } else {
                this.history = [
                    ...this.history,
                    {
                        ops: transaction.ops,
                        inverse_ops: transaction.inverse_ops,
                        selection_before: transaction.selection_before
                            ? structuredClone(transaction.selection_before)
                            : null,
                        selection_after: this._selection
                            ? structuredClone(this._selection)
                            : null
                    }
                ];
                this.history_index = this.history_index + 1;

                if (batch) {
                    this.last_batch_started = now;
                } else {
                    this.last_batch_started = undefined;
                }
            }
        }

        // Publish document changed event
        if (transaction.ops.length > 0) {
            this._publish('EDITOR_DOCUMENT_CHANGED', {
                editorId: this._editorId,
                documentId: this.doc.document_id,
                ops: transaction.ops,
                canUndo: this.canUndo,
                canRedo: this.canRedo,
                timestamp: Date.now()
            });
        }

        // Publish selection changed if selection was modified
        this._publish('EDITOR_SELECTION_CHANGED', {
            editorId: this._editorId,
            selection: this._selection
                ? { ...this._selection, path: [...this._selection.path] }
                : null,
            availableMarkTypes: this.getAvailableMarkTypes(),
            availableAnnotationTypes: this.getAvailableAnnotationTypes(),
            activeMark: this.activeMark?.node_id || null,
            activeAnnotation: this.activeAnnotation?.node_id || null,
            selectedNodeType: this.getSelectedNode()?.type || null,
            timestamp: Date.now()
        });

        return this;
    }

    /**
     * Undo the last change.
     * @returns {EditorSessionService} this
     */
    undo() {
        if (this.history_index < 0) return this;

        const change = this.history[this.history_index];
        const draft = createDocumentDraft(this.doc);

        // Apply inverse ops in reverse order
        for (let i = change.inverse_ops.length - 1; i >= 0; i--) {
            applyOpToDraft(draft, change.inverse_ops[i]);
        }

        this.doc = draft;
        this._selection = change.selection_before
            ? structuredClone(change.selection_before)
            : null;
        this.history_index = this.history_index - 1;

        // Publish document changed
        this._publish('EDITOR_DOCUMENT_CHANGED', {
            editorId: this._editorId,
            documentId: this.doc.document_id,
            ops: [],
            canUndo: this.canUndo,
            canRedo: this.canRedo,
            timestamp: Date.now()
        });

        // Publish selection changed
        this._publish('EDITOR_SELECTION_CHANGED', {
            editorId: this._editorId,
            selection: this._selection
                ? { ...this._selection, path: [...this._selection.path] }
                : null,
            availableMarkTypes: this.getAvailableMarkTypes(),
            availableAnnotationTypes: this.getAvailableAnnotationTypes(),
            activeMark: this.activeMark?.node_id || null,
            activeAnnotation: this.activeAnnotation?.node_id || null,
            selectedNodeType: this.getSelectedNode()?.type || null,
            timestamp: Date.now()
        });

        return this;
    }

    /**
     * Redo the last undone change.
     * @returns {EditorSessionService} this
     */
    redo() {
        if (this.history_index >= this.history.length - 1) return this;

        this.history_index = this.history_index + 1;
        const change = this.history[this.history_index];
        const draft = createDocumentDraft(this.doc);

        // Apply forward ops
        for (const op of change.ops) {
            applyOpToDraft(draft, op);
        }

        this.doc = draft;
        this._selection = change.selection_after
            ? structuredClone(change.selection_after)
            : null;

        // Publish document changed
        this._publish('EDITOR_DOCUMENT_CHANGED', {
            editorId: this._editorId,
            documentId: this.doc.document_id,
            ops: change.ops,
            canUndo: this.canUndo,
            canRedo: this.canRedo,
            timestamp: Date.now()
        });

        // Publish selection changed
        this._publish('EDITOR_SELECTION_CHANGED', {
            editorId: this._editorId,
            selection: this._selection
                ? { ...this._selection, path: [...this._selection.path] }
                : null,
            availableMarkTypes: this.getAvailableMarkTypes(),
            availableAnnotationTypes: this.getAvailableAnnotationTypes(),
            activeMark: this.activeMark?.node_id || null,
            activeAnnotation: this.activeAnnotation?.node_id || null,
            selectedNodeType: this.getSelectedNode()?.type || null,
            timestamp: Date.now()
        });

        return this;
    }

    // ===================================================================
    // Undo/redo state
    // ===================================================================

    get canUndo() {
        return this.history_index >= 0;
    }

    get canRedo() {
        return this.history_index < this.history.length - 1;
    }

    get historyLength() {
        return this.history.length;
    }

    get historyIndex() {
        return this.history_index;
    }

    // ===================================================================
    // Private helpers
    // ===================================================================

    /**
     * Validate a selection against the current session state.
     * @private
     */
    _validateSelection(selection) {
        if (selection === null || selection === undefined) return;
        validateSelection(selection, this);
    }

    /**
     * Validate the result of a transaction — only affected nodes.
     * @private
     */
    _validateTransactionResult(transaction) {
        const doc = transaction.doc;

        /** @type {Set<string>} */
        const affected_node_ids = new Set([
            ...transaction.created_node_ids,
            ...transaction.modified_node_ids
        ]);

        // Full referrer scan needed when deletions or type changes exist
        if (transaction.deleted_node_ids.length > 0 || transaction.changed_node_types) {
            const scan_targets = new Set([
                ...transaction.created_node_ids,
                ...transaction.modified_node_ids,
                ...transaction.deleted_node_ids
            ]);
            for (const node_id of getReferencingNodeIds(this.schema, doc, scan_targets)) {
                affected_node_ids.add(node_id);
            }
        }

        for (const node_id of affected_node_ids) {
            const node = doc.nodes[node_id];
            if (node) {
                validateNode(node, this.schema, doc.nodes);
            }
        }
    }

    /**
     * Publish an event on the EventBus (fire-and-forget).
     * @private
     */
    _publish(eventName, payload) {
        try {
            if (this.eventBus && typeof this.eventBus.publish === 'function') {
                this.eventBus.publish(eventName, payload);
            }
        } catch {
            // EventBus errors should not crash the editor
        }
    }

    // ===================================================================
    // Intent subscriptions
    // ===================================================================

    /**
     * Subscribe to EventBus intents for multi-editor coordination.
     * @private
     */
    _subscribeIntents() {
        if (this._intentUnsubscribers.length > 0) return;
        if (!this.eventBus || typeof this.eventBus.subscribe !== 'function') return;

        // INTENT_EDITOR_INIT — accepts when editorId is null (brand-new) or matches
        const unsubInit = this.eventBus.subscribe('INTENT_EDITOR_INIT', (payload) => {
            if (!payload || !payload.editorId) return;
            if (this._editorId !== null && payload.editorId !== this._editorId) return;
            this.init(payload);
        });
        this._intentUnsubscribers.push(unsubInit);

        // INTENT_EDITOR_DESTROY
        const unsubDestroy = this.eventBus.subscribe('INTENT_EDITOR_DESTROY', (payload) => {
            if (!payload || payload.editorId !== this._editorId) return;
            this.destroy();
        });
        this._intentUnsubscribers.push(unsubDestroy);

        // INTENT_EDITOR_COMMAND
        const unsubCommand = this.eventBus.subscribe('INTENT_EDITOR_COMMAND', (payload) => {
            if (!payload || payload.editorId !== this._editorId) return;
            if (!this.initialized) return;
            const { command, args } = payload;
            if (command && this._commands[command]) {
                try {
                    this._commands[command](...(args || []));
                } catch (err) {
                    this._publish('EDITOR_COMMAND_ERROR', {
                        editorId: this._editorId,
                        command,
                        error: err.message,
                        timestamp: Date.now()
                    });
                }
            }
        });
        this._intentUnsubscribers.push(unsubCommand);

        // INTENT_EDITOR_GET_STATE
        const unsubGetState = this.eventBus.subscribe('INTENT_EDITOR_GET_STATE', (payload) => {
            if (!payload || payload.editorId !== this._editorId) return;
            if (!this.initialized) {
                this._publish('EDITOR_STATE', {
                    editorId: this._editorId,
                    initialized: false,
                    timestamp: Date.now()
                });
                return;
            }
            this._publish('EDITOR_STATE', {
                editorId: this._editorId,
                initialized: true,
                documentId: this.doc?.document_id || null,
                selection: this._selection
                    ? { ...this._selection, path: [...this._selection.path] }
                    : null,
                canUndo: this.canUndo,
                canRedo: this.canRedo,
                historyLength: this.history.length,
                timestamp: Date.now()
            });
        });
        this._intentUnsubscribers.push(unsubGetState);
    }

    // ===================================================================
    // Static multi-session access
    // ===================================================================

    /**
     * Get an existing editor session by its editorId.
     * @param {string} editorId
     * @returns {EditorSessionService | undefined}
     */
    static getSession(editorId) {
        return EditorSessionService._sessions.get(editorId);
    }

    // ===================================================================
    // Command registration
    // ===================================================================

    /**
     * Register a command handler for this editor session.
     * Commands are dispatched via INTENT_EDITOR_COMMAND intents
     * or called directly via executeCommand().
     *
     * @param {string} name — command name
     * @param {Function} handlerFn — command handler, receives (...args)
     */
    registerCommand(name, handlerFn) {
        this._commands[name] = handlerFn;
    }

    /**
     * Execute a registered command by name.
     *
     * @param {string} name — command name
     * @param {...any} args — arguments forwarded to the handler
     */
    executeCommand(name, ...args) {
        if (this._commands[name]) {
            this._commands[name](...args);
        }
    }
}
