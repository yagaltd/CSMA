import { describe, expect, it } from 'vitest';

import EventBus from '../src/runtime/EventBus.js';
import { AIUIComposerService } from '../src/modules/ai-ui/services/AIUIComposerService.js';
import { manifest as authUiManifest } from '../src/modules/auth-ui/index.js';

function createService() {
  return new AIUIComposerService(new EventBus());
}

describe('AIUIComposerService', () => {
  it('renders registered primitives from a safe composition schema', () => {
    const service = createService();

    const node = service.compose({
      component: 'card',
      props: {
        title: 'Status',
        description: 'Current sync state'
      },
      slots: {
        body: [
          {
            component: 'badge',
            props: {
              label: 'Online',
              variant: 'soft-success'
            }
          },
          {
            component: 'field',
            props: {
              label: 'Email',
              helper: 'Used for account recovery',
              for: 'email'
            },
            slots: {
              control: [
                {
                  component: 'input',
                  props: {
                    id: 'email',
                    type: 'email',
                    name: 'email',
                    placeholder: 'name@example.com'
                  }
                }
              ]
            }
          }
        ],
        footer: [
          {
            component: 'button',
            props: {
              label: 'Refresh',
              variant: 'primary'
            }
          }
        ]
      }
    }, { documentRef: document });

    expect(node.matches('article.card')).toBe(true);
    expect(node.querySelector('.card__title').textContent).toBe('Status');
    expect(node.querySelector('.badge').textContent).toBe('Online');
    expect(node.querySelector('.badge').getAttribute('data-variant')).toBe('soft-success');
    expect(node.querySelector('.input').getAttribute('type')).toBe('email');
    expect(node.querySelector('.card__footer .button').textContent).toBe('Refresh');
  });

  it('writes unsafe-looking strings as textContent', () => {
    const service = createService();
    const node = service.compose({
      component: 'badge',
      props: {
        label: '<img src=x onerror=alert(1)>'
      }
    }, { documentRef: document });

    expect(node.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(node.querySelector('img')).toBeNull();
  });

  it('rejects unsafe or unregistered composition input', () => {
    const service = createService();

    expect(() => service.compose({ component: 'missing' }, { documentRef: document })).toThrow(/Unknown AI UI component/);
    expect(() => service.compose({ component: 'toast', props: { title: 'Hi' } }, { documentRef: document })).toThrow(/not a DOM composition node/);
    expect(() => service.compose({ component: 'badge', props: { unsupported: 'x' } }, { documentRef: document })).toThrow(/Unknown prop/);
    expect(() => service.compose({ component: 'badge', slots: { aside: [] } }, { documentRef: document })).toThrow(/Unknown slot/);
    expect(() => service.compose({
      component: 'card',
      slots: {
        footer: [{ component: 'input', props: { name: 'bad' } }]
      }
    }, { documentRef: document })).toThrow(/not allowed/);
    expect(() => service.compose({
      component: 'badge',
      props: { label: 'x'.repeat(1001) }
    }, { documentRef: document })).toThrow(/exceeds/);
  });

  it('rejects unsafe render metadata before it reaches the DOM', () => {
    const service = createService();

    service.registerComponent({
      id: 'test.link',
      propsSchema: { href: 'string' },
      slots: { default: { selector: ':root', allowedChildren: [] } },
      allowedChildren: [],
      render: {
        kind: 'element',
        tag: 'span',
        attributes: {
          href: { prop: 'href' }
        }
      }
    }, { owner: 'test' });

    expect(() => service.compose({
      component: 'test.link',
      props: { href: 'javascript:alert(1)' }
    }, { documentRef: document })).toThrow(/Unsafe URL/);

    service.registerComponent({
      id: 'test.script',
      propsSchema: {},
      slots: { default: { selector: ':root', allowedChildren: [] } },
      allowedChildren: [],
      render: {
        kind: 'element',
        tag: 'script'
      }
    }, { owner: 'test' });

    expect(() => service.compose({ component: 'test.script' }, { documentRef: document })).toThrow(/Unsafe render tag/);

    service.registerComponent({
      id: 'test.onclick',
      propsSchema: {},
      slots: { default: { selector: ':root', allowedChildren: [] } },
      allowedChildren: [],
      render: {
        kind: 'element',
        tag: 'span',
        attributes: {
          onclick: 'alert(1)'
        }
      }
    }, { owner: 'test' });

    expect(() => service.compose({ component: 'test.onclick' }, { documentRef: document })).toThrow(/Unsafe render attribute/);
  });

  it('registers module-scoped components on load and removes them on unload', () => {
    const eventBus = new EventBus();
    const service = new AIUIComposerService(eventBus);
    const manifest = {
      id: 'consent',
      aiUi: {
        components: [
          {
            id: 'consent.banner',
            alias: 'banner',
            title: 'Consent Banner',
            category: 'Consent',
            propsSchema: { label: 'string' },
            slots: { default: { selector: ':root', allowedChildren: [] } },
            allowedChildren: [],
            render: {
              kind: 'element',
              tag: 'section',
              className: 'consent-banner',
              textProp: 'label'
            }
          }
        ]
      }
    };

    expect(service.getComponent('consent.banner')).toBeNull();

    eventBus.publishSync('MODULE_LOADED', {
      id: 'consent',
      manifest
    });

    const node = service.compose({
      component: 'consent.banner',
      props: { label: 'Cookies' }
    }, { documentRef: document });

    expect(node.matches('section.consent-banner')).toBe(true);
    expect(node.textContent).toBe('Cookies');

    eventBus.publishSync('MODULE_UNLOADED', {
      id: 'consent',
      manifest
    });

    expect(service.getComponent('consent.banner')).toBeNull();
  });

  it('discovers the module-scoped auth-ui panel pattern', () => {
    const eventBus = new EventBus();
    const service = new AIUIComposerService(eventBus);

    eventBus.publishSync('MODULE_LOADED', {
      id: 'auth-ui',
      manifest: authUiManifest
    });

    expect(service.getComponent('auth-ui.panel')).toMatchObject({
      id: 'auth-ui.panel',
      owner: 'auth-ui',
      render: {
        kind: 'module-pattern',
        service: 'authUI',
        mount: 'mount'
      }
    });

    eventBus.publishSync('MODULE_UNLOADED', {
      id: 'auth-ui',
      manifest: authUiManifest
    });
    expect(service.getComponent('auth-ui.panel')).toBeNull();
  });

  // ── applyOp — mount ─────────────────────────────────────────────

  describe('applyOp — mount', () => {
    it('mounts a root component with text', () => {
      const service = createService();
      const result = service.applyOp({
        type: 'mount',
        id: 'badge-1',
        spec: { component: 'badge', props: { label: 'Hello' } }
      }, { documentRef: document });

      expect(result.id).toBe('badge-1');
      expect(result.element.getAttribute('data-aiui-id')).toBe('badge-1');
      expect(result.element.textContent).toBe('Hello');
      expect(result.parentId).toBeNull();
    });

    it('mounts a component into a parent slot', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Test' } }
      }, { documentRef: document });

      service.applyOp({
        type: 'mount', id: 'badge-1',
        parent: 'card-1', slot: 'body',
        spec: { component: 'badge', props: { label: 'Inside' } }
      }, { documentRef: document });

      const badge = service.getLiveNode('badge-1');
      expect(badge.parentId).toBe('card-1');
      expect(badge.slot).toBe('body');
      expect(badge.element.closest('.card__body')).toBeTruthy();
    });

    it('rejects duplicate mount id', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'badge-1',
        spec: { component: 'badge', props: { label: 'First' } }
      }, { documentRef: document });

      expect(() => service.applyOp({
        type: 'mount', id: 'badge-1',
        spec: { component: 'badge', props: { label: 'Second' } }
      }, { documentRef: document })).toThrow(/already exists/);
    });

    it('rejects mount with unknown component', () => {
      const service = createService();
      expect(() => service.applyOp({
        type: 'mount', id: 'x-1',
        spec: { component: 'does-not-exist' }
      }, { documentRef: document })).toThrow(/Unknown/);
    });

    it('rejects mount at invalid slot', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Test' } }
      }, { documentRef: document });

      expect(() => service.applyOp({
        type: 'mount', id: 'badge-1',
        parent: 'card-1', slot: 'nonexistent',
        spec: { component: 'badge', props: { label: 'X' } }
      }, { documentRef: document })).toThrow(/Unknown slot/);
    });
  });

  // ── applyOp — unmount ────────────────────────────────────────────

  describe('applyOp — unmount', () => {
    it('unmounts a root component and removes from registry', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'badge-1',
        spec: { component: 'badge', props: { label: 'Hello' } }
      }, { documentRef: document });

      expect(service.getLiveNode('badge-1')).toBeTruthy();
      expect(service.getLiveNode('badge-1').element).toBeTruthy();

      service.applyOp({ type: 'unmount', id: 'badge-1' });
      expect(service.getLiveNode('badge-1')).toBeNull();
    });

    it('cascades unmount to children', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Parent' } }
      }, { documentRef: document });
      service.applyOp({
        type: 'mount', id: 'badge-1',
        parent: 'card-1', slot: 'body',
        spec: { component: 'badge', props: { label: 'Child' } }
      }, { documentRef: document });

      service.applyOp({ type: 'unmount', id: 'card-1' });
      expect(service.getLiveNode('card-1')).toBeNull();
      expect(service.getLiveNode('badge-1')).toBeNull();
    });

    it('rejects unmount of unknown id', () => {
      const service = createService();
      expect(() => service.applyOp({
        type: 'unmount', id: 'does-not-exist'
      })).toThrow(/not found/);
    });
  });

  // ── applyOp — updateProps ────────────────────────────────────────

  describe('applyOp — updateProps', () => {
    it('updates data-variant on a badge', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'badge-1',
        spec: { component: 'badge', props: { label: 'Status', variant: 'soft-info' } }
      }, { documentRef: document });

      service.applyOp({
        type: 'updateProps', id: 'badge-1',
        props: { variant: 'soft-success' }
      });

      const el = service.getLiveNode('badge-1').element;
      expect(el.getAttribute('data-variant')).toBe('soft-success');
    });

    it('rejects update with unknown prop', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'badge-1',
        spec: { component: 'badge', props: { label: 'Test' } }
      }, { documentRef: document });

      expect(() => service.applyOp({
        type: 'updateProps', id: 'badge-1',
        props: { nonexistent: 'value' }
      })).toThrow(/Unknown prop/);
    });
  });

  // ── applyOp — setState ──────────────────────────────────────────

  describe('applyOp — setState', () => {
    it('sets data-state on a card', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Loading' } }
      }, { documentRef: document });

      service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'loading' });

      const el = service.getLiveNode('card-1').element;
      expect(el.getAttribute('data-state')).toBe('loading');
    });

    it('rejects unknown state attribute', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Test' } }
      }, { documentRef: document });

      expect(() => service.applyOp({
        type: 'setState', id: 'card-1', attr: 'onerror', value: 'alert(1)'
      })).toThrow(/Unknown state attribute/);
    });

    it('transitions through loading → ready → error', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Data' } }
      }, { documentRef: document });

      const el = service.getLiveNode('card-1').element;

      service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'loading' });
      expect(el.getAttribute('data-state')).toBe('loading');

      service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'ready' });
      expect(el.getAttribute('data-state')).toBe('ready');

      service.applyOp({ type: 'setState', id: 'card-1', attr: 'state', value: 'error' });
      expect(el.getAttribute('data-state')).toBe('error');
    });
  });

  // ── applyOp — setText ───────────────────────────────────────────

  describe('applyOp — setText', () => {
    it('updates text content on a badge', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'badge-1',
        spec: { component: 'badge', props: { label: 'Old' } }
      }, { documentRef: document });

      service.applyOp({ type: 'setText', id: 'badge-1', text: 'Updated' });
      expect(service.getLiveNode('badge-1').element.textContent).toBe('Updated');
    });

    it('rejects setText on a component without textProp', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Test' } }
      }, { documentRef: document });

      expect(() => service.applyOp({
        type: 'setText', id: 'card-1', text: 'New'
      })).toThrow(/does not support text updates/);
    });
  });

  // ── applyOp — reorder ───────────────────────────────────────────

  describe('applyOp — reorder', () => {
    it('reorders children in a slot', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'List' } }
      }, { documentRef: document });

      service.applyOp({ type: 'mount', id: 'a', parent: 'card-1', slot: 'body',
        spec: { component: 'badge', props: { label: 'A' } } }, { documentRef: document });
      service.applyOp({ type: 'mount', id: 'b', parent: 'card-1', slot: 'body',
        spec: { component: 'badge', props: { label: 'B' } } }, { documentRef: document });
      service.applyOp({ type: 'mount', id: 'c', parent: 'card-1', slot: 'body',
        spec: { component: 'badge', props: { label: 'C' } } }, { documentRef: document });

      const slotEl = service.getLiveNode('card-1').element.querySelector('.card__body');
      const originalOrder = [...slotEl.children].map((c) => c.textContent).join('');
      expect(originalOrder).toBe('ABC');

      service.applyOp({ type: 'reorder', parent: 'card-1', slot: 'body',
        order: ['c', 'a', 'b'] });

      const newOrder = [...slotEl.children].map((c) => c.textContent).join('');
      expect(newOrder).toBe('CAB');
    });
  });

  // ── applyOps — batch ─────────────────────────────────────────────

  describe('applyOps — batch', () => {
    it('applies multiple ops atomically', () => {
      const service = createService();
      service.applyOps([
        { type: 'mount', id: 'card-1',
          spec: { component: 'card', props: { title: 'Result' } } },
        { type: 'mount', id: 'badge-1',
          parent: 'card-1', slot: 'body',
          spec: { component: 'badge', props: { label: 'Complete' } } },
        { type: 'setState', id: 'card-1', attr: 'state', value: 'ready' }
      ], { documentRef: document });

      expect(service.getLiveNode('card-1').element.getAttribute('data-state')).toBe('ready');
      expect(service.getLiveNode('badge-1').parentId).toBe('card-1');
    });

    it('rejects batch with duplicate mount IDs', () => {
      const service = createService();
      expect(() => service.applyOps([
        { type: 'mount', id: 'badge-1',
          spec: { component: 'badge', props: { label: 'A' } } },
        { type: 'mount', id: 'badge-1',
          spec: { component: 'badge', props: { label: 'B' } } }
      ], { documentRef: document })).toThrow(/duplicate/);
    });

    it('does not apply any op if one fails validation (atomicity)', () => {
      const service = createService();
      const batch = [
        { type: 'mount', id: 'card-1',
          spec: { component: 'card', props: { title: 'Test' } } },
        { type: 'mount', id: 'badge-1',
          parent: 'card-1', slot: 'nonexistent',
          spec: { component: 'badge', props: { label: 'X' } } }
      ];

      expect(() => service.applyOps(batch, { documentRef: document })).toThrow();
      expect(service.getLiveNode('card-1')).toBeNull();
    });
  });

  // ── liveSnapshot ─────────────────────────────────────────────────

  describe('liveSnapshot', () => {
    it('returns current live tree structure', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: { component: 'card', props: { title: 'Analysis' } }
      }, { documentRef: document });

      const snapshot = service.liveSnapshot();
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].id).toBe('card-1');
      expect(snapshot[0].component).toBe('card');
      expect(snapshot[0].parentId).toBeNull();
    });
  });

  // ── cleanup clears live nodes ───────────────────────────────────

  describe('cleanup', () => {
    it('clears all live nodes on cleanup', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'badge-1',
        spec: { component: 'badge', props: { label: 'Alive' } }
      }, { documentRef: document });

      expect(service.liveSnapshot()).toHaveLength(1);
      service.cleanup();
      expect(service.liveSnapshot()).toHaveLength(0);
    });
  });

  // ── Nested ID passthrough (Step 6 from ai-ui-refactor.md) ──

  describe('mount with nested id hints', () => {
    it('registers nested children with id hints in liveNodes', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: {
          component: 'card',
          props: { title: 'Status' },
          slots: {
            body: [{
              id: 'badge-1',
              component: 'badge',
              props: { label: 'Online', variant: 'soft-info' }
            }]
          }
        }
      }, { documentRef: document });

      // Root is registered
      expect(service.getLiveNode('card-1')).toBeTruthy();
      // Nested child is also registered
      expect(service.getLiveNode('badge-1')).toBeTruthy();
      expect(service.getLiveNode('badge-1').parentId).toBe('card-1');
      expect(service.getLiveNode('badge-1').element.getAttribute('data-aiui-id')).toBe('badge-1');
    });

    it('allows targeting nested children with updateProps after mount', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: {
          component: 'card',
          props: { title: 'Data' },
          slots: {
            body: [{
              id: 'badge-1',
              component: 'badge',
              props: { label: 'Processing', variant: 'soft-info' }
            }]
          }
        }
      }, { documentRef: document });

      // Update the nested badge
      service.applyOp({ type: 'updateProps', id: 'badge-1', props: { label: 'Done', variant: 'soft-success' } });

      const el = service.getLiveNode('badge-1').element;
      expect(el.textContent).toBe('Done');
      expect(el.getAttribute('data-variant')).toBe('soft-success');
    });

    it('allows setState on nested children', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: {
          component: 'card',
          props: { title: 'Report' },
          slots: {
            body: [{
              id: 'badge-1',
              component: 'badge',
              props: { label: 'Running' }
            }]
          }
        }
      }, { documentRef: document });

      service.applyOp({ type: 'setState', id: 'badge-1', attr: 'state', value: 'loading' });
      expect(service.getLiveNode('badge-1').element.getAttribute('data-state')).toBe('loading');
    });

    it('unmounts nested children when root is unmounted', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: {
          component: 'card',
          props: { title: 'Parent' },
          slots: {
            body: [{
              id: 'badge-1',
              component: 'badge',
              props: { label: 'Child' }
            }]
          }
        }
      }, { documentRef: document });

      expect(service.liveSnapshot().length).toBe(2);

      service.applyOp({ type: 'unmount', id: 'card-1' });

      expect(service.liveSnapshot().length).toBe(0);
      expect(service.getLiveNode('card-1')).toBeNull();
      expect(service.getLiveNode('badge-1')).toBeNull();
    });

    it('registers multiple nested children across different slots', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: {
          component: 'card',
          props: { title: 'Multi' },
          slots: {
            body: [{
              id: 'badge-body',
              component: 'badge',
              props: { label: 'In Body' }
            }],
            footer: [{
              id: 'btn-footer',
              component: 'button',
              props: { label: 'In Footer', variant: 'primary' }
            }]
          }
        }
      }, { documentRef: document });

      expect(service.getLiveNode('badge-body')).toBeTruthy();
      expect(service.getLiveNode('btn-footer')).toBeTruthy();
      expect(service.getLiveNode('badge-body').parentId).toBe('card-1');
      expect(service.getLiveNode('btn-footer').parentId).toBe('card-1');
    });

    it('ignores children without id hints (anonymous, not tracked)', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: {
          component: 'card',
          props: { title: 'Mixed' },
          slots: {
            body: [
              { id: 'badge-1', component: 'badge', props: { label: 'Tracked' } },
              { component: 'badge', props: { label: 'Anonymous' } }
            ]
          }
        }
      }, { documentRef: document });

      // Only the id-hinted child is tracked
      expect(service.getLiveNode('badge-1')).toBeTruthy();
      // Anonymous one is not in liveNodes
      const snapshot = service.liveSnapshot();
      expect(snapshot.length).toBe(2); // card-1 + badge-1
    });

    it('rejects duplicate nested id that conflicts with root id', () => {
      const service = createService();
      expect(() => service.applyOp({
        type: 'mount', id: 'badge-1',
        spec: {
          component: 'card',
          props: { title: 'Bad' },
          slots: {
            body: [{
              id: 'badge-1',  // same as root id
              component: 'badge',
              props: { label: 'Duplicate' }
            }]
          }
        }
      }, { documentRef: document })).toThrow(/already exists/);
    });

    it('nested ids appear in liveSnapshot', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: {
          component: 'card',
          props: { title: 'Snap' },
          slots: {
            body: [{
              id: 'badge-1',
              component: 'badge',
              props: { label: 'Test' }
            }]
          }
        }
      }, { documentRef: document });

      const snapshot = service.liveSnapshot();
      const card = snapshot.find(n => n.id === 'card-1');
      const badge = snapshot.find(n => n.id === 'badge-1');
      expect(card).toBeTruthy();
      expect(badge).toBeTruthy();
      expect(card.children.find(c => c.slot === 'body')?.children).toContain('badge-1');
    });

    it('works with setText on nested badge', () => {
      const service = createService();
      service.applyOp({
        type: 'mount', id: 'card-1',
        spec: {
          component: 'card',
          props: { title: 'Stream' },
          slots: {
            body: [{
              id: 'badge-1',
              component: 'badge',
              props: { label: 'Loading...' }
            }]
          }
        }
      }, { documentRef: document });

      service.applyOp({ type: 'setText', id: 'badge-1', text: 'Complete' });
      expect(service.getLiveNode('badge-1').element.textContent).toBe('Complete');
    });
  });
});
