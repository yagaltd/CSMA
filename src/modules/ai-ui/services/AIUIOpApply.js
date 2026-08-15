/**
 * AIUIOpApply - op application (mount/unmount/reorder/clear/props/state/text)
 * for AIUIComposerService.
 *
 * Extracted from AIUIComposerService.js (Phase 6 modular decomposition,
 * lane M1; see docs/plans/active/audit-fix-plan.md 6.2). Mixed onto
 * AIUIComposerService.prototype by the facade; methods run with `this`
 * bound to the service instance. Cut/paste move; no behavior changes.
 */

export const AIUIOpApply = {
  // ── Op application ──────────────────────────────────────────────

  _applyMount(op, { documentRef }) {
    const normalized = this.normalizeSpec(op.spec);
    const element = this.renderNode(normalized, { documentRef, depth: 0, parent: null });
    element.setAttribute('data-aiui-id', op.id);

    const definition = this.catalog.get(op.spec.component);
    const liveNode = {
      id: op.id,
      definition,
      element,
      props: { ...(op.spec.props || {}) },
      parentId: op.parent || null,
      slot: op.slot || null,
      children: new Map(),
      surfaceCleanup: typeof element.__aiuiSurfaceCleanup === 'function' ? element.__aiuiSurfaceCleanup : null
    };

    if (op.parent && op.slot) {
      const parentNode = this.liveNodes.get(op.parent);
      const slotContainer = parentNode.element.querySelector(
        parentNode.definition.slots[op.slot]?.selector || ':root'
      );
      if (!slotContainer) throw new Error(`Slot container for "${op.slot}" not found`);
      slotContainer.append(element);
      if (!parentNode.children.has(op.slot)) parentNode.children.set(op.slot, []);
      parentNode.children.get(op.slot).push(liveNode);
    } else if (op.target) {
      // Root mount with a mount-point target: attach to a DOM anchor.
      const anchor = documentRef.querySelector(op.target);
      if (!anchor) {
        throw new Error(`Mount target "${op.target}" not found in document`);
      }
      anchor.append(element);
    }

    this.liveNodes.set(op.id, liveNode);

    // Register nested children that carry optional id hints
    this._registerNestedIds(normalized, element, { parentId: op.id, parentSlot: null });

    return liveNode;
  },

  /**
   * Walk a normalized spec tree and register any nested nodes that have an `id`.
   * Maps each nested id to the corresponding rendered DOM element inside the root.
   *
   * @param {Object} normalized - Normalized spec (from normalizeSpec)
   * @param {HTMLElement} rootEl - The rendered root element
   * @param {Object} ctx - { parentId, parentSlot }
   */
    _registerNestedIds(normalized, rootEl, { parentId, parentSlot }) {
    const slots = normalized.slots || {};
    for (const [slotName, children] of Object.entries(slots)) {
      for (const childSpec of children) {
        if (!childSpec.id) continue;

        // Check for duplicate — root id or already-registered
        if (this.liveNodes.has(childSpec.id)) {
          throw new Error(`Nested id "${childSpec.id}" already exists`);
        }

        // Find the rendered element for this child inside rootEl
        const childDef = this.catalog.get(childSpec.component);
        if (!childDef) continue;

        // Query by the component's className to locate the child element
        const childEl = this._findChildElement(rootEl, childDef, childSpec);
        if (!childEl) continue;

        childEl.setAttribute('data-aiui-id', childSpec.id);

        const childLiveNode = {
          id: childSpec.id,
          definition: childDef,
          element: childEl,
          props: { ...childSpec.props },
          parentId,
          slot: parentSlot || slotName,
          children: new Map()
        };

        // Add to parent's children map
        const parentNode = this.liveNodes.get(parentId);
        if (parentNode) {
          const effectiveSlot = parentSlot || slotName;
          if (!parentNode.children.has(effectiveSlot)) parentNode.children.set(effectiveSlot, []);
          parentNode.children.get(effectiveSlot).push(childLiveNode);
        }

        this.liveNodes.set(childSpec.id, childLiveNode);

        // Recurse into this child's nested slots
        this._registerNestedIds(childSpec, childEl, { parentId: childSpec.id, parentSlot: null });
      }
    }
  },

  /**
   * Find the rendered DOM element for a child spec inside a parent element.
   * Uses the component's render.className to locate it.
   */
  _findChildElement(parentEl, definition, spec) {
    const className = definition.render?.className;
    if (!className) return null;

    // Find all matching elements inside parent
    const candidates = parentEl.querySelectorAll('.' + className.split(' ').join('.'));
    // Return the first one that isn't already claimed by another live node
    for (const el of candidates) {
      // Check if this element is already claimed (has data-aiui-id from another registration)
      const existingId = el.getAttribute('data-aiui-id');
      if (existingId && this.liveNodes.has(existingId)) continue;
      return el;
    }
    return null;
  },

  _applyUnmount(op) {
    this._unmountRecursive(op.id);
  },

  _applyReorder(op) {
    const parentNode = this.liveNodes.get(op.parent);
    const slotDef = parentNode.definition.slots[op.slot];
    const slotChildren = parentNode.children.get(op.slot);
    const slotContainer = parentNode.element.querySelector(slotDef.selector || ':root');
    for (const id of op.order) {
      const childNode = slotChildren.find((c) => c.id === id);
      slotContainer.append(childNode.element);
    }
    slotChildren.sort((a, b) => op.order.indexOf(a.id) - op.order.indexOf(b.id));
  },

  _applyClear(op) {
    const parentNode = this.liveNodes.get(op.parent);
    const slotChildren = parentNode.children.get(op.slot) || [];
    for (const child of [...slotChildren]) {
      this._unmountRecursive(child.id);
    }
  },

  _applyUpdateProps(op) {
    const node = this.liveNodes.get(op.id);
    this.applyAttributes(node.element, node.definition.render.attributes || {}, op.props);
    // If any updated prop is the textProp, update textContent
    if (node.definition.render.textProp && op.props[node.definition.render.textProp] !== undefined) {
      node.element.textContent = op.props[node.definition.render.textProp];
    }
    Object.assign(node.props, op.props);
  },

  _applySetState(op) {
    const node = this.liveNodes.get(op.id);
    node.element.setAttribute(`data-${op.attr}`, op.value);
  },

  _applySetText(op) {
    const node = this.liveNodes.get(op.id);
    node.element.textContent = op.text;
    node.props[node.definition.render.textProp] = op.text;
  },
};
