/**
 * AIUIOps - live-node registry access and streaming op application/batching
 * for AIUIComposerService.
 *
 * Extracted from AIUIComposerService.js (Phase 6 modular decomposition,
 * lane M1; see docs/plans/active/audit-fix-plan.md 6.2). Mixed onto
 * AIUIComposerService.prototype by the facade; methods run with `this`
 * bound to the service instance. Cut/paste move; no behavior changes.
 */

import { isPlainObject, KNOWN_STATE_ATTRS } from './AIUIHelpers.js';

export const AIUIOps = {
  // ────────────────────────────────────────────────────────────────
  // Live node registry — streaming composition via ops
  // ────────────────────────────────────────────────────────────────

  getLiveNode(id) {
    const node = this.liveNodes.get(id);
    if (!node) return null;
    return {
      id: node.id,
      element: node.element,
      props: { ...node.props },
      parentId: node.parentId,
      slot: node.slot,
      children: node.children
    };
  },

  liveSnapshot() {
    return [...this.liveNodes.entries()].map(([, node]) => ({
      id: node.id,
      component: node.definition.id,
      props: { ...node.props },
      parentId: node.parentId,
      slot: node.slot,
      children: [...node.children.entries()].map(([slot, children]) => ({
        slot,
        children: children.map((c) => c.id)
      }))
    }));
  },

  applyOp(op, { documentRef = globalThis.document } = {}) {
    this._validateOp(op);
    switch (op.type) {
      case 'mount': return this._applyMount(op, { documentRef });
      case 'unmount': return this._applyUnmount(op);
      case 'reorder': return this._applyReorder(op);
      case 'clear': return this._applyClear(op);
      case 'updateProps': return this._applyUpdateProps(op);
      case 'setState': return this._applySetState(op);
      case 'setText': return this._applySetText(op);
      default: throw new Error(`Unknown op type "${op.type}"`);
    }
  },

  applyOps(ops, { documentRef = globalThis.document } = {}) {
    // Pre-flight: validate all ops with awareness of pending mounts
    const pendingIds = new Set();
    const pendingParents = new Map(); // id → { definition },
    for (let i = 0; i < ops.length; i++) {
      try {
        const op = ops[i];
        if (op.type === 'mount') {
          if (typeof op.id !== 'string' || op.id.trim() === '') {
            throw new Error('Mount op requires a non-empty string "id"');
          }
          if (this.liveNodes.has(op.id) || pendingIds.has(op.id)) {
            throw new Error(`duplicate mount id "${op.id}" in batch`);
          }
          if (!isPlainObject(op.spec) || typeof op.spec.component !== 'string') {
            throw new Error('Mount op requires a "spec" with a "component" string');
          }
          if (!this.catalog.has(op.spec.component)) {
            throw new Error(`Unknown component "${op.spec.component}"`);
          }
          pendingIds.add(op.id);
          pendingParents.set(op.id, { definition: this.catalog.get(op.spec.component) });
          if (op.parent !== undefined) {
            if (typeof op.parent !== 'string') throw new Error('"parent" must be a string');
            if (!this.liveNodes.has(op.parent) && !pendingIds.has(op.parent)) {
              throw new Error(`Parent "${op.parent}" not found`);
            }
            if (op.slot !== undefined) {
              if (typeof op.slot !== 'string') throw new Error('"slot" must be a string');
              const parentDef = this.liveNodes.has(op.parent)
                ? this.liveNodes.get(op.parent).definition
                : pendingParents.get(op.parent)?.definition;
              if (parentDef && !parentDef.slots?.[op.slot]) {
                throw new Error(`Unknown slot "${op.slot}" on "${parentDef.id}"`);
              }
            }
          }
        } else if (op.type === 'unmount') {
          if (typeof op.id !== 'string') throw new Error('Requires a string "id"');
          if (!this.liveNodes.has(op.id) && !pendingIds.has(op.id)) {
            throw new Error(`Instance "${op.id}" not found`);
          }
          pendingIds.delete(op.id);
        } else if (op.type === 'setState') {
          if (typeof op.id !== 'string') throw new Error('Requires a string "id"');
          if (!this.liveNodes.has(op.id) && !pendingIds.has(op.id)) {
            throw new Error(`Instance "${op.id}" not found`);
          }
          if (typeof op.attr !== 'string') throw new Error('Requires a string "attr"');
          const attrName = `data-${op.attr}`;
          if (!KNOWN_STATE_ATTRS.has(attrName)) throw new Error(`Unknown state attribute "${attrName}"`);
          if (typeof op.value !== 'string') throw new Error('Value must be a string');
        } else if (op.type === 'updateProps') {
          if (typeof op.id !== 'string') throw new Error('Requires a string "id"');
          if (!this.liveNodes.has(op.id) && !pendingIds.has(op.id)) {
            throw new Error(`Instance "${op.id}" not found`);
          }
        } else if (op.type === 'setText') {
          if (typeof op.id !== 'string') throw new Error('Requires a string "id"');
          if (!this.liveNodes.has(op.id) && !pendingIds.has(op.id)) {
            throw new Error(`Instance "${op.id}" not found`);
          }
        } else if (op.type === 'reorder' || op.type === 'clear') {
          if (typeof op.parent !== 'string') throw new Error('Requires a string "parent"');
          if (!this.liveNodes.has(op.parent) && !pendingIds.has(op.parent)) {
            throw new Error(`Parent "${op.parent}" not found`);
          }
          if (typeof op.slot !== 'string') throw new Error('Requires a string "slot"');
        } else {
          throw new Error(`Unknown op type "${op.type}"`);
        }
      } catch (err) {
        throw new Error(`Op ${i} failed validation: ${err.message}`);
      }
    }

    // All valid — apply in sequence
    const results = [];
    for (const op of ops) {
      const result = this.applyOp(op, { documentRef });
      if (result !== undefined) results.push(result);
    }
    return results;
  },
};
