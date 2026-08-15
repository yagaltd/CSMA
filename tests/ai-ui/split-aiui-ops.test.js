/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AIUIComposerService } from '../../src/modules/ai-ui/services/AIUIComposerService.js';
import { AIUIOps } from '../../src/modules/ai-ui/services/AIUIOps.js';

/**
 * AIUIOps — live-node registry + op batching extracted from
 * AIUIComposerService.js (Phase 6 split). Full op behavior is covered by
 * ai-ui-composer-service.test.js (unchanged); this file pins the mixin
 * wiring and a batching smoke.
 */

function makeEventBus() {
  return { subscribe: () => () => {}, unsubscribe() {}, publish() {} };
}

describe('AIUIOps (split piece)', () => {
  let service;

  beforeEach(() => {
    service = new AIUIComposerService(makeEventBus());
  });

  it('is mixed onto AIUIComposerService.prototype', () => {
    expect(AIUIComposerService.prototype.applyOp).toBe(AIUIOps.applyOp);
    expect(AIUIComposerService.prototype.applyOps).toBe(AIUIOps.applyOps);
    expect(AIUIComposerService.prototype.getLiveNode).toBe(AIUIOps.getLiveNode);
    expect(AIUIComposerService.prototype.liveSnapshot).toBe(AIUIOps.liveSnapshot);
  });

  it('applyOp mounts a live node and the registry sees it', () => {
    service.applyOp({ type: 'mount', id: 'n1', spec: { component: 'card', props: { title: 'Hi' } } });
    const node = service.getLiveNode('n1');
    expect(node).toBeTruthy();
    expect(node.id).toBe('n1');
    expect(node.element.getAttribute('data-aiui-id')).toBe('n1');
    expect(service.liveSnapshot()).toHaveLength(1);
  });

  it('applyOps applies a batch with parent/child ordering', () => {
    service.applyOps([
      { type: 'mount', id: 'root-card', spec: { component: 'card', props: { title: 'Root' } } },
      { type: 'mount', id: 'child-card', parent: 'root-card', slot: 'body', spec: { component: 'button', props: { label: 'Child' } } }
    ]);
    expect(service.getLiveNode('child-card').parentId).toBe('root-card');
    expect(service.liveSnapshot()).toHaveLength(2);
    service.applyOps([
      { type: 'clear', parent: 'root-card', slot: 'body' },
      { type: 'unmount', id: 'root-card' }
    ]);
    expect(service.liveSnapshot()).toHaveLength(0);
  });
});
