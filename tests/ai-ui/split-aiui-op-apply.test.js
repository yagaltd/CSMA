/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AIUIComposerService } from '../../src/modules/ai-ui/services/AIUIComposerService.js';
import { AIUIOpApply } from '../../src/modules/ai-ui/services/AIUIOpApply.js';

/**
 * AIUIOpApply — op application extracted from AIUIComposerService.js
 * (Phase 6 split). This file pins the mixin wiring and mutate/cleanup smoke.
 */

function makeEventBus() {
  return { subscribe: () => () => {}, unsubscribe() {}, publish() {} };
}

describe('AIUIOpApply (split piece)', () => {
  let service;

  beforeEach(() => {
    service = new AIUIComposerService(makeEventBus());
  });

  it('is mixed onto AIUIComposerService.prototype', () => {
    expect(AIUIComposerService.prototype._applyMount).toBe(AIUIOpApply._applyMount);
    expect(AIUIComposerService.prototype._applyUnmount).toBe(AIUIOpApply._applyUnmount);
    expect(AIUIComposerService.prototype._applyReorder).toBe(AIUIOpApply._applyReorder);
    expect(AIUIComposerService.prototype._applyClear).toBe(AIUIOpApply._applyClear);
    expect(AIUIComposerService.prototype._applyUpdateProps).toBe(AIUIOpApply._applyUpdateProps);
    expect(AIUIComposerService.prototype._applySetState).toBe(AIUIOpApply._applySetState);
    expect(AIUIComposerService.prototype._applySetText).toBe(AIUIOpApply._applySetText);
  });

  it('setState/setText/updateProps mutate the live element', () => {
    service.applyOp({ type: 'mount', id: 'n1', spec: { component: 'button', props: { label: 'Go' } } });
    service.applyOp({ type: 'setState', id: 'n1', attr: 'disabled', value: 'true' });
    expect(service.getLiveNode('n1').element.getAttribute('data-disabled')).toBe('true');
    service.applyOp({ type: 'setText', id: 'n1', text: 'Stop' });
    expect(service.getLiveNode('n1').element.textContent).toBe('Stop');
    service.applyOp({ type: 'updateProps', id: 'n1', props: { label: 'Changed' } });
    expect(service.getLiveNode('n1').props.label).toBe('Changed');
  });

  it('unmount detaches the element from the document', () => {
    service.applyOp({ type: 'mount', id: 'n1', target: 'body', spec: { component: 'card', props: { title: 'T' } } });
    const el = service.getLiveNode('n1').element;
    expect(document.body.contains(el)).toBe(true);
    service.applyOp({ type: 'unmount', id: 'n1' });
    expect(document.body.contains(el)).toBe(false);
    expect(service.getLiveNode('n1')).toBeNull();
  });
});
