import { describe, expect, it } from 'vitest';

import { componentCatalog } from '../library/modules/ai-ui/catalog/componentCatalog.js';
import { contentArchetypes, layoutArchetypes } from '../library/modules/ai-ui/archetypes/registry.js';
import { compileContentArchetypeRenderContract } from '../library/modules/ai-ui/services/compileArchetype.js';
import { renderStaticDocument } from '../library/modules/ai-ui/services/renderStaticHtml.js';
import { buildMetaSnapshot } from '../tooling/scripts/build-static-render.js';

describe('renderStaticDocument', () => {
  it('renders a full html document from the shared render contract', () => {
    const contract = compileContentArchetypeRenderContract({
      contentArchetype: contentArchetypes.get('login-form'),
      layoutArchetype: layoutArchetypes.get('auth-shell'),
      catalog: componentCatalog,
      viewId: 'ai-ui.login-form',
      routePath: '/',
      pageId: 'auth-login',
      canonicalUrl: 'https://example.com/',
      props: {
        title: 'Sign in',
        submitLabel: 'Continue'
      }
    });
    const metaSnapshot = buildMetaSnapshot(contract, {
      htmlAttrs: {
        attrs: { lang: 'en' },
        classes: ['auth-page'],
        style: {}
      },
      bodyAttrs: {
        attrs: { 'data-app-target': 'demo' },
        classes: [],
        style: {}
      }
    });

    const html = renderStaticDocument({
      contract,
      metaSnapshot,
      catalog: componentCatalog,
      assetUrls: {
        css: ['assets/styles.css'],
        js: ['assets/app.js']
      },
      payload: {
        contract
      }
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Sign in</title>');
    expect(html).toContain('link rel="canonical" href="https://example.com/"');
    expect(html).toContain('class="auth-page');
    expect(html).toContain('data-app-target="demo"');
    expect(html).toContain('Welcome back');
    expect(html).toContain('placeholder="name@company.com"');
    expect(html).toContain('>Continue<');
    expect(html).toContain('href="assets/styles.css"');
    expect(html).toContain('id="csma-render-bootstrap"');
    expect(html).toContain('src="assets/app.js"');
  });

  it('renders a manifest-declared Type II fallback boundary', () => {
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

    const html = renderStaticDocument({
      contract,
      metaSnapshot: {
        title: 'Toast',
        tags: [],
        htmlAttrs: { attrs: {}, classes: [], style: {} },
        bodyAttrs: { attrs: {}, classes: [], style: {} }
      },
      catalog: componentCatalog
    });

    expect(html).toContain('toast-boundary');
    expect(html).toContain('Notifications activate after the page runtime starts.');
  });
});
