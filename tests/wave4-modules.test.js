import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { createRuntimeState, syncWindowRuntime } from '../src/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../src/runtime/features.js';
import { CommentsService } from '../src/modules/comments/index.js';
import { ContentWorkflowService } from '../src/modules/content-workflow/index.js';
import { EdgeSearchService } from '../src/modules/edge-search/index.js';
import { CommentsContracts } from '../src/modules/comments/contracts/comments-contracts.js';
import { ContentWorkflowContracts } from '../src/modules/content-workflow/contracts/content-workflow-contracts.js';
import { EdgeSearchContracts } from '../src/modules/edge-search/contracts/edge-search-contracts.js';

function bus(...moduleContracts) {
  const eventBus = new EventBus();
  eventBus.contracts = Object.assign({}, Contracts, ...moduleContracts);
  return eventBus;
}

describe('wave 4 frontend modules', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('comments manages optimistic comment state and moderation labels client-side', async () => {
    const eventBus = bus(CommentsContracts);
    const service = new CommentsService(eventBus);
    service.init({ comments: [{ id: 'c1', threadId: 'post-1', body: 'Hi', status: 'published' }] });

    const pending = service.submit({ threadId: 'post-1', body: 'Pending' });
    service.moderate('c1', { status: 'hidden', labels: ['spam'] });

    expect(pending.status).toBe('pending');
    expect(service.getComments('post-1')).toHaveLength(2);
    expect(service.comments.get('c1').labels).toEqual(['spam']);
    const invalidResult = await eventBus.publish('INTENT_COMMENT_SUBMIT', { item: { body: 'x' }, extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('content-workflow enforces frontend workflow transitions', async () => {
    const eventBus = bus(ContentWorkflowContracts);
    const service = new ContentWorkflowService(eventBus);
    service.init({ items: [{ id: 'page-1', title: 'Home', status: 'draft' }] });

    const review = service.transition('page-1', 'review');
    const invalid = service.transition('page-1', 'archived');

    expect(review.status).toBe('review');
    expect(invalid).toBeNull();
    const invalidResult = await eventBus.publish('INTENT_CONTENT_WORKFLOW_TRANSITION', { id: 'page-1', extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('edge-search supports local static indexes and suggestions without private writes', async () => {
    const eventBus = bus(EdgeSearchContracts);
    const service = new EdgeSearchService(eventBus);
    service.init({ index: [
      { id: '1', title: 'Red Shoes', body: 'Comfortable running shoes', tags: ['sale'] },
      { id: '2', title: 'Blue Hat', body: 'Cotton hat', tags: ['new'] }
    ] });

    const results = await service.query('shoes');
    const suggestions = service.suggest('s');

    expect(results.map((item) => item.id)).toEqual(['1']);
    expect(suggestions).toContain('sale');
    const invalidResult = await eventBus.publish('INTENT_EDGE_SEARCH_QUERY', { key: 'hat', extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('loads wave 4 modules only behind explicit feature flags', async () => {
    const state = createRuntimeState();
    syncWindowRuntime(state, { securityPolicy: { profile: 'development', globals: { exposeInternals: true } } });

    await loadOptionalFeatures(state, {
      FEATURES: { COMMENTS_MODULE: true, CONTENT_WORKFLOW: true, EDGE_SEARCH: true },
      runtimeConfig: {
        securityProfile: 'development',
        comments: { comments: [{ id: 'c1', threadId: 't1' }] },
        contentWorkflow: { items: [{ id: 'draft-1', status: 'draft' }] },
        edgeSearch: { index: [{ id: 'doc-1', title: 'Docs' }] }
      }
    });

    expect(state.moduleManager.isModuleLoaded('comments')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('content-workflow')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('edge-search')).toBe(true);
    expect(window.csma.edgeSearch.localQuery('Docs')).toHaveLength(1);

    await state.moduleManager.destroy();
  });
});
