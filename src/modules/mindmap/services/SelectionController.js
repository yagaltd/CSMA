/**
 * SelectionController — manages node selection and inline editing on a
 * mindmap canvas.
 *
 * Phase 10 of the mindmap module (CSMA). Standalone class; imported by
 * the demo page or renderer.
 *
 * Contract: .wave1-contract.md §Phase 10.
 *
 * Events published (when eventBus is available):
 *   MINDMAP_NODE_SELECTED     → { mapId, nodeId }
 *   MINDMAP_NODES_SELECTED    → { mapId, nodeIds: string[] }
 *   MINDMAP_SELECTION_CLEARED → { mapId }
 *   MINDMAP_NODE_EDIT_START   → { mapId, nodeId }
 *   MINDMAP_NODE_EDIT_END     → { mapId, nodeId, committed: boolean }
 */

const EDIT_ELEMENT_CLASS = 'mindmap-inline-edit';

export class SelectionController {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container — the canvas element receiving events
   * @param {HTMLElement} opts.nodeLayer — the div containing branch-node / leaf-node elements
   * @param {function(string):void} [opts.onSelect] — called with nodeId on single select
   * @param {function(string[]):void} [opts.onMultiSelect] — called with nodeIds on multi-select change
   * @param {function(string, string):Promise<void>} [opts.onEditCommit] — called with (nodeId, newTopic)
   * @param {object} [opts.eventBus] — EventBus for publishing events
   * @param {string} [opts.mapId] — current map id
   */
  constructor({
    container,
    nodeLayer,
    onSelect,
    onMultiSelect,
    onEditCommit,
    eventBus,
    mapId
  }) {
    this._container = container;
    this._nodeLayer = nodeLayer;
    this._onSelect = onSelect || (() => {});
    this._onMultiSelect = onMultiSelect || (() => {});
    this._onEditCommit = onEditCommit || (async () => {});
    this._eventBus = eventBus || null;
    this._mapId = mapId || null;

    /** @type {Set<string>} */
    this._selected = new Set();

    /** @type {string|null} */
    this._editingNodeId = null;

    /** @type {HTMLElement|null} */
    this._editEl = null;

    /** @type {string} */
    this._editOriginalText = '';

    // Bound handlers for cleanup
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onDblClick = this._handleDblClick.bind(this);

    // Double-click detection state
    this._lastClickTime = 0;
    this._lastClickTarget = null;
    this._lastClickNodeId = null;
    this._doubleClickThreshold = 350; // ms

    // Attach events
    this._container.addEventListener('pointerdown', this._onPointerDown);
    this._container.addEventListener('pointerup', this._onPointerUp);
    this._container.addEventListener('dblclick', this._onDblClick);
  }

  // ─── Public API ────────────────────────────────────────────────────

  /** @returns {string[]} */
  get selectedIds() {
    return Array.from(this._selected);
  }

  /** @returns {boolean} */
  get isEditing() {
    return this._editingNodeId !== null;
  }

  /** @returns {string|null} */
  get editingNodeId() {
    return this._editingNodeId;
  }

  /**
   * Clear the current selection (no event fired).
   */
  clearSelection() {
    if (this._selected.size === 0) return;
    for (const id of this._selected) {
      this._removeVisualSelection(id);
    }
    this._selected.clear();
  }

  /**
   * Select a single node, replacing current selection.
   * @param {string} nodeId
   */
  selectNode(nodeId) {
    this.clearSelection();
    this._addToSelection(nodeId);
    if (this._onSelect) this._onSelect(nodeId);
    this._publish('MINDMAP_NODE_SELECTED', { mapId: this._mapId, nodeId });
  }

  /**
   * Replace selection with a set of node IDs.
   * @param {string[]} nodeIds
   */
  selectNodes(nodeIds) {
    this.clearSelection();
    for (const id of nodeIds) {
      this._addToSelection(id);
    }
    if (this._onMultiSelect) this._onMultiSelect(nodeIds);
    this._publish('MINDMAP_NODES_SELECTED', { mapId: this._mapId, nodeIds: [...nodeIds] });
  }

  /**
   * Add a node to the current selection (multi-select).
   * @param {string} nodeId
   */
  addToSelection(nodeId) {
    if (this._selected.has(nodeId)) return;
    this._addToSelection(nodeId);
    this._publish('MINDMAP_NODES_SELECTED', { mapId: this._mapId, nodeIds: this.selectedIds });
  }

