// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBus } from '../library/runtime/EventBus.js';
import { MetaManager } from '../library/runtime/MetaManager.js';
import { PageResolver } from '../library/runtime/PageResolver.js';
import { PageRuntimeService } from '../library/runtime/PageRuntimeService.js';
import { ClientNavigationService } from '../library/runtime/ClientNavigationService.js';
import { normalizeRoutePath } from '../library/runtime/pageRouting.js';
import { createRuntimeState } from '../library/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../library/runtime/features.js';
import { RENDER_PAGES } from '../demo/src/render.pages.js';

describe('page routing runtime', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div data-csma-page-root></div>';
    window.history.replaceState({}, '', '/');
    window.csma = {};
  });

  it('normalizes route paths for shared csr and ssr resolution', () => {
    const resolver = new PageResolver();
    resolver.init({
      pages: RENDER_PAGES
    });

    expect(normalizeRoutePath('/contact/')).toBe('/contact');
    expect(resolver.resolve('/contact/')).toMatchObject({
      id: 'contact-page',
      routePath: '/contact'
    });
  });

  it('renders a resolved page and updates page meta', async () => {
    const eventBus = new EventBus();
    const metaManager = new MetaManager(eventBus);
    const resolver = new PageResolver();
    resolver.init({ pages: RENDER_PAGES });
    const pageRuntime = new PageRuntimeService(eventBus, { pageResolver: resolver, metaManager });
    pageRuntime.init({ documentRef: document, windowRef: window });

    const contract = await pageRuntime.renderPath('/');

    expect(contract.page.id).toBe('auth-login');
    expect(document.querySelector('[data-csma-page-root] h1')?.textContent).toContain('Welcome back');
    expect(document.title).toBe('Sign in');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.body.getAttribute('data-app-target')).toBe('demo');
  });

  it('intercepts same-origin known-page links and ignores unknown paths', async () => {
    const resolver = new PageResolver();
    resolver.init({ pages: RENDER_PAGES });
    const pageRuntimeService = {
      renderPath: vi.fn().mockResolvedValue({})
    };
    const navigation = new ClientNavigationService();
    navigation.init({
      pageResolver: resolver,
      pageRuntimeService,
      windowRef: window,
      documentRef: document
    });

    document.body.innerHTML = `
      <div data-csma-page-root></div>
      <a id="known" href="/contact">Contact</a>
      <a id="unknown" href="/missing">Missing</a>
    `;

    const knownEvent = {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: vi.fn(),
      target: document.getElementById('known')
    };
    navigation.handleDocumentClick(knownEvent);

    expect(pageRuntimeService.renderPath).toHaveBeenCalledWith('/contact', { source: 'client-navigation' });
    expect(knownEvent.preventDefault).toHaveBeenCalledTimes(1);

    pageRuntimeService.renderPath.mockClear();
    const unknownEvent = {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: vi.fn(),
      target: document.getElementById('unknown')
    };
    navigation.handleDocumentClick(unknownEvent);

    expect(pageRuntimeService.renderPath).not.toHaveBeenCalled();
    expect(unknownEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('initializes full-runtime page services with explicit runtime config', async () => {
    const state = createRuntimeState();

    await loadOptionalFeatures(state, {
      FEATURES: {
        CLIENT_NAVIGATION: true
      },
      apiBaseUrl: '',
      runtimeConfig: {
        clientNavigation: {
          enabled: true
        },
        protocol: {
          subprotocol: '1.0.0'
        }
      },
      pages: RENDER_PAGES,
      documentRef: document,
      windowRef: window
    });

    const contract = await state.pageRuntime.renderPath('/');

    expect(state.pageResolver.resolve('/contact/')).toMatchObject({ id: 'contact-page' });
    expect(state.serviceManager.get('clientNavigation')).toBeTruthy();
    expect(contract.page.id).toBe('auth-login');
  });
});
