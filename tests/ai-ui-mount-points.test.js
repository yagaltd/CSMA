import { describe, expect, it, beforeEach } from 'vitest';

import EventBus from '../src/runtime/EventBus.js';
import { AIUIComposerService } from '../src/modules/ai-ui/services/AIUIComposerService.js';

function createService() {
  return new AIUIComposerService(new EventBus());
}

function createMountPoint(name) {
  const mount = document.createElement('div');
  mount.dataset.mount = name;
  return mount;
}

function createDocument() {
  document.body.replaceChildren();
  const app = document.createElement('div');
  app.id = 'app';
  app.appendChild(createMountPoint('ai-results'));
  document.body.appendChild(app);
  return document;
}

describe('AI UI — mount points (root target)', () => {
  beforeEach(() => {
    createDocument();
  });

  it('mounts a root component into a mount-point target', () => {
    const service = createService();

    const liveNode = service.applyOp({
      type: 'mount',
      id: 'results',
      target: '[data-mount="ai-results"]',
      spec: { component: 'card', props: { title: 'Live Results' } }
    }, { documentRef: document });

    // The card element should now be inside the mount-point anchor
    const anchor = document.querySelector('[data-mount="ai-results"]');
    const card = anchor.querySelector('.card');
    expect(card).toBeTruthy();
    expect(card.querySelector('.card__title').textContent).toBe('Live Results');
    expect(card.getAttribute('data-aiui-id')).toBe('results');
  });

  it('throws when target selector is not found in document', () => {
    const service = createService();

    expect(() => {
      service.applyOp({
        type: 'mount',
        id: 'results',
        target: '[data-mount="nonexistent"]',
        spec: { component: 'card', props: { title: 'Ghost' } }
      }, { documentRef: document });
    }).toThrow('not found in document');
  });

  it('validates target must be a non-empty string', () => {
    const service = createService();

    expect(() => {
      service.applyOp({
        type: 'mount',
        id: 'results',
        target: '  ',
        spec: { component: 'card', props: { title: 'T' } }
      }, { documentRef: document });
    }).toThrow('non-empty string');
  });

  it('allows root mount without target (orphaned element, backward compat)', () => {
    const service = createService();

    const liveNode = service.applyOp({
      type: 'mount',
      id: 'orphan',
      spec: { component: 'card', props: { title: 'Floating' } }
    }, { documentRef: document });

    // Element exists but is not attached to the document
    expect(liveNode.element).toBeTruthy();
    expect(liveNode.element.getAttribute('data-aiui-id')).toBe('orphan');
    expect(document.querySelector('[data-aiui-id="orphan"]')).toBeNull();
  });

  it('mounts children into a targeted root via slots', () => {
    const service = createService();

    // Root mount into target
    service.applyOp({
      type: 'mount',
      id: 'results',
      target: '[data-mount="ai-results"]',
      spec: { component: 'card', props: { title: 'Streaming' } }
    }, { documentRef: document });

    // Child mount into the root's body slot
    service.applyOp({
      type: 'mount',
      id: 'stat-1',
      parent: 'results',
      slot: 'body',
      spec: { component: 'badge', props: { label: '42%', variant: 'soft-success' } }
    }, { documentRef: document });

    // Both should be visible in the DOM
    const anchor = document.querySelector('[data-mount="ai-results"]');
    const badge = anchor.querySelector('.badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('42%');
  });

  it('supports multiple mount points in the same document', () => {
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    app.appendChild(createMountPoint('ai-chat'));
    app.appendChild(createMountPoint('ai-sidebar'));
    document.body.appendChild(app);

    const service = createService();

    service.applyOp({
      type: 'mount',
      id: 'chat',
      target: '[data-mount="ai-chat"]',
      spec: { component: 'card', props: { title: 'Chat' } }
    }, { documentRef: document });

    service.applyOp({
      type: 'mount',
      id: 'sidebar',
      target: '[data-mount="ai-sidebar"]',
      spec: { component: 'card', props: { title: 'Sidebar' } }
    }, { documentRef: document });

    expect(document.querySelector('[data-mount="ai-chat"] .card__title').textContent).toBe('Chat');
    expect(document.querySelector('[data-mount="ai-sidebar"] .card__title').textContent).toBe('Sidebar');
  });

  it('unmounts a targeted root and removes it from the DOM', () => {
    const service = createService();

    service.applyOp({
      type: 'mount',
      id: 'results',
      target: '[data-mount="ai-results"]',
      spec: { component: 'card', props: { title: 'Temporary' } }
    }, { documentRef: document });

    expect(document.querySelector('[data-mount="ai-results"] .card')).toBeTruthy();

    service.applyOp({ type: 'unmount', id: 'results' });

    expect(document.querySelector('[data-mount="ai-results"] .card')).toBeNull();
  });

  it('works in applyOps batch with target', () => {
    const service = createService();

    service.applyOps([
      {
        type: 'mount',
        id: 'results',
        target: '[data-mount="ai-results"]',
        spec: { component: 'card', props: { title: 'Batch' } }
      },
      {
        type: 'mount',
        id: 'badge-1',
        parent: 'results',
        slot: 'body',
        spec: { component: 'badge', props: { label: 'Done' } }
      },
      { type: 'setState', id: 'results', attr: 'state', value: 'ready' }
    ], { documentRef: document });

    const anchor = document.querySelector('[data-mount="ai-results"]');
    expect(anchor.querySelector('.card__title').textContent).toBe('Batch');
    expect(anchor.querySelector('.badge').textContent).toBe('Done');
    expect(anchor.querySelector('.card').getAttribute('data-state')).toBe('ready');
  });
});
