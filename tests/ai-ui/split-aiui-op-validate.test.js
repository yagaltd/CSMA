/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AIUIComposerService } from '../../src/modules/ai-ui/services/AIUIComposerService.js';
import { AIUIOpValidate } from '../../src/modules/ai-ui/services/AIUIOpValidate.js';

/**
 * AIUIOpValidate — op validation extracted from AIUIComposerService.js
 * (Phase 6 split). Validation detail coverage lives in
 * ai-ui-composer-service.test.js (unchanged); this file pins the mixin
 * wiring and rejection smoke.
 */

function makeEventBus() {
  return { subscribe: () => () => {}, unsubscribe() {}, publish() {} };
}

describe('AIUIOpValidate (split piece)', () => {
  let service;

  beforeEach(() => {
    service = new AIUIComposerService(makeEventBus());
  });

  it('is mixed onto AIUIComposerService.prototype', () => {
    expect(AIUIComposerService.prototype._validateOp).toBe(AIUIOpValidate._validateOp);
    expect(AIUIComposerService.prototype._validateMountOp).toBe(AIUIOpValidate._validateMountOp);
    expect(AIUIComposerService.prototype._validateUnmountOp).toBe(AIUIOpValidate._validateUnmountOp);
    expect(AIUIComposerService.prototype._validateReorderOp).toBe(AIUIOpValidate._validateReorderOp);
    expect(AIUIComposerService.prototype._validateClearOp).toBe(AIUIOpValidate._validateClearOp);
    expect(AIUIComposerService.prototype._validateUpdatePropsOp).toBe(AIUIOpValidate._validateUpdatePropsOp);
    expect(AIUIComposerService.prototype._validateSetStateOp).toBe(AIUIOpValidate._validateSetStateOp);
    expect(AIUIComposerService.prototype._validateSetTextOp).toBe(AIUIOpValidate._validateSetTextOp);
  });

  it('rejects unknown op types', () => {
    expect(() => service.applyOp({ type: 'explode' })).toThrow(/Unknown op type/);
  });

  it('rejects malformed mounts through the validate path', () => {
    expect(() => service.applyOp({ type: 'mount' })).toThrow(/non-empty string "id"/);
    expect(() => service.applyOp({ type: 'mount', id: 'x', spec: { component: 'missing' } })).toThrow(/Unknown component/);
  });

  it('rejects ops against unknown live nodes', () => {
    expect(() => service.applyOp({ type: 'unmount', id: 'ghost' })).toThrow(/not found/);
    expect(() => service.applyOp({ type: 'setState', id: 'ghost', attr: 'state', value: 'x' })).toThrow(/not found/);
  });
});
