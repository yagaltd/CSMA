import { describe, expect, it } from 'vitest';

import { componentCatalog } from '../library/modules/ai-ui/catalog/componentCatalog.js';
import { contentArchetypes, layoutArchetypes } from '../library/modules/ai-ui/archetypes/registry.js';
import { compileContentArchetypeRenderContract } from '../library/modules/ai-ui/services/compileArchetype.js';
import { mountRenderContractPage } from '../library/modules/ai-ui/services/renderPageDom.js';

describe('renderPageDom', () => {
  it('mounts a page from the shared render contract into live DOM', () => {
    const mount = document.createElement('div');
    const contract = compileContentArchetypeRenderContract({
      contentArchetype: contentArchetypes.get('login-form'),
      layoutArchetype: layoutArchetypes.get('auth-shell'),
      catalog: componentCatalog,
      viewId: 'ai-ui.login-form',
      routePath: '/',
      pageId: 'auth-login',
      props: {
        title: 'Sign in',
        submitLabel: 'Continue'
      }
    });

    mountRenderContractPage({
      mount,
      contract,
      catalog: componentCatalog
    });

    expect(mount.querySelector('[data-page-id="auth-login"]')).toBeTruthy();
    expect(mount.querySelector('.card__title')?.textContent).toContain('Welcome back');
    expect(mount.querySelector('button')?.textContent).toContain('Continue');
  });

  it('mounts a Type II fallback boundary when declared by the component manifest', () => {
    const mount = document.createElement('div');
    const contract = {
      id: 'toast-page',
      kind: 'render-contract',
      version: '1.0.0',
      page: {
        id: 'toast-page',
        viewId: 'ai-ui.toast',
        contentArchetypeId: 'toast-page',
        layoutArchetypeId: 'auth-shell',
        routePath: '/toast',
        title: 'Toast'
      },
      layout: {
        id: 'auth-shell',
        regions: ['main'],
        rules: {},
        intro: {
          eyebrow: '',
          headline: '',
          supportingText: ''
        }
      },
      head: {
        title: 'Toast',
        tags: [],
        htmlAttrs: { attrs: {}, classes: [], style: {} },
        bodyAttrs: { attrs: {}, classes: [], style: {} }
      },
      regions: {
        hero: [],
        main: [{ component: 'toast', props: { title: 'Notice' } }],
        aside: []
      },
      activation: {
        bootstrap: 'full-runtime',
        mode: 'page',
        required: true,
        runtimeDependencies: ['EventBus'],
        typeIComponents: [],
        typeIIComponents: ['toast']
      },
      componentsUsed: ['toast']
    };

    mountRenderContractPage({ mount, contract, catalog: componentCatalog });

    expect(mount.querySelector('.toast-boundary')?.textContent).toContain('Notifications activate after the page runtime starts.');
  });
});
