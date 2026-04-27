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
});
