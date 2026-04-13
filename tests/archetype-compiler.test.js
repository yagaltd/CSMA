import { describe, expect, it } from 'vitest';

import { componentCatalog } from '../library/modules/ai-ui/catalog/componentCatalog.js';
import { contentArchetypes, layoutArchetypes } from '../library/modules/ai-ui/archetypes/registry.js';
import {
  compileContentArchetypeRenderContract
} from '../library/modules/ai-ui/services/compileArchetype.js';
import { validateRenderContract } from '../tooling/scripts/render-contract-utils.js';

describe('compileContentArchetypeRenderContract', () => {
  it('compiles the login-form content archetype into a valid shared render contract', () => {
    const compiled = compileContentArchetypeRenderContract({
      contentArchetype: contentArchetypes.get('login-form'),
      layoutArchetype: layoutArchetypes.get('auth-shell'),
      catalog: componentCatalog,
      viewId: 'ai-ui.login-form',
      source: 'ai',
      props: {
        title: 'Welcome back',
        submitLabel: 'Continue'
      }
    });

    expect(validateRenderContract(compiled, 'inline')).toEqual([]);
    expect(compiled.page).toMatchObject({
      id: 'login-form',
      viewId: 'ai-ui.login-form',
      contentArchetypeId: 'login-form',
      layoutArchetypeId: 'auth-shell',
      routePath: '/login-form',
      title: 'Welcome back'
    });
    expect(compiled.page.target).toBeUndefined();
    expect(compiled.layout).toMatchObject({
      id: 'auth-shell',
      regions: ['main', 'aside'],
      rules: {
        maxWidth: 'layout-container',
        contentWidth: 'layout-container-narrow',
        alignment: 'center',
        density: 'comfortable'
      },
      intro: {
        eyebrow: 'Secure access',
        headline: 'Welcome back',
        supportingText: 'Sign in to continue into your workspace.'
      }
    });
    expect(compiled.regions.main).toHaveLength(1);
    expect(compiled.regions.aside).toEqual([]);
    expect(compiled.activation).toMatchObject({
      mode: 'page',
      required: false,
      source: 'ai',
      runtimeDependencies: []
    });
    expect(compiled.activation.typeIComponents).toEqual(['button', 'card', 'field', 'input']);
    expect(compiled.activation.typeIIComponents).toEqual([]);
    expect(compiled.componentsUsed).toEqual(['button', 'card', 'field', 'input']);
  });

  it('compiles a second content archetype into the same auth-shell contract shape', () => {
    const compiled = compileContentArchetypeRenderContract({
      contentArchetype: contentArchetypes.get('contact-form'),
      layoutArchetype: layoutArchetypes.get('auth-shell'),
      catalog: componentCatalog,
      viewId: 'ai-ui.contact-form'
    });

    expect(validateRenderContract(compiled, 'inline')).toEqual([]);
    expect(compiled.page).toMatchObject({
      id: 'contact-form',
      viewId: 'ai-ui.contact-form',
      contentArchetypeId: 'contact-form',
      layoutArchetypeId: 'auth-shell',
      routePath: '/contact-form',
      title: 'Talk to the team'
    });
    expect(compiled.regions.main[0].component).toBe('card');
    expect(compiled.regions.main[0].slots.body).toHaveLength(3);
    expect(compiled.regions.main[0].slots.footer[0].props.text).toBe('Request contact');
  });

  it('keeps the shared contract shape stable for browser rendering', () => {
    const compiled = compileContentArchetypeRenderContract({
      contentArchetype: contentArchetypes.get('login-form'),
      layoutArchetype: layoutArchetypes.get('auth-shell'),
      catalog: componentCatalog,
      viewId: 'ai-ui.login-form',
      props: {
        title: 'Welcome back',
        submitLabel: 'Continue'
      }
    });

    expect(compiled.regions.main[0]).toEqual({
      component: 'card',
      props: {
        title: 'Welcome back',
        description: 'Use your work email and password to access your workspace.',
        tone: 'subtle'
      },
      slots: {
        body: [
          {
            component: 'field',
            props: {
              label: 'Work email',
              helper: 'Use the email tied to your organization.',
              for: 'login-email',
              required: 'true'
            },
            slots: {
              control: [
                {
                  component: 'input',
                  props: {
                    id: 'login-email',
                    type: 'email',
                    name: 'email',
                    autocomplete: 'email',
                    placeholder: 'name@company.com'
                  }
                }
              ]
            }
          },
          {
            component: 'field',
            props: {
              label: 'Password',
              helper: 'Passwords are case sensitive.',
              for: 'login-password',
              required: 'true'
            },
            slots: {
              control: [
                {
                  component: 'input',
                  props: {
                    id: 'login-password',
                    type: 'password',
                    name: 'password',
                    autocomplete: 'current-password',
                    placeholder: 'Enter your password'
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
              variant: 'primary',
              text: 'Continue'
            }
          }
        ]
      }
    });
    expect(compiled.layout.intro).toEqual({
      eyebrow: 'Secure access',
      headline: 'Welcome back',
      supportingText: 'Sign in to continue into your workspace.'
    });
    expect(compiled.regions.main).toHaveLength(1);
    expect(compiled.regions.aside).toEqual([]);
    expect(compiled.componentsUsed).toEqual(['button', 'card', 'field', 'input']);
    expect(compiled.layout.id).toBe('auth-shell');
    expect(compiled.page.contentArchetypeId).toBe('login-form');
  });

  it('fails when the content archetype points at the wrong layout archetype', () => {
    expect(() => compileContentArchetypeRenderContract({
      contentArchetype: contentArchetypes.get('login-form'),
      layoutArchetype: { ...layoutArchetypes.get('auth-shell'), id: 'dashboard-shell' },
      catalog: componentCatalog,
      viewId: 'ai-ui.login-form'
    })).toThrow(/must target layout "dashboard-shell"/);
  });
});