  /**
   * Remove a node from the current selection.
   * @param {string} nodeId
   */
  removeFromSelection(nodeId) {
    if (!this._selected.has(nodeId)) return;
    this._removeVisualSelection(nodeId);
    this._selected.delete(nodeId);
    this._publish('MINDMAP_NODES_SELECTED', { mapId: this._mapId, nodeIds: this.selectedIds });
  }

  /**
   * Start inline-edit mode for the given node.
   * Replaces the node's text content with a contentEditable element.
   * @param {string} nodeId
   */
  beginEdit(nodeId) {
    if (this._editingNodeId === nodeId) return;
    // Commit any in-progress edit first
    if (this._editingNodeId) {
      this.cancelEdit();
    }

    const el = this._findNodeElement(nodeId);
    if (!el) return;

    this._editingNodeId = nodeId;
    this._editOriginalText = el.textContent || '';

    // Find the topic element inside the node
    const topicEl = el.querySelector('.branch-node__topic, .leaf-node__topic');
    const targetEl = topicEl || el;

    // Save original display
    this._editOriginalDisplay = targetEl.style.display;

    // Create edit element
    const editEl = document.createElement('div');
    editEl.className = EDIT_ELEMENT_CLASS;
    editEl.contentEditable = 'true';
    editEl.textContent = this._editOriginalText;
    // Style minimally — design tokens + necessary overrides
    editEl.style.cssText = 'outline:none;min-width:4rem;padding:2px 4px;border-bottom:2px solid var(--accent,#4f90f2);font:inherit;color:inherit;background:transparent;';

    // Replace content
    targetEl.style.display = 'none';
    targetEl.insertAdjacentElement('afterend', editEl);

    this._editEl = editEl;
    this._editTargetEl = targetEl;

    // Focus and select all
    editEl.focus();
    this._selectAll(editEl);

    // Listen for key events on the edit element
    editEl.addEventListener('keydown', this._handleEditKeyDown);
    editEl.addEventListener('blur', this._handleEditBlur);

    this._publish('MINDMAP_NODE_EDIT_START', { mapId: this._mapId, nodeId });
  }

  /**
   * Commit the inline edit — calls onEditCommit with the new text.
   * Does nothing if not editing.
   */
  async commitEdit() {
    if (!this._editingNodeId) return;
    const newText = (this._editEl?.textContent || '').trim() || this._editOriginalText;
    const nodeId = this._editingNodeId;

    await this._onEditCommit(nodeId, newText);
    this._finishEdit(true);
    this._publish('MINDMAP_NODE_EDIT_END', { mapId: this._mapId, nodeId, committed: true });
  }

  /**
   * Cancel inline edit and restore original text.
   */
  cancelEdit() {
    if (!this._editingNodeId) return;
    const nodeId = this._editingNodeId;
    this._finishEdit(false);
    this._publish('MINDMAP_NODE_EDIT_END', { mapId: this._mapId, nodeId, committed: false });
  }

  /**
   * Destroy — remove event listeners and clean up.
   */
  destroy() {
    this._container.removeEventListener('pointerdown', this._onPointerDown);
    this._container.removeEventListener('pointerup', this._onPointerUp);
    this._container.removeEventListener('dblclick', this._onDblClick);
    if (this._editingNodeId) {
      this._finishEdit(false);
    }
    this.clearSelection();
    this._container = null;
    this._nodeLayer = null;
    this._onSelect = null;
    this._onMultiSelect = null;
    this._onEditCommit = null;
    this._eventBus = null;
  }

  // ─── Private: event handlers ───────────────────────────────────────

  /**
   * @param {PointerEvent} e
   */
  _handlePointerDown(e) {
    // Ignore if we are editing
    if (this._editingNodeId) return;

    const target = /** @type {HTMLElement} */ (e.target);
    const nodeEl = target.closest('[data-node-id]');

    if (nodeEl) {
      const nodeId = nodeEl.dataset.nodeId;
      if (!nodeId) return;

      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (ctrlOrMeta) {
        // Toggle selection
        if (this._selected.has(nodeId)) {
          this.removeFromSelection(nodeId);
        } else {
          this.addToSelection(nodeId);
        }
      } else if (!this._selected.has(nodeId)) {
        // Replace selection with this single node
        this.selectNode(nodeId);
      }
      // If already selected (and no ctrl), keep selection — drag may follow
    }
  }

