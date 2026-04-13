import { describe, expect, it } from 'vitest';

import {
  buildMetaSnapshot,
  buildStaticRender,
  loadStaticRenderConfig,
  loadStaticRenderPages
} from '../tooling/scripts/build-static-render.js';
import { componentCatalog } from '../library/modules/ai-ui/catalog/componentCatalog.js';
import { contentArchetypes, layoutArchetypes } from '../library/modules/ai-ui/archetypes/registry.js';
import { compileContentArchetypeRenderContract } from '../library/modules/ai-ui/services/compileArchetype.js';

describe('build-static-render', () => {
  it('loads static render config and page declarations for demo', async () => {
    const config = await loadStaticRenderConfig('demo');
    const pages = await loadStaticRenderPages('demo', config);

    expect(config).toMatchObject({
      appPreset: 'full-csr',
      enabled: false,
      outDir: 'dist-static/demo',
      pagesModule: './render.pages.js',
      payloadScriptId: 'csma-render-bootstrap'
    });
    expect(pages).toEqual([
      expect.objectContaining({
        id: 'auth-login',
        routePath: '/',
        viewId: 'ai-ui.login-form'
      }),
      expect.objectContaining({
        id: 'contact-page',
        routePath: '/contact',
        viewId: 'ai-ui.contact-form'
      })
    ]);
  });

  it('merges page attrs through MetaManager snapshot normalization', () => {
    const contract = compileContentArchetypeRenderContract({
      contentArchetype: contentArchetypes.get('login-form'),
      layoutArchetype: layoutArchetypes.get('auth-shell'),
      catalog: componentCatalog,
      viewId: 'ai-ui.login-form',
      routePath: '/',
      pageId: 'auth-login',
      canonicalUrl: 'https://example.com/'
    });

    const snapshot = buildMetaSnapshot(contract, {
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

    expect(snapshot.title).toBe('Sign in');
    expect(snapshot.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tag: 'meta',
          props: expect.objectContaining({
            name: 'description'
          })
        }),
        expect.objectContaining({
          tag: 'link',
          props: expect.objectContaining({
            rel: 'canonical',
            href: 'https://example.com/'
          })
        })
      ])
    );
    expect(snapshot.htmlAttrs.attrs.lang).toBe('en');
    expect(snapshot.htmlAttrs.classes).toContain('auth-page');
    expect(snapshot.bodyAttrs.attrs['data-app-target']).toBe('demo');
  });

  it('fails static export for apps that have not enabled the SSG/SSR preset path', async () => {
    await expect(buildStaticRender('demo')).rejects.toThrow(/static export disabled/i);
  });
});
