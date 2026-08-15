/**
 * AIUIOpValidate - structural validation for streaming ops in
 * AIUIComposerService.
 *
 * Extracted from AIUIComposerService.js (Phase 6 modular decomposition,
 * lane M1; see docs/plans/active/audit-fix-plan.md 6.2). Mixed onto
 * AIUIComposerService.prototype by the facade; methods run with `this`
 * bound to the service instance. Cut/paste move; no behavior changes.
 */

import { isPlainObject, KNOWN_STATE_ATTRS, MAX_TEXT_LENGTH } from './AIUIHelpers.js';

export const AIUIOpValidate = {
  _validateOpDry() {
    throw new Error('_validateOpDry is not used — validation is inline in applyOps');
  },

  _validateOp(op) {
    if (!isPlainObject(op) || typeof op.type !== 'string') {
      throw new Error('Op must be an object with a string "type"');
    }
    switch (op.type) {
      case 'mount': this._validateMountOp(op); break;
      case 'unmount': this._validateUnmountOp(op); break;
      case 'reorder': this._validateReorderOp(op); break;
      case 'clear': this._validateClearOp(op); break;
      case 'updateProps': this._validateUpdatePropsOp(op); break;
      case 'setState': this._validateSetStateOp(op); break;
      case 'setText': this._validateSetTextOp(op); break;
      default: throw new Error(`Unknown op type "${op.type}"`);
    }
  },

  _validateMountOp(op) {
    if (typeof op.id !== 'string' || op.id.trim() === '') {
      throw new Error('Mount op requires a non-empty string "id"');
    }
    if (this.liveNodes.has(op.id)) {
      throw new Error(`Instance "${op.id}" already exists`);
    }
    if (!isPlainObject(op.spec) || typeof op.spec.component !== 'string') {
      throw new Error('Mount op requires a "spec" with a "component" string');
    }
    if (!this.catalog.has(op.spec.component)) {
      throw new Error(`Unknown component "${op.spec.component}"`);
    }
    if (op.parent !== undefined) {
      if (typeof op.parent !== 'string') {
        throw new Error('Mount op "parent" must be a string');
      }
      if (!this.liveNodes.has(op.parent)) {
        throw new Error(`Parent "${op.parent}" not found`);
      }
      const parent = this.liveNodes.get(op.parent);
      if (op.slot !== undefined) {
        if (typeof op.slot !== 'string') {
          throw new Error('Mount op "slot" must be a string');
        }
        const slotDef = parent.definition.slots?.[op.slot];
        if (!slotDef) {
          throw new Error(`Unknown slot "${op.slot}" on "${parent.definition.id}"`);
        }
      }
    } else {
      // Root mount (no parent): optional "target" CSS selector for a mount point.
      if (op.target !== undefined) {
        if (typeof op.target !== 'string' || op.target.trim() === '') {
          throw new Error('Mount op "target" must be a non-empty string (CSS selector)');
        }
      }
    }
  },

  _validateUnmountOp(op) {
    if (typeof op.id !== 'string') {
      throw new Error('Unmount op requires a string "id"');
    }
    if (!this.liveNodes.has(op.id)) {
      throw new Error(`Instance "${op.id}" not found`);
    }
  },

  _validateReorderOp(op) {
    if (typeof op.parent !== 'string') throw new Error('Reorder op requires a string "parent"');
    if (typeof op.slot !== 'string') throw new Error('Reorder op requires a string "slot"');
    if (!Array.isArray(op.order) || op.order.length === 0) throw new Error('Reorder op requires a non-empty "order" array');
    const parent = this.liveNodes.get(op.parent);
    if (!parent) throw new Error(`Parent "${op.parent}" not found`);
    const slotDef = parent.definition.slots?.[op.slot];
    if (!slotDef) throw new Error(`Unknown slot "${op.slot}" on "${parent.definition.id}"`);
    const current = parent.children.get(op.slot) || [];
    if (op.order.length !== current.length) {
      throw new Error('Reorder "order" length must match current children count');
    }
    const currentIds = new Set(current.map((c) => c.id));
    for (const id of op.order) {
      if (!currentIds.has(id)) throw new Error(`Child "${id}" not found in slot "${op.slot}"`);
    }
  },

  _validateClearOp(op) {
    if (typeof op.parent !== 'string') throw new Error('Clear op requires a string "parent"');
    if (typeof op.slot !== 'string') throw new Error('Clear op requires a string "slot"');
    const parent = this.liveNodes.get(op.parent);
    if (!parent) throw new Error(`Parent "${op.parent}" not found`);
    const slotDef = parent.definition.slots?.[op.slot];
    if (!slotDef) throw new Error(`Unknown slot "${op.slot}" on "${parent.definition.id}"`);
  },

  _validateUpdatePropsOp(op) {
    if (typeof op.id !== 'string') throw new Error('updateProps op requires a string "id"');
    if (!this.liveNodes.has(op.id)) throw new Error(`Instance "${op.id}" not found`);
    if (!isPlainObject(op.props)) throw new Error('updateProps op requires a "props" object');
    const node = this.liveNodes.get(op.id);
    const allowedProps = new Set(Object.keys(node.definition.propsSchema || {}));
    const isModuleSurface = this._isModuleSurface(node.definition);
    for (const key of Object.keys(op.props)) {
      if (!allowedProps.has(key)) throw new Error(`Unknown prop "${key}" for "${node.definition.id}"`);
      const value = op.props[key];
      if (value === null || value === undefined) continue;
      if (isModuleSurface) {
        this._validateStructuredProp(key, value, node.definition.id);
        continue;
      }
      if (typeof value !== 'string') throw new Error(`Prop "${key}" must be a string`);
      if (value.length > MAX_TEXT_LENGTH) throw new Error(`Prop "${key}" exceeds max length`);
      if (/(url|href|src)$/i.test(key) && !this.isSafeUrl(value)) {
        throw new Error(`Unsafe URL rejected for prop "${key}"`);
      }
    }
  },

  _validateSetStateOp(op) {
    if (typeof op.id !== 'string') throw new Error('setState op requires a string "id"');
    if (!this.liveNodes.has(op.id)) throw new Error(`Instance "${op.id}" not found`);
    if (typeof op.attr !== 'string') throw new Error('setState op requires a string "attr"');
    const attrName = `data-${op.attr}`;
    if (!KNOWN_STATE_ATTRS.has(attrName)) throw new Error(`Unknown state attribute "${attrName}"`);
    if (typeof op.value !== 'string') throw new Error('State value must be a string');
    if (op.value.length > MAX_TEXT_LENGTH) throw new Error('State value exceeds max length');
  },

  _validateSetTextOp(op) {
    if (typeof op.id !== 'string') throw new Error('setText op requires a string "id"');
    if (!this.liveNodes.has(op.id)) throw new Error(`Instance "${op.id}" not found`);
    const node = this.liveNodes.get(op.id);
    if (!node.definition.render.textProp) {
      throw new Error(`Component "${node.definition.id}" does not support text updates`);
    }
    if (typeof op.text !== 'string') throw new Error('Text must be a string');
    if (op.text.length > MAX_TEXT_LENGTH) throw new Error('Text exceeds max length');
  },
};