  /**
   * @param {PointerEvent} e
   */
  _handlePointerUp(e) {
    // Detect double-click via time threshold
    if (this._editingNodeId) return;

    const target = /** @type {HTMLElement} */ (e.target);
    const nodeEl = target.closest('[data-node-id]');

    if (!nodeEl) {
      // Click on empty canvas → clear selection
      // But not if it was a drag (handled by pointer-move check in ViewportController)
      // We can't know here if pointer moved, so we use a small delay to let
      // the parent decide. For now, clear on next microtask only if pointer
      // didn't move significantly.
      const canvasClick = target.closest('.canvas') === this._container || this._container.contains(target);
      if (canvasClick && !nodeEl) {
        // Defer to let drag detection cancel this
        this._pendingCanvasClick = true;
        requestAnimationFrame(() => {
          if (this._pendingCanvasClick) {
            this.clearSelection();
            this._publish('MINDMAP_SELECTION_CLEARED', { mapId: this._mapId });
          }
          this._pendingCanvasClick = false;
        });
      }
    }
  }

  /**
   * Cancel pending canvas click (called by ViewportController on drag).
   */
  cancelCanvasClick() {
    this._pendingCanvasClick = false;
  }

  /**
   * @param {MouseEvent} e
   */
  _handleDblClick(e) {
    const target = /** @type {HTMLElement} */ (e.target);
    const nodeEl = target.closest('[data-node-id]');
    if (!nodeEl || !nodeEl.dataset.nodeId) return;

    const nodeId = nodeEl.dataset.nodeId;
    // Select then edit
    if (!this._selected.has(nodeId)) {
      this.selectNode(nodeId);
    }
    this.beginEdit(nodeId);
    e.preventDefault();
    e.stopPropagation();
  }

  // ─── Private: edit key/blur handlers ───────────────────────────────

  /**
   * @param {KeyboardEvent} e
   */
  _handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelEdit();
    }
    // Shift+Enter = newline (default contentEditable behaviour)
  };

  _handleEditBlur = () => {
    // Small delay so Enter keydown fires before blur
    setTimeout(() => {
      if (this._editingNodeId) {
        this.commitEdit();
      }
    }, 50);
  };

  // ─── Private: helpers ──────────────────────────────────────────────

  /**
   * @param {string} nodeId
   * @returns {HTMLElement|null}
   */
  _findNodeElement(nodeId) {
    return this._nodeLayer.querySelector(`[data-node-id="${nodeId}"]`);
  }

  /**
   * @param {string} nodeId
   */
  _addToSelection(nodeId) {
    if (this._selected.has(nodeId)) return;
    this._selected.add(nodeId);
    const el = this._findNodeElement(nodeId);
    if (el) {
      el.setAttribute('data-selected', '');
    }
  }

  /**
   * @param {string} nodeId
   */
  _removeVisualSelection(nodeId) {
    const el = this._findNodeElement(nodeId);
    if (el) {
      el.removeAttribute('data-selected');
    }
  }

  /**
   * @param {boolean} committed
   */
  _finishEdit(committed) {
    if (this._editEl) {
      this._editEl.removeEventListener('keydown', this._handleEditKeyDown);
      this._editEl.removeEventListener('blur', this._handleEditBlur);
      this._editEl.remove();
      this._editEl = null;
    }
    if (this._editTargetEl) {
      this._editTargetEl.style.display = this._editOriginalDisplay || '';
      this._editTargetEl = null;
    }
    this._editingNodeId = null;
    this._editOriginalText = '';
  }

  /**
   * @param {HTMLElement} el
   */
  _selectAll(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /**
   * @param {string} eventName
   * @param {object} payload
   */
  _publish(eventName, payload) {
    if (!this._eventBus) return;
    try {
      this._eventBus.publish(eventName, payload);
    } catch {
      // EventBus may reject if contracts are strict; try sync fallback
      if (typeof this._eventBus.publishSync === 'function') {
        try { this._eventBus.publishSync(eventName, payload); } catch { /* swallow */ }
      }
    }
  }

  /** @type {boolean} */
  _pendingCanvasClick = false;

  /** @type {HTMLElement|null} */
  _editTargetEl = null;

  /** @type {string} */
  _editOriginalDisplay = '';
}
