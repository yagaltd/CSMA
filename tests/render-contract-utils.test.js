import { describe, expect, it } from 'vitest';

import { collectRenderContracts, validateRenderContract, validateRenderContracts } from '../tooling/scripts/render-contract-utils.js';

describe('render-contract-utils', () => {
  it('collects and validates the reference render contracts', () => {
    const contracts = collectRenderContracts();
    const findings = validateRenderContracts(contracts);

    expect(contracts.map(({ contract }) => contract.id)).toContain('auth-login');
    expect(findings).toEqual([]);
  });

  it('fails when kind is not render-contract', () => {
    const findings = validateRenderContract({
      id: 'auth-login',
      kind: 'view-model',
      version: '1.0.0',
      page: {
        id: 'auth-login',
        viewId: 'ai-ui.login-form',
        contentArchetypeId: 'login-form',
        layoutArchetypeId: 'auth-shell',
        routePath: '/sign-in',
        title: 'Welcome back'
      },
      layout: {
        id: 'auth-shell',
        regions: ['main'],
        rules: {},
        intro: {
          eyebrow: 'Secure access',
          headline: 'Welcome back',
          supportingText: 'Sign in to continue into your workspace.'
        }
      },
      head: {
        title: 'Welcome back',
        tags: [],
        htmlAttrs: { attrs: {}, classes: [], style: {} },
        bodyAttrs: { attrs: {}, classes: [], style: {} }
      },
      regions: {
        hero: [],
        main: [],
        aside: []
      },
      activation: {
        bootstrap: 'full-runtime',
        mode: 'page',
        required: false,
        runtimeDependencies: [],
        typeIComponents: ['card'],
        typeIIComponents: []
      },
      componentsUsed: ['card']
    }, 'inline');

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Render contract kind must be "render-contract".'
        })
      ])
    );
  });

  it('fails when a render node omits component', () => {
    const findings = validateRenderContract({
      id: 'auth-login',
      kind: 'render-contract',
      version: '1.0.0',
      page: {
        id: 'auth-login',
        viewId: 'ai-ui.login-form',
        contentArchetypeId: 'login-form',
        layoutArchetypeId: 'auth-shell',
        routePath: '/sign-in',
        title: 'Welcome back'
      },
      layout: {
        id: 'auth-shell',
        regions: ['main'],
        rules: {},
        intro: {
          eyebrow: 'Secure access',
          headline: 'Welcome back',
          supportingText: 'Sign in to continue into your workspace.'
        }
      },
      head: {
        title: 'Welcome back',
        tags: [],
        htmlAttrs: { attrs: {}, classes: [], style: {} },
        bodyAttrs: { attrs: {}, classes: [], style: {} }
      },
      regions: {
        hero: [],
        main: [{ props: {} }],
        aside: []
      },
      activation: {
        bootstrap: 'full-runtime',
        mode: 'page',
        required: false,
        runtimeDependencies: [],
        typeIComponents: ['card'],
        typeIIComponents: []
      },
      componentsUsed: ['card']
    }, 'inline');

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Render node "regions.main[0]".component must be a kebab-case component id.'
        })
      ])
    );
  });

  it('fails when activation.bootstrap is not full-runtime', () => {
    const findings = validateRenderContract({
      id: 'auth-login',
      kind: 'render-contract',
      version: '1.0.0',
      page: {
        id: 'auth-login',
        viewId: 'ai-ui.login-form',
        contentArchetypeId: 'login-form',
        layoutArchetypeId: 'auth-shell',
        routePath: '/sign-in',
        title: 'Welcome back'
      },
      layout: {
        id: 'auth-shell',
        regions: ['main'],
        rules: {},
        intro: {
          eyebrow: 'Secure access',
          headline: 'Welcome back',
          supportingText: 'Sign in to continue into your workspace.'
        }
      },
      head: {
        title: 'Welcome back',
        tags: [],
        htmlAttrs: { attrs: {}, classes: [], style: {} },
        bodyAttrs: { attrs: {}, classes: [], style: {} }
      },
      regions: {
        hero: [],
        main: [],
        aside: []
      },
      activation: {
        bootstrap: 'starter-runtime',
        mode: 'page',
        required: false,
        runtimeDependencies: [],
        typeIComponents: ['card'],
        typeIIComponents: []
      },
      componentsUsed: ['card']
    }, 'inline');

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Render contract activation.bootstrap must be "full-runtime".'
        })
      ])
    );
  });

  it('fails when regions.main is missing or not an array', () => {
    const findings = validateRenderContract({
      id: 'auth-login',
      kind: 'render-contract',
      version: '1.0.0',
      page: {
        id: 'auth-login',
        viewId: 'ai-ui.login-form',
        contentArchetypeId: 'login-form',
        layoutArchetypeId: 'auth-shell',
        routePath: '/sign-in',
        title: 'Welcome back'
      },
      layout: {
        id: 'auth-shell',
        regions: ['main'],
        rules: {},
        intro: {
          eyebrow: 'Secure access',
          headline: 'Welcome back',
          supportingText: 'Sign in to continue into your workspace.'
        }
      },
      head: {
        title: 'Welcome back',
        tags: [],
        htmlAttrs: { attrs: {}, classes: [], style: {} },
        bodyAttrs: { attrs: {}, classes: [], style: {} }
      },
      regions: {
        hero: [],
        main: {},
        aside: []
      },
      activation: {
        bootstrap: 'full-runtime',
        mode: 'page',
        required: false,
        runtimeDependencies: [],
        typeIComponents: ['card'],
        typeIIComponents: []
      },
      componentsUsed: ['card']
    }, 'inline');

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Render contract regions.main must be an array.'
        })
      ])
    );
  });
});
