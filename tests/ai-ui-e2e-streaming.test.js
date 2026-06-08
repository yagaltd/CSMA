import { describe, expect, it } from 'vitest';

import EventBus from '../src/runtime/EventBus.js';
import { AIUIComposerService } from '../src/modules/ai-ui/services/AIUIComposerService.js';

function createService() {
  return new AIUIComposerService(new EventBus());
}

describe('AI UI — streaming composition (E2E)', () => {
  it('streams a loading → partial → complete flow via ops', () => {
    const service = createService();

    // Step 1: mount skeleton in loading state
    service.applyOp({
      type: 'mount', id: 'results',
      spec: { component: 'card', props: { title: 'Analyzing data…' } }
    }, { documentRef: document });
    service.applyOp({ type: 'setState', id: 'results', attr: 'state', value: 'loading' });

    const cardEl = service.getLiveNode('results').element;
    expect(cardEl.getAttribute('data-state')).toBe('loading');
    expect(cardEl.querySelector('.card__title').textContent).toBe('Analyzing data…');

    // Step 2: AI produces first partial result
    service.applyOp({
      type: 'mount', id: 'stat-1',
      parent: 'results', slot: 'body',
      spec: { component: 'badge', props: { label: 'Processing…', variant: 'soft-info' } }
    }, { documentRef: document });

    expect(service.getLiveNode('results')
      .element.querySelector('.card__body .badge').textContent).toBe('Processing…');

    // Step 3: Transition to ready, update the badge
    service.applyOp({ type: 'setState', id: 'results', attr: 'state', value: 'ready' });
    service.applyOp({ type: 'updateProps', id: 'stat-1',
      props: { variant: 'soft-success' } });

    expect(cardEl.getAttribute('data-state')).toBe('ready');
    expect(cardEl.querySelector('.badge').getAttribute('data-variant')).toBe('soft-success');

    // Step 4: Mount a button in the footer
    service.applyOp({
      type: 'mount', id: 'btn-1',
      parent: 'results', slot: 'footer',
      spec: { component: 'button', props: { label: 'View Details', variant: 'primary' } }
    }, { documentRef: document });

    expect(cardEl.querySelector('.card__footer .button').textContent).toBe('View Details');

    // Verify final live tree
    const snapshot = service.liveSnapshot();
    expect(snapshot).toContainEqual(expect.objectContaining({ id: 'results' }));
    const results = snapshot.find((n) => n.id === 'results');
    const bodyChildren = results.children.find((c) => c.slot === 'body');
    expect(bodyChildren).toBeTruthy();
    expect(bodyChildren.children).toContain('stat-1');
  });

  it('handles error recovery via state transitions', () => {
    const service = createService();

    service.applyOp({
      type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Fetch' } }
    }, { documentRef: document });
    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'loading' });

    // Simulate error
    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'error' });
    expect(service.getLiveNode('card-1').element.getAttribute('data-state')).toBe('error');

    // Retry: back to loading, then success
    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'loading' });
    service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'ready' });
    expect(service.getLiveNode('card-1').element.getAttribute('data-state')).toBe('ready');
  });

  it('unmounts a subtree and cleans children', () => {
    const service = createService();

    service.applyOps([
      { type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Parent' } } },
      { type: 'mount', id: 'badge-1', parent: 'card-1', slot: 'body',
        spec: { component: 'badge', props: { label: 'Child' } } },
      { type: 'mount', id: 'btn-1', parent: 'card-1', slot: 'footer',
        spec: { component: 'button', props: { label: 'Go', variant: 'primary' } } }
    ], { documentRef: document });

    expect(service.liveSnapshot().length).toBe(3);

    service.applyOp({ type: 'unmount', id: 'card-1' });
    expect(service.liveSnapshot().length).toBe(0);
  });

  it('supports two independent concurrent compositions', () => {
    const service = createService();

    // First stream
    service.applyOp({ type: 'mount', id: 'stream-a',
      spec: { component: 'card', props: { title: 'Stream A' } } }, { documentRef: document });
    service.applyOp({ type: 'mount', id: 'a-badge', parent: 'stream-a', slot: 'body',
      spec: { component: 'badge', props: { label: 'A' } } }, { documentRef: document });

    // Second stream
    service.applyOp({ type: 'mount', id: 'stream-b',
      spec: { component: 'card', props: { title: 'Stream B' } } }, { documentRef: document });
    service.applyOp({ type: 'mount', id: 'b-badge', parent: 'stream-b', slot: 'body',
      spec: { component: 'badge', props: { label: 'B' } } }, { documentRef: document });

    // Update A independently
    service.applyOp({ type: 'setText', id: 'a-badge', text: 'A Updated' });
    expect(service.getLiveNode('a-badge').element.textContent).toBe('A Updated');

    // B unchanged
    expect(service.getLiveNode('b-badge').element.textContent).toBe('B');

    // Unmount A only
    service.applyOp({ type: 'unmount', id: 'stream-a' });
    expect(service.getLiveNode('stream-a')).toBeNull();
    expect(service.getLiveNode('a-badge')).toBeNull();
    expect(service.getLiveNode('stream-b')).toBeTruthy();
    expect(service.getLiveNode('b-badge')).toBeTruthy();
  });

  it('rejects setState with unknown attribute (security boundary)', () => {
    const service = createService();
    service.applyOp({ type: 'mount', id: 'badge-1',
      spec: { component: 'badge', props: { label: 'Secure' } } }, { documentRef: document });

    expect(() => service.applyOp({
      type: 'setState', id: 'badge-1', attr: 'onerror', value: 'alert(1)'
    })).toThrow(/Unknown state attribute/);
  });

  it('clears a slot and allows remounting into it', () => {
    const service = createService();
    service.applyOp({ type: 'mount', id: 'card-1',
      spec: { component: 'card', props: { title: 'Container' } } }, { documentRef: document });
    service.applyOp({ type: 'mount', id: 'old-1', parent: 'card-1', slot: 'body',
      spec: { component: 'badge', props: { label: 'Old' } } }, { documentRef: document });

    // Clear the slot
    service.applyOp({ type: 'clear', parent: 'card-1', slot: 'body' });
    expect(service.getLiveNode('old-1')).toBeNull();

    // Mount new content in same slot
    service.applyOp({ type: 'mount', id: 'new-1', parent: 'card-1', slot: 'body',
      spec: { component: 'badge', props: { label: 'New' } } }, { documentRef: document });
    expect(service.getLiveNode('new-1').element.textContent).toBe('New');
  });
});
